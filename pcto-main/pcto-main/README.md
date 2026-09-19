# Educazione Digitale Familiare

App Angular per l'educazione digitale familiare. Nessun backend richiesto:
il browser fa fetch diretto a Google Apps Script all'avvio, con cache in
`localStorage` (TTL 5 minuti).

Il sorgente vive in [`angular-app/`](angular-app/README.md) — vedi il suo
README per struttura, sviluppo e build.

## Deploy su GitHub Pages

Il workflow `.github/workflows/deploy.yml` compila l'app
(`npm run build:pages`: base-href `/pcto/` + fallback SPA `404.html`) e
pubblica `dist/angular-app/browser` sul branch `gh-pages`.

Si avvia **manualmente** dalla tab Actions (Run workflow), così un push del
branch non sovrascrive il sito live per errore.

Configurazione Pages: Settings → Pages → Branch: `gh-pages` → / (root)
