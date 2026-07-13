from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import players, teams
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Fantasy Basketball Analytics API",
    description="NBA player, team, and fantasy analytics platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix=settings.api_v1_prefix)
app.include_router(teams.router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
