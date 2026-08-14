<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation de la demande d'un lien de connexion par magic link. Whitelist
 * stricte : seul le champ email est accepté. La logique d'éligibilité de
 * l'adresse (allowlist MAGIC_LINK_ALLOWED_EMAILS / comptes existants) reste
 * gérée par MagicLinkController::resolveUser pour préserver la réponse
 * générique anti-énumération.
 */
class MagicLinkSendRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route publique : la demande de lien n'exige pas de session.
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:254'],
        ];
    }
}
