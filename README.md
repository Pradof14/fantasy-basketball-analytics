# Fantasy Hoops Calculator

Rank NBA players for your league's exact scoring, punt categories, and find out who wins a trade before you hit accept.

**Live app:** https://juanprado.dev/fantasy-basketball-analytics/

It runs entirely in the browser, needs no account, and refreshes its stats every morning.

## What it does

- **Rankings for your league.** Points or categories, ESPN/Yahoo presets or your own per-stat weights, any number of teams and roster spots. Rankings recompute instantly as you change settings.
- **Punt builds.** Turn off any category (say, FT% and TO) and every player is re-ranked for that build.
- **Trade analyzer.** Add players to each side and get a verdict, the net value change, and a per-category breakdown. It correctly handles uneven trades, like 2-for-1s (see below).
- **My team.** Save your roster to see its category profile, its weakest spots, and waiver-level players who fix them.
- **Early-season projection.** A few games of box scores is mostly noise, so the default view blends this season into last season and leans on the new season as games accumulate.
- **Bring your own data.** Import any per-game CSV, such as a Basketball Reference export or your own projections.
- Player profiles, a watchlist, position filters, and sortable columns. Everything is saved in your browser.

## How the numbers work

**Points leagues.** Fantasy points per game is each stat times its weight, summed. "Value over replacement" compares a player to the average of the players just past your league's draft line (teams × roster spots). That's who you could actually pick up for free.

**Category leagues.** Each category is turned into a z-score: how many standard deviations a player sits above the average *rostered* player. Two details matter:

1. *The comparison pool.* Measuring against all ~500 NBA players would let hundreds of bench players drag the averages down and inflate everyone. The calculator finds the pool in two passes: first the top 2N players by minutes, then the top N by first-pass value, where N is the number of rostered players in your league.
2. *Percentages are weighted by volume.* A 70% shooter on 2 attempts barely moves a fantasy team's FG%, while a 55% shooter on 20 attempts moves it a lot. So FG% and FT% are scored as *impact*: makes above what an average shooter in the pool would hit on the same attempts.

Turnovers are negated (fewer is better), and a player's total is the sum across the categories you count.

**Season blending.** The projection weights this season by `games / (games + 15)`. A player 5 games in counts 25% this season and 75% last season. By 45 games it's 75/25. Rookies use this season only, and players who haven't played yet keep last season's line, with a "Not played" tag.

**Uneven trades.** If you send 2 players and get 1 back, you haven't lost the second player's full value: you can fill the open roster spot off waivers. The analyzer credits each opened spot with replacement-level value, and charges the same when you take on more players than you send, since you'd have to cut someone.

## Architecture

```
pipeline/          Python: scrape per-game stats, clean, write JSON
  build_dataset.py
  tests/           parser tests against a saved page fixture
public/data/       players.json, refreshed daily by GitHub Actions
src/
  engine/          pure TypeScript: scoring, z-scores, blending, trades, CSV import
    engine.test.ts unit tests for the math
  components/      React UI: rankings, trade analyzer, my team, player drawer
  lib/             data loading, formatting, persisted state
.github/workflows/ nightly data refresh and deploy to GitHub Pages
```

The calculation engine has no UI dependencies, so it's unit tested on its own and could back an API or a different frontend unchanged.

**Why no backend?** An earlier version of this repo used FastAPI and PostgreSQL. For a calculator, every query is "rank about 500 players under these settings", which takes a few milliseconds in the browser. Moving it client-side made the app instant, free to host, and impossible to take down with a cold-starting server. The Python side still does the data engineering: fetching, cleaning, and publishing a versioned dataset on a schedule.

**Why Basketball Reference?** `stats.nba.com` blocks most cloud IP ranges, including GitHub Actions, so a nightly job built on it fails silently. Basketball Reference serves stable HTML tables. The job makes two requests a day, well under their rate limit. If a fetch fails, the previous day's data stays live.

## Run it locally

You need Node 20+ and Python 3.10+.

```bash
# 1. Get the data
python3 -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt
python pipeline/build_dataset.py        # writes public/data/players.json

# 2. Run the app
npm install
npm run dev                              # http://localhost:5173
```

Tests: `npm test` (engine) and `python -m pytest pipeline` (data parser). Type check: `npm run typecheck`.

## Deploying

1. Push to `main`.
2. In the repo on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The *Refresh data and deploy* workflow builds and publishes the site. It also runs every morning to pull the latest stats, and you can trigger it by hand from the **Actions** tab.

## Limitations

- Season averages can't capture double-double or triple-double bonuses, or week-to-week schedule volume.
- The trade analyzer values players, not lineups. It doesn't know your league's starting slots or who's actually on waivers.
- Stats come from Basketball Reference and are for personal, non-commercial use.

Built by Juan Prado, MIS @ University of Houston.
