# Backend — Fantasy Basketball Analytics API

FastAPI + PostgreSQL + SQLAlchemy + Alembic.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env with your local Postgres connection string
```

Create the database (adjust for your local Postgres setup):

```bash
createdb fantasy_bball
```

Run migrations:

```bash
alembic upgrade head
```

Pull real data from nba_api and load it into the database:

```bash
python -m app.ingestion.sync_players
```

Run the API:

```bash
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API docs (Swagger UI, generated automatically from the FastAPI routes and Pydantic schemas).

## Tests

```bash
pytest
```

Tests run against a local throwaway SQLite file, not your real Postgres database, so they're safe to run anytime.

## Project layout

- `app/core/` — config and database setup, nothing feature-specific lives here
- `app/models/` — SQLAlchemy ORM models (the source of truth for table structure)
- `app/schemas/` — Pydantic models defining API request/response shapes
- `app/api/v1/` — route handlers, one file per resource
- `app/services/data_providers/` — the provider abstraction; swap or add a data source here without touching anything else
- `app/ingestion/` — standalone scripts that pull external data into the DB
- `alembic/` — database migration history
