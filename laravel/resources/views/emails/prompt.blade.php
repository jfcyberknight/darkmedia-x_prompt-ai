<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt : {{ $prompt->title }}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141418;border:1px solid #2a2a32;border-radius:12px;padding:32px;">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <h1 style="margin:0;font-size:20px;color:#e7e7ea;">DarkMedia · Prompt AI</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#9a9aa5;">Un prompt partagé avec vous</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0 8px;">
              <h2 style="margin:0 0 4px;font-size:17px;color:#e7e7ea;">{{ $prompt->title }}</h2>
              @if ($prompt->description)
                <p style="margin:0 0 16px;font-size:14px;color:#9a9aa5;line-height:1.6;">{{ $prompt->description }}</p>
              @endif
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <div style="background:#0d0d0f;border:1px solid #2a2a32;border-radius:8px;padding:20px;font-family:'JetBrains Mono','Courier New',monospace;font-size:13px;color:#c4c4cc;line-height:1.7;white-space:pre-wrap;word-break:break-word;">{{ $prompt->content }}</div>
            </td>
          </tr>
          @if ($prompt->model || ($prompt->tags && count($prompt->tags)))
          <tr>
            <td style="padding:16px 0 8px;">
              @if ($prompt->model)
                <span style="display:inline-block;background:#1e1e26;color:#a5b4fc;border:1px solid #3138a8;border-radius:4px;padding:3px 10px;font-size:12px;margin-right:6px;">{{ $prompt->model }}</span>
              @endif
              @foreach (($prompt->tags ?? []) as $tag)
                <span style="display:inline-block;background:#1a1a22;color:#9a9aa5;border:1px solid #2a2a32;border-radius:4px;padding:3px 10px;font-size:12px;margin-right:6px;">#{{ $tag }}</span>
              @endforeach
            </td>
          </tr>
          @endif
          <tr>
            <td style="padding-top:24px;border-top:1px solid #2a2a32;">
              <p style="margin:0;font-size:12px;color:#5c5c66;line-height:1.6;">
                @if ($senderName)
                  Partagé par <strong style="color:#9a9aa5;">{{ $senderName }}</strong> via DarkMedia Prompt AI.
                @else
                  Partagé via DarkMedia Prompt AI.
                @endif
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
