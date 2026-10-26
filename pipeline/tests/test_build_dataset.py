from pathlib import Path

import pytest

from pipeline.build_dataset import current_season_end, parse_per_game, season_label

FIXTURE = Path(__file__).parent / "fixtures" / "per_game_sample.html"


@pytest.fixture(scope="module")
def players():
    return {p.id: p for p in parse_per_game(FIXTURE.read_text(encoding="utf-8"))}


def test_parses_core_line(players):
    jokic = players["jokicni01"]
    assert jokic.name == "Nikola Jokić"
    assert (jokic.team, jokic.pos, jokic.gp) == ("DEN", "C", 70)
    assert jokic.pts == 30.1 and jokic.reb == 12.8 and jokic.ast == 10.4
    assert jokic.tpm == 1.9 and jokic.fta == 7.1


def test_traded_player_keeps_combined_line_and_latest_team(players):
    doe = players["doejo01"]
    assert doe.gp == 60 and doe.pts == 14.0  # combined season, not a partial
    assert doe.team == "HOU"  # last team listed


def test_skips_header_rows_league_average_and_zero_games(players):
    assert "LA" not in players
    assert "roebo01" not in players
    assert len(players) == 3


def test_blank_cells_become_zero(players):
    assert players["smithal01"].tpm == 0.0


def test_strips_hall_of_fame_asterisk():
    html = FIXTURE.read_text(encoding="utf-8").replace('"0","0"', '"5","0"')
    assert all(not p.name.endswith("*") for p in parse_per_game(html))


def test_season_helpers():
    import datetime as dt
    assert season_label(2027) == "2026-27"
    assert current_season_end(dt.date(2026, 10, 26)) == 2027
    assert current_season_end(dt.date(2027, 3, 1)) == 2027
