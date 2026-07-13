"""
NBADataProvider implementation backed by the `nba_api` package, which
wraps stats.nba.com.

Milestone 1 only needs `static` data (teams + player roster), which
nba_api ships as bundled, pre-scraped data -- no live HTTP calls, no
rate limits, and no risk of stats.nba.com blocking us during
development. Richer per-player data (position, height, weight, etc.)
comes from `commonplayerinfo`, a live endpoint we'll wire up in a
later milestone once we're also pulling season stats and want to
batch those calls together.
"""
from nba_api.stats.static import players as nba_static_players
from nba_api.stats.static import teams as nba_static_teams

from app.services.data_providers.base import NBADataProvider, RawPlayer, RawTeam

# nba_api's static team data doesn't include conference/division, so we
# maintain this small lookup ourselves. It rarely changes (only on
# relocation/expansion), so a static mapping is simpler than an extra
# live API call for Milestone 1.
_CONFERENCE_DIVISION: dict[str, tuple[str, str]] = {
    "ATL": ("East", "Southeast"), "BOS": ("East", "Atlantic"), "BKN": ("East", "Atlantic"),
    "CHA": ("East", "Southeast"), "CHI": ("East", "Central"), "CLE": ("East", "Central"),
    "DAL": ("West", "Southwest"), "DEN": ("West", "Northwest"), "DET": ("East", "Central"),
    "GSW": ("West", "Pacific"), "HOU": ("West", "Southwest"), "IND": ("East", "Central"),
    "LAC": ("West", "Pacific"), "LAL": ("West", "Pacific"), "MEM": ("West", "Southwest"),
    "MIA": ("East", "Southeast"), "MIL": ("East", "Central"), "MIN": ("West", "Northwest"),
    "NOP": ("West", "Southwest"), "NYK": ("East", "Atlantic"), "OKC": ("West", "Northwest"),
    "ORL": ("East", "Southeast"), "PHI": ("East", "Atlantic"), "PHX": ("West", "Pacific"),
    "POR": ("West", "Northwest"), "SAC": ("West", "Pacific"), "SAS": ("West", "Southwest"),
    "TOR": ("East", "Atlantic"), "UTA": ("West", "Northwest"), "WAS": ("East", "Southeast"),
}


class NbaApiProvider(NBADataProvider):
    def get_all_teams(self) -> list[RawTeam]:
        raw_teams = nba_static_teams.get_teams()
        result: list[RawTeam] = []
        for t in raw_teams:
            conference, division = _CONFERENCE_DIVISION.get(t["abbreviation"], (None, None))
            result.append(
                RawTeam(
                    external_id=t["id"],
                    name=t["full_name"],
                    abbreviation=t["abbreviation"],
                    conference=conference,
                    division=division,
                )
            )
        return result

    def get_all_players(self) -> list[RawPlayer]:
        raw_players = nba_static_players.get_active_players()
        result: list[RawPlayer] = []
        for p in raw_players:
            result.append(
                RawPlayer(
                    external_id=p["id"],
                    first_name=p["first_name"],
                    last_name=p["last_name"],
                    # Position isn't in static data; populated in a later
                    # milestone via the commonplayerinfo live endpoint.
                    position=None,
                    # Team isn't in static player data either -- Milestone 2's
                    # roster sync (via commonteamroster) will backfill this.
                    team_external_id=None,
                )
            )
        return result
