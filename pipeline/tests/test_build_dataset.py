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


INJURY_FIXTURE = Path(__file__).parent / "fixtures" / "injuries_sample.html"


@pytest.fixture(scope="module")
def injuries():
    from pipeline.build_dataset import parse_injuries
    return {i.id: i for i in parse_injuries(INJURY_FIXTURE.read_text(encoding="utf-8"))}


def test_parses_injury_rows(injuries):
    assert len(injuries) == 5
    gueye = injuries["gueyemo02"]
    assert (gueye.name, gueye.team, gueye.status, gueye.label) == ("Mouhamed Gueye", "ATL", "out", "Out")
    assert gueye.injury == "Foot" and gueye.updated == "2026-07-15"
    assert gueye.note.startswith("The Hawks said")


def test_injury_statuses(injuries):
    assert injuries["veesahe01"].status == "out-season"
    assert injuries["veesahe01"].injury == "ACL"
    assert injuries["bilodty01"].status == "dtd"
    assert injuries["bilodty01"].label == "Day To Day"


def test_injury_table_inside_comment():
    from pipeline.build_dataset import parse_injuries
    html = INJURY_FIXTURE.read_text(encoding="utf-8")
    start, end = html.index("<table"), html.index("</table>") + len("</table>")
    commented = html[:start] + "<!--" + html[start:end] + "-->" + html[end:]
    assert len(parse_injuries(commented)) == 5


def test_failed_injury_fetch_keeps_last_report(tmp_path):
    import json
    from pipeline.build_dataset import keep_previous_injuries
    old = tmp_path / "players.json"
    old.write_text(json.dumps({"generatedAt": "2026-10-26T11:00:00+00:00", "injuries": [{"id": "x"}]}))
    data = {"generatedAt": "2026-10-27T11:00:00+00:00", "seasons": []}
    keep_previous_injuries(data, old)
    assert data["injuries"] == [{"id": "x"}]
    assert data["injuriesUpdatedAt"] == "2026-10-26T11:00:00+00:00"
