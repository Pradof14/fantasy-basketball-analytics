from pydantic import BaseModel, ConfigDict


class TeamOut(BaseModel):
    """What we return to the client for a team."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    abbreviation: str
    conference: str | None = None
    division: str | None = None
