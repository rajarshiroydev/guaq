# GUAQ - Hospitality Ops Demo

This repository now has a split architecture:

- Vite React frontend (deploy to Vercel)
- Node.js Express backend (deploy to Railway)
- PostgreSQL on Supabase via Prisma
- Groq for AI features
- Telegram Bot API for live inbox integration

## Architecture

### Frontend

- Stack: Vite + React + TypeScript
- Purpose: dashboard UI, simulator, inbox, reviews, analytics
- API integration:
  - `services/geminiService.ts` now calls backend endpoints (`/api/ai/*`)
  - `components/Inbox.tsx` can use backend inbox APIs for Telegram conversations/messages

### Backend

- Location: `backend/`
- Stack: Express + TypeScript + Prisma + Zod
- Main endpoints:
  - `GET /health`
  - `POST /api/ai/simulator-reply`
  - `POST /api/ai/review-reply`
  - `POST /api/ai/help-answer`
  - `GET /api/inbox/conversations`
  - `GET /api/inbox/messages/:conversationId`
  - `POST /api/inbox/messages/send`
  - `POST /api/telegram/webhook`
  - `POST /api/telegram/set-webhook`

### Database (Supabase)

- Prisma schema: `backend/prisma/schema.prisma`
- Seed script: `backend/prisma/seed.ts`
- Tables include staff, tickets, reviews, alerts, conversations, messages

## Local Setup

### 1) Frontend

Create a root `.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Install and run:

```bash
npm install
npm run dev
```

### 2) Backend

Copy env template:

```bash
cp backend/.env.example backend/.env
```

Set required values in `backend/.env`:

```env
DATABASE_URL=postgresql://...
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
```

Install and run:

```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

Optional DB setup against Supabase:

```bash
npm run prisma:migrate
npm run prisma:seed
```

## Deployment

### Vercel (frontend)

- Root project deploys as static SPA
- Required env var:
  - `VITE_API_BASE_URL=https://<your-railway-backend-domain>`

### Railway (backend)

- Service root: `backend/`
- Build command: `npm run build`
- Start command: `npm start`
- Required env vars:
  - `DATABASE_URL`
  - `FRONTEND_URL` (Vercel domain)
  - `GROQ_API_KEY`
  - `GROQ_MODEL` (optional, default exists)
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET` (recommended)

### Telegram webhook

After Railway deploy, set webhook:

```bash
curl -X POST https://<your-railway-domain>/api/telegram/set-webhook \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-railway-domain>/api/telegram/webhook"}'
```

Then set the same secret in Telegram webhook settings and backend env (`TELEGRAM_WEBHOOK_SECRET`).

## Notes

- This is MVP-first and still contains some demo-local state in parts of the UI not yet migrated.
- AI keys are no longer needed in the frontend bundle.
- `infrastructure/docker-compose.yml` remains optional local infra and is not required for Railway/Vercel deploy.
