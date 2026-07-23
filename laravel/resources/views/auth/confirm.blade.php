<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Confirmer la connexion — DarkMedia · Prompt AI</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#141418">
    {{-- Empêche l'indexation de la page intermédiaire du lien magique --}}
    <meta name="robots" content="noindex">
    <style>
        :root {
            --bg: #141418;
            --panel: rgba(28, 28, 34, .82);
            --border: rgba(148, 163, 184, .14);
            --border-strong: rgba(148, 163, 184, .22);
            --text: #ececf1;
            --muted: #a1a1ac;
            --faint: #6b6b76;
            --accent: #7c5cff;
            --accent-2: #5b8def;
        }
        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body {
            margin: 0; min-height: 100vh; min-height: 100dvh;
            display: flex; align-items: center; justify-content: center;
            background: var(--bg); color: var(--text); padding: 24px;
            font-family: "Inter", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased; position: relative; overflow: hidden;
        }
        .aurora { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .aurora span {
            position: absolute; border-radius: 50%; filter: blur(80px); opacity: .45;
            animation: drift 18s ease-in-out infinite;
        }
        .aurora .a { width: 480px; height: 480px; top: -140px; left: -120px;
            background: radial-gradient(circle, #7c5cff, transparent 70%); }
        .aurora .b { width: 520px; height: 520px; bottom: -180px; right: -140px;
            background: radial-gradient(circle, #5b8def, transparent 70%); animation-delay: -6s; }
        @keyframes drift {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(40px, -30px) scale(1.12); }
        }
        .card {
            position: relative; z-index: 1; width: 100%; max-width: 400px; text-align: center;
            background: var(--panel); border: 1px solid var(--border-strong); border-radius: 18px;
            padding: 36px; box-shadow: 0 30px 80px rgba(0, 0, 0, .55);
            backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        }
        .mark {
            width: 52px; height: 52px; border-radius: 14px; margin: 0 auto 22px; display: block;
            box-shadow: 0 8px 24px rgba(124, 92, 255, .35);
        }
        h1 { font-size: 21px; margin: 0 0 8px; color: #fff; font-weight: 700; letter-spacing: -.01em; }
        p.sub { font-size: 13.5px; color: var(--muted); margin: 0 0 26px; line-height: 1.55; }
        button {
            width: 100%; border: 0; cursor: pointer;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            color: #fff; font-weight: 700; font-size: 13px; text-transform: uppercase;
            letter-spacing: .05em; padding: 14px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center; gap: 9px;
            box-shadow: 0 12px 28px rgba(124, 92, 255, .35);
            transition: transform .12s ease, box-shadow .15s ease, filter .15s ease;
        }
        button:hover { filter: brightness(1.08); box-shadow: 0 16px 36px rgba(124, 92, 255, .45); }
        button:active { transform: translateY(1px); }
        button svg { width: 16px; height: 16px; }
        .foot { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border);
            font-size: 11.5px; color: var(--faint); text-align: center; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="aurora"><span class="a"></span><span class="b"></span></div>

    <div class="card">
        <img class="mark" src="/favicon.svg" alt="" width="52" height="52">
        <h1>Confirmer la connexion</h1>
        <p class="sub">Votre lien de connexion est valide. Appuyez sur le bouton ci-dessous pour ouvrir votre session.</p>

        <form method="POST" action="{{ route('magic-link.consume') }}">
            @csrf
            <input type="hidden" name="token" value="{{ $token }}">
            <button type="submit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>
                Ouvrir ma session
            </button>
        </form>

        <p class="foot">Accès réservé au propriétaire de cet espace.</p>
    </div>
</body>
</html>
