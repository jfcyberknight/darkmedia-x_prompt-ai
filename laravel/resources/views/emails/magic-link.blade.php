<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion — DarkMedia Prompt AI</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141418;border:1px solid #2a2a32;border-radius:12px;padding:32px;">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <h1 style="margin:0;font-size:20px;color:#e7e7ea;">DarkMedia · Prompt AI</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#9a9aa5;">Ton lien de connexion est prêt</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0;">
              <a href="{{ $loginUrl }}"
                 style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">
                Se connecter
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;">
              <p style="margin:0;font-size:13px;color:#9a9aa5;line-height:1.6;">
                Ce lien est valable <strong style="color:#e7e7ea;">{{ $expirationMinutes }} minutes</strong> et ne peut être utilisé qu'une seule fois.
                Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:#5c5c66;word-break:break-all;">
                Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br>
                {{ $loginUrl }}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
