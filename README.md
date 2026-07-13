# Fantasy Basketball Analytics Platform

An NBA analytics and fantasy decision-support platform — player profiles, advanced
metrics, custom scoring, and league dashboards, built on real NBA data.

This repo is being built milestone by milestone. See `MILESTONE_LOG.md` for what's
done and what's next.

## Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Data source:** `nba_api` (wraps stats.nba.com), behind a provider abstraction so
  it can be swapped or supplemented later without touching the rest of the app

## Quickstart

```bash
# 1. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL
alembic upgrade head
python -m app.ingestion.sync_players
uvicorn app.main:app --reload

# 2. Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

Backend runs at `http://localhost:8000` (docs at `/docs`).
Frontend runs at `http://localhost:5173`.

See `backend/README.md` and the milestone plan for details.
