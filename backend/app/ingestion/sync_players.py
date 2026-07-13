"""
Pulls teams and players from the configured NBADataProvider and upserts
them into the database.

Run with:
    python -m app.ingestion.sync_players

This is deliberately a standalone script (not an API endpoint) --
ingestion is an operational task you run on a schedule or manually,
not something a client should be able to trigger over HTTP.
"""
from app.core.database import SessionLocal
from app.models.player import Player
from app.models.team import Team
from app.services.data_providers.nba_api_provider import NbaApiProvider


def sync_teams(db, provider) -> dict[int, int]:
    """
    Upserts teams and returns a mapping of {external_id: internal_id}
    so sync_players can resolve foreign keys.
    """
    external_to_internal: dict[int, int] = {}

    for raw in provider.get_all_teams():
        team = db.query(Team).filter_by(external_id=raw["external_id"]).one_or_none()
        if team is None:
            team = Team(external_id=raw["external_id"])
            db.add(team)

        team.name = raw["name"]
        team.abbreviation = raw["abbreviation"]
        team.conference = raw["conference"]
        team.division = raw["division"]

        db.flush()  # populate team.id without committing yet
        external_to_internal[raw["external_id"]] = team.id

    db.commit()
    print(f"Synced {len(external_to_internal)} teams.")
    return external_to_internal


def sync_players(db, provider, team_id_map: dict[int, int]) -> int:
    count = 0
    for raw in provider.get_all_players():
        player = db.query(Player).filter_by(external_id=raw["external_id"]).one_or_none()
        if player is None:
            player = Player(external_id=raw["external_id"])
            db.add(player)

        player.first_name = raw["first_name"]
        player.last_name = raw["last_name"]
        player.position = raw["position"]
        player.team_id = (
            team_id_map.get(raw["team_external_id"]) if raw["team_external_id"] else None
        )
        count += 1

    db.commit()
    print(f"Synced {count} players.")
    return count


def main() -> None:
    provider = NbaApiProvider()
    db = SessionLocal()
    try:
        team_id_map = sync_teams(db, provider)
        sync_players(db, provider, team_id_map)
    finally:
        db.close()


if __name__ == "__main__":
    main()
