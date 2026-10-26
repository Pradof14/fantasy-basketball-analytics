"""
Build the player dataset the web app reads.

Pulls per-game stats from Basketball Reference for the previous season and the
current season, cleans them into one consistent shape, and writes
`public/data/players.json`.

Why Basketball Reference instead of stats.nba.com?
  stats.nba.com blocks most cloud IP ranges (including GitHub Actions), so a
  nightly job that depends on it fails silently. Basketball Reference serves
  plain HTML tables, tolerates light scraping (we make 2 requests a night, far
  under their 20/minute limit), and its column ids (`data-stat`) are stable.

Usage:
    python pipeline/build_dataset.py                      # live fetch
    python pipeline/build_dataset.py --season-end 2027    # pick seasons explicitly
    python pipeline/build_dataset.py --html 2027=page.html --html 2026=old.html
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Comment

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "public" / "data" / "players.json"
BBREF_URL = "https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html"
HEADERS = {"User-Agent": "Mozilla/5.0 (fantasy-basketball-calculator data job)"}

# Basketball Reference renamed some data-stat ids in 2024. Each field lists
# every id we've seen, newest first, so the parser survives either layout.
FIELD_IDS: dict[str, tuple[str, ...]] = {
    "name": ("name_display", "player"),
    "team": ("team_name_abbr", "team_id"),
    "pos": ("pos",),
    "age": ("age",),
    "gp": ("games",),
    "gs": ("games_started",),
    "min": ("mp_per_g",),
    "fgm": ("fg_per_g",),
    "fga": ("fga_per_g",),
    "tpm": ("fg3_per_g",),
    "tpa": ("fg3a_per_g",),
    "ftm": ("ft_per_g",),
    "fta": ("fta_per_g",),
    "oreb": ("orb_per_g",),
    "dreb": ("drb_per_g",),
    "reb": ("trb_per_g",),
    "ast": ("ast_per_g",),
    "stl": ("stl_per_g",),
    "blk": ("blk_per_g",),
    "tov": ("tov_per_g",),
    "pf": ("pf_per_g",),
    "pts": ("pts_per_g",),
}
NUMERIC = [k for k in FIELD_IDS if k not in ("name", "team", "pos")]
# Rows like "2TM"/"3TM" (or "TOT" on older pages) are a traded player's
# combined line; the per-team rows that follow are partial seasons.
COMBINED_TEAM = re.compile(r"^(\dTM|TOT)$")


@dataclass
class PlayerSeason:
    id: str
    name: str
    team: str
    pos: str
    age: int
    gp: int
    gs: int
    min: float
    fgm: float
    fga: float
    tpm: float
    tpa: float
    ftm: float
    fta: float
    oreb: float
    dreb: float
    reb: float
    ast: float
    stl: float
    blk: float
    tov: float
    pf: float
    pts: float
    nbaId: int | None = None


def season_label(end_year: int) -> str:
    return f"{end_year - 1}-{str(end_year)[-2:]}"


def current_season_end(today: dt.date | None = None) -> int:
    """NBA seasons start in October; from October on we're in next year's season."""
    today = today or dt.date.today()
    return today.year + 1 if today.month >= 10 else today.year


def fetch_html(year: int, retries: int = 3) -> str:
    url = BBREF_URL.format(year=year)
    for attempt in range(1, retries + 1):
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code == 200:
            resp.encoding = "utf-8"
            return resp.text
        if resp.status_code == 404:
            raise FileNotFoundError(f"No page yet for {season_label(year)} ({url})")
        wait = 10 * attempt
        print(f"  {url} -> HTTP {resp.status_code}, retrying in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts")


def _cell(row, field: str):
    for stat_id in FIELD_IDS[field]:
        cell = row.find(["td", "th"], attrs={"data-stat": stat_id})
        if cell is not None:
            return cell
    return None


def _num(text: str) -> float:
    text = (text or "").strip()
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _find_table(soup: BeautifulSoup):
    table = soup.find("table", id="per_game_stats")
    if table is not None:
        return table
    # Some Basketball Reference tables ship inside HTML comments.
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        if 'id="per_game_stats"' in comment:
            return BeautifulSoup(comment, "lxml").find("table", id="per_game_stats")
    return None


def parse_per_game(html: str) -> list[PlayerSeason]:
    soup = BeautifulSoup(html, "lxml")
    table = _find_table(soup)
    if table is None:
        raise ValueError("per_game_stats table not found -- page layout may have changed")

    players: dict[str, PlayerSeason] = {}
    order: list[str] = []
    for row in table.select("tbody tr"):
        if "thead" in (row.get("class") or []):
            continue  # repeated header rows mid-table
        name_cell = _cell(row, "name")
        if name_cell is None:
            continue
        name = name_cell.get_text(strip=True).rstrip("*")
        if not name or name == "League Average":
            continue
        pid = name_cell.get("data-append-csv") or _slug(name)
        team_cell = _cell(row, "team")
        team = team_cell.get_text(strip=True) if team_cell else ""

        if pid in players:
            # Per-team row after a combined row. Rows are chronological, so the
            # last one we see is the team the player is on now.
            if not COMBINED_TEAM.match(team):
                players[pid].team = team
            continue

        values = {}
        for field in NUMERIC:
            cell = _cell(row, field)
            values[field] = _num(cell.get_text() if cell else "")
        pos_cell = _cell(row, "pos")
        players[pid] = PlayerSeason(
            id=pid,
            name=name,
            team=team,
            pos=(pos_cell.get_text(strip=True) if pos_cell else ""),
            age=int(values.pop("age")),
            gp=int(values.pop("gp")),
            gs=int(values.pop("gs")),
            **{k: round(v, 2) for k, v in values.items()},
        )
        order.append(pid)

    return [players[pid] for pid in order if players[pid].gp > 0]


def _slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def attach_nba_ids(players: list[PlayerSeason]) -> None:
    """Best effort: map names to NBA.com ids so the app can show headshots.

    nba_api ships its player list inside the package, so this makes no network
    calls. If it isn't installed, the app falls back to initials.
    """
    try:
        from nba_api.stats.static import players as nba_players
    except ImportError:
        print("  nba_api not installed; skipping headshot ids", file=sys.stderr)
        return
    lookup: dict[str, int] = {}
    for p in nba_players.get_players():
        lookup.setdefault(_name_key(p["full_name"]), p["id"])
    for p in players:
        p.nbaId = lookup.get(_name_key(p.name))


def _name_key(name: str) -> str:
    key = _slug(name).replace("-", "")
    return re.sub(r"(jr|sr|ii|iii|iv)$", "", key)


def build(seasons: list[int], html_overrides: dict[int, str]) -> dict:
    out: dict = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "Basketball Reference per-game stats",
        "seasons": [],
    }
    for i, year in enumerate(seasons):
        label = season_label(year)
        try:
            if year in html_overrides:
                html = Path(html_overrides[year]).read_text(encoding="utf-8")
            else:
                if i:
                    time.sleep(4)  # be polite between requests
                html = fetch_html(year)
            rows = parse_per_game(html)
        except FileNotFoundError as exc:
            print(f"  skipping {label}: {exc}", file=sys.stderr)
            continue
        attach_nba_ids(rows)
        print(f"  {label}: {len(rows)} players")
        out["seasons"].append(
            {"id": str(year), "label": label, "players": [asdict(r) for r in rows]}
        )
    if not out["seasons"]:
        raise SystemExit("No season data collected; not overwriting the existing file.")
    return out


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--season-end", type=int, default=current_season_end(),
                        help="end year of the current season (2027 = 2026-27)")
    parser.add_argument("--html", action="append", default=[], metavar="YEAR=PATH",
                        help="parse a saved page instead of fetching (repeatable)")
    parser.add_argument("--out", type=Path, default=OUT_PATH)
    args = parser.parse_args(argv)

    overrides = {}
    for item in args.html:
        year, _, path = item.partition("=")
        overrides[int(year)] = path

    # Previous season first so the app's default "last full season" is stable.
    seasons = [args.season_end - 1, args.season_end]
    data = build(seasons, overrides)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out}")


if __name__ == "__main__":
    main()
