<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Authentification via Cloudflare Access (Zero Trust).
 *
 * Cloudflare Access pose l'en-tete Cf-Access-Jwt-Assertion contenant un JWT
 * RS256 signe par Cloudflare. Ce middleware :
 *   1. Recupere et valide le JWT (signature RS256 via les cles publiques CF) ;
 *   2. Extrait l'email de l'utilisateur ;
 *   3. Cree/connecte l'utilisateur Laravel correspondant.
 */
class CloudflareAccessAuth
{
    private string $teamDomain;
    private string $audience;
    private ?string $devEmail;

    public function __construct()
    {
        $this->teamDomain = (string) env('CF_ACCESS_TEAM_DOMAIN', 'dark-pond-66e7.cloudflareaccess.com');
        $this->audience = (string) env('CF_ACCESS_AUDIENCE', '');
        $this->devEmail = env('CF_ACCESS_DEV_EMAIL');
    }

    public function handle(Request $request, Closure $next)
    {
        if (auth()->check()) {
            return $next($request);
        }

        $jwt = $request->header('Cf-Access-Jwt-Assertion');

        if (!$jwt && $this->devEmail && app()->environment('local', 'testing')) {
            $this->loginUser($this->devEmail);
            return $next($request);
        }

        if (!$jwt) {
            return $this->unauthorized($request);
        }

        try {
            $claims = $this->verifyJwt($jwt);
            $email = $claims['email'] ?? null;

            if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException('Email manquant ou invalide');
            }

            $this->loginUser($email);
        } catch (\Throwable $e) {
            Log::error('CF Access: JWT verification failed', [
                'error' => $e->getMessage(),
            ]);
            return $this->unauthorized($request);
        }

        return $next($request);
    }

    private function verifyJwt(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new RuntimeException('JWT mal forme');
        }
        [$headerB64, $payloadB64, $signatureB64] = $parts;

        $header = json_decode($this->base64UrlDecode($headerB64), true);
        $payload = json_decode($this->base64UrlDecode($payloadB64), true);

        if (!$header || !$payload) {
            throw new RuntimeException('Header ou payload illisible');
        }

        if (($header['alg'] ?? '') !== 'RS256') {
            throw new RuntimeException('Algorithme non supporte');
        }

        $expectedIssuer = "https://{$this->teamDomain}";
        if (($payload['iss'] ?? '') !== $expectedIssuer) {
            throw new RuntimeException('Issuer invalide');
        }

        $exp = $payload['exp'] ?? 0;
        if (time() >= $exp) {
            throw new RuntimeException('JWT expire');
        }

        if ($this->audience) {
            $aud = $payload['aud'] ?? [];
            if (is_string($aud)) $aud = [$aud];
            if (!in_array($this->audience, $aud, true)) {
                throw new RuntimeException('Audience invalide');
            }
        }

        $kid = $header['kid'] ?? '';
        $publicKey = $this->getPublicKey($kid);

        $signedData = $headerB64 . '.' . $payloadB64;
        $signature = $this->base64UrlDecode($signatureB64);

        $result = openssl_verify(
            $signedData,
            $signature,
            $publicKey,
            OPENSSL_ALGO_SHA256
        );

        if ($result !== 1) {
            throw new RuntimeException('Signature JWT invalide');
        }

        return $payload;
    }

    private function getPublicKeys(): array
    {
        return Cache::remember('cf_access_jwks', 300, function (): array {
            $url = "https://{$this->teamDomain}/cdn-cgi/access/certs";
            $response = @file_get_contents($url);
            if ($response === false) {
                throw new RuntimeException("Impossible de recuperer les cles CF Access");
            }
            $data = json_decode($response, true);
            return $data['keys'] ?? [];
        });
    }

    private function getPublicKey(string $kid): string
    {
        $keys = $this->getPublicKeys();
        $key = null;
        foreach ($keys as $k) {
            if (($k['kid'] ?? '') === $kid) {
                $key = $k;
                break;
            }
        }
        if (!$key) {
            Cache::forget('cf_access_jwks');
            $keys = $this->getPublicKeys();
            foreach ($keys as $k) {
                if (($k['kid'] ?? '') === $kid) {
                    $key = $k;
                    break;
                }
            }
        }
        if (!$key) {
            throw new RuntimeException("Cle publique introuvable pour kid: $kid");
        }

        return $this->jwkToPem($key['n'], $key['e']);
    }

    /**
     * Convertit une cle JWK (RSA) en PEM sans GMP.
     * Utilise directement les bytes base64url-decodes pour construire
     * la structure DER (SubjectPublicKeyInfo PKCS#8).
     */
    private function jwkToPem(string $nB64, string $eB64): string
    {
        $modulus = $this->base64UrlDecode($nB64);
        $exponent = $this->base64UrlDecode($eB64);

        // DER encode an INTEGER from raw big-endian bytes.
        // Prepend 0x00 if high bit is set (DER integers are signed).
        $modDer = $this->derInteger($modulus);
        $expDer = $this->derInteger($exponent);

        // RSAPublicKey (PKCS#1): SEQUENCE { modulus INTEGER, publicExponent INTEGER }
        $rsaPubKey = $modDer . $expDer;
        $rsaPubKey = "\x30" . $this->derLength(strlen($rsaPubKey)) . $rsaPubKey;

        // AlgorithmIdentifier: rsaEncryption (1.2.840.113549.1.1.1) + NULL params
        $algDer = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";

        // SubjectPublicKeyInfo: SEQUENCE { AlgorithmIdentifier, BIT STRING (RSAPublicKey) }
        $bitString = "\x00" . $rsaPubKey; // 0 prefix = 0 unused bits
        $spkiBody = $algDer . "\x03" . $this->derLength(strlen($bitString)) . $bitString;
        $spki = "\x30" . $this->derLength(strlen($spkiBody)) . $spkiBody;

        $pem = "-----BEGIN PUBLIC KEY-----\n";
        $pem .= chunk_split(base64_encode($spki), 64, "\n");
        $pem .= "-----END PUBLIC KEY-----\n";

        return $pem;
    }

    /**
     * Encode raw bytes as a DER INTEGER (with 0x00 prefix if needed).
     */
    private function derInteger(string $bytes): string
    {
        // Remove leading zero bytes (but keep at least one byte).
        $bytes = ltrim($bytes, "\x00");
        if ($bytes === '') {
            $bytes = "\x00";
        }
        // Prepend 0x00 if the high bit is set (positive integer in DER).
        if ((ord($bytes[0]) & 0x80) !== 0) {
            $bytes = "\x00" . $bytes;
        }
        return "\x02" . $this->derLength(strlen($bytes)) . $bytes;
    }

    private function derLength(int $len): string
    {
        if ($len < 128) {
            return chr($len);
        }
        $bytes = [];
        while ($len > 0) {
            array_unshift($bytes, chr($len & 0xff));
            $len >>= 8;
        }
        return chr(0x80 | count($bytes)) . implode('', $bytes);
    }

    private function base64UrlDecode(string $data): string
    {
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'));
    }

    private function loginUser(string $email): void
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            ['name' => Str::before($email, '@')]
        );

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        auth()->login($user, remember: true);
    }

    private function unauthorized(Request $request)
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => 'Non authentifie via Cloudflare Access.'], 401);
        }
        return redirect('/?login_error=cf_access_required');
    }
}
