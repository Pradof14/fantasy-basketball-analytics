from pydantic import BaseModel, ConfigDict

from app.schemas.team import TeamOut


class PlayerOut(BaseModel):
    """What we return to the client for a single player."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    position: str | None = None
    team: TeamOut | None = None


class PaginatedPlayers(BaseModel):
    """
    Standard pagination envelope. Every list endpoint in this API returns
    data in this shape so the frontend has one predictable pattern to
    handle pagination, regardless of which resource it's fetching.
    """

    items: list[PlayerOut]
    total: int
    page: int
    page_size: int
