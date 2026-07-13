# Milestone Log

## Milestone 1 — Foundation (done)
Goal: prove the full stack end-to-end with one real feature — a searchable,
paginated player list backed by real NBA data.

Delivered:
- `teams` and `players` tables (normalized, via Alembic migration)
- `NBADataProvider` interface + `NbaApiProvider` implementation (swappable data source)
- Ingestion script (`app/ingestion/sync_players.py`) pulling real teams/players from nba_api
- REST API: `GET /api/v1/players` (paginated, searchable, filterable by team), `GET /api/v1/players/{id}`, `GET /api/v1/teams`
- React + TypeScript frontend: searchable, paginated Players page
- API tests covering listing, name search, and 404 handling

Known limitations (intentional, addressed in later milestones):
- Player `position` and `team` are not populated yet — nba_api's static roster data
  doesn't include them; a live `commonplayerinfo` / `commonteamroster` call is needed,
  which we're deferring to the milestone where we also pull season stats (so those
  live calls can be batched together instead of done twice).

## Milestone 2 — planned
Game stats, season averages, and the Player Dashboard.
