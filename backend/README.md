# Sunny Backend

Express API that powers the Sunny web assistant. Provides a single chat endpoint with optional server-sent event (SSE) streaming and cookie-based session history.

## Requirements
- Node.js 18+
- `OPENAI_API_KEY` set in your environment

## Environment variables
| Name | Description | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI API key (required) | — |
| `OPENAI_MODEL` | Model name to use | `gpt-4o-mini` |
| `PORT` | Server port | `3001` |
| `FRONTEND_ORIGIN` | Allowed CORS origin for widget | `*` (credentials disabled) |

Copy `.env.example` to `.env` and fill in your values.

## Running locally
```bash
cd backend
npm install
npm start
```

All runtime dependencies are vendored under `local_modules`, so `npm install` does not require external registry access.

The server exposes `http://localhost:3001` by default.

## Endpoints
### `POST /api/chat`
Send a message to Sunny. Cookies maintain per-visitor context for a rolling history.

**Request body**
```json
{ "message": "Hello" }
```

**Query parameters**
- `stream=true` (optional): request SSE streaming response

**Responses**
- `200 OK` with JSON: `{ "reply": "..." }`
- `200 OK` with `text/event-stream` if `stream=true`, emitting `{ token }` chunks and a final `{ done: true }` event
- `400` on validation errors

Cookies are HTTP-only and expire after 4 hours of inactivity.

## Example requests
Non-streamed:
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello Sunny"}'
```

Streaming:
```bash
curl -N -X POST "http://localhost:3001/api/chat?stream=true" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message":"Give me a short update"}'
```

## Session notes
- Each visitor gets a `sunny_session` cookie.
- In-memory store trims to the last 10 turns for compact prompts.
- Restarting the server clears memory, which resets history for all sessions.
