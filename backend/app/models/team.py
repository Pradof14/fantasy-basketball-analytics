from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # ID from the external data provider (e.g. nba_api / balldontlie).
    # Kept separate from our own primary key so we can swap providers
    # later without breaking foreign keys elsewhere in the schema.
    external_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)

    name: Mapped[str] = mapped_column(String(100))
    abbreviation: Mapped[str] = mapped_column(String(3))
    conference: Mapped[str] = mapped_column(String(20), nullable=True)
    division: Mapped[str] = mapped_column(String(20), nullable=True)

    players: Mapped[list["Player"]] = relationship(back_populates="team")

    def __repr__(self) -> str:
        return f"<Team {self.abbreviation}>"
