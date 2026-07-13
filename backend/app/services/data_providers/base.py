"""
Provider-agnostic interface for pulling NBA data.

Why this exists: we're starting with nba_api (free, rich data, but an
unofficial wrapper around stats.nba.com that can break or get rate
limited without notice). By coding the rest of the app against this
interface instead of against nba_api directly, swapping in balldontlie
or a paid provider later means writing ONE new class here -- nothing
in the ingestion scripts, API routes, or database layer has to change.

Every concrete provider (NbaApiProvider, BallDontLieProvider, ...)
implements this same contract and returns the same normalized shape,
regardless of how wildly different the underlying API responses are.
"""
from abc import ABC, abstractmethod
from typing import TypedDict


class RawTeam(TypedDict):
    external_id: int
    name: str
    abbreviation: str
    conference: str | None
    division: str | None


class RawPlayer(TypedDict):
    external_id: int
    first_name: str
    last_name: str
    position: str | None
    team_external_id: int | None


class NBADataProvider(ABC):
    """Contract every concrete data source must fulfill."""

    @abstractmethod
    def get_all_teams(self) -> list[RawTeam]:
        """Return every NBA team, normalized to RawTeam shape."""
        raise NotImplementedError

    @abstractmethod
    def get_all_players(self) -> list[RawPlayer]:
        """Return all active players, normalized to RawPlayer shape."""
        raise NotImplementedError
