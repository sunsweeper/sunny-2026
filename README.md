# Sunny 2026

Sunny is a lightweight, embeddable web assistant with a vanilla JS widget and a Node.js/Express backend that streams responses from OpenAI. Drop the widget onto any site, point it at the backend, and get a friendly helper without exposing API keys to the browser.

## Project structure
```
Sunny-2026/
├── backend/       # Express API for chat + sessions
└── frontend/      # Embeddable widget assets and demo page
```

## Prerequisites
- Node.js 18+
- An OpenAI API key

## Setup
1. Copy `backend/.env.example` to `backend/.env` and set your values.
2. Install backend dependencies and start the server (all dependencies are vendored locally, so no registry access is required):
   ```bash
   cd backend
   npm install
   npm start
   ```
   The server listens on `PORT` (default `3001`).

3. Open the demo widget page from the repository root:
   ```bash
   cd frontend
   python -m http.server 8080
   ```
   Visit http://localhost:8080/demo.html while the backend is running.

## Required environment variables
- `OPENAI_API_KEY` – your OpenAI key (never exposed client-side)
- `OPENAI_MODEL` – model to use (default `gpt-4o-mini`)
- `PORT` – backend port (default `3001`)
- `FRONTEND_ORIGIN` – allowed origin for CORS, e.g., `http://localhost:8080`

## Embedding the widget
Add the CSS/JS files to your site (served from your own static host) and configure the backend URL:
```html
<link rel="stylesheet" href="/path/to/widget.css" />
<script>
  window.SUNNY_WIDGET_CONFIG = { apiBase: 'https://your-backend.example.com' };
</script>
<script src="/path/to/widget.js"></script>
```
Place the snippet before the closing `</body>` tag. A floating Sunny button will appear and open the chat panel.

## Deployment notes
- Backend can run as a long-lived Node server or as a serverless Express app. For Vercel serverless, wrap `app` export or use a custom server deployment; ensure environment variables are configured and `FRONTEND_ORIGIN` matches your site.
- The widget is static and can be hosted on any CDN or static host. Update `apiBase` to the deployed backend URL.
- Sessions are in-memory; scale-out deployments should swap in a shared store for persistence, but this MVP requires no database.
- Dependencies are bundled under `backend/local_modules` to avoid outbound registry calls in restricted environments.

## Security
- API keys stay on the server. The browser only calls `/api/chat` with credentials, and the server manages cookies.
- Input validation and a compact rolling history help reduce risk of prompt injection or token overuse.
