# Sports Dashboard — Live Football, Cricket & Formula 1

A single-point, broadcast-standard **Sports Dashboard** displaying live **Football / Soccer**, **Cricket**, and **Formula 1** in one unified view, anchored by a pinned bottom scrolling live-updates ticker.

## Quick Start (Zero Dependencies)

### Recommended — Live Data Mode (`Launch-Dashboard.bat`)
Double-click `Launch-Dashboard.bat` (or run `powershell -ExecutionPolicy Bypass -File .\start-dashboard.ps1`) to launch the local server and live API proxy at `http://127.0.0.1:8080/`.

The dashboard opens directly in **LIVE** mode and connects automatically to:
- **Football / Soccer**: ESPN live scoreboards (`Premier League`, `Champions League`, `La Liga`, `Serie A`, `Bundesliga`, plus Global fallback), live match summaries (possession, shots, key events timeline, live commentary, lineups), and soccer news wire.
- **Cricket**: Multi-tier live integration via ESPNcricinfo consumer scores, ESPNcricinfo live RSS (`livescores.xml`), ESPN Cricket scoreboard/news, and optional CricketData/CricAPI key support in **⚙ Feeds**.
- **Formula 1**: OpenF1 session telemetry (driver positions, gaps, last lap, fastest lap purple indicator, Pirelli tyre compounds & stint ages, pit counts, Race Control flags, track/air weather), with Jolpica-F1 and ESPN F1 fallbacks + F1 news wire.

### Instant Offline / Simulation Mode
Double-click `index.html` to inspect or demo offline. If live feeds are unreachable or CORS-blocked without the local launcher, the dashboard falls back automatically to the built-in real-time **SIM** Matchday Simulator.

## Controls & Shortcuts
- **Top Bar**: Switch between `All Sports`, `⚽ Football`, `🏏 Cricket`, and `🏎️ Formula 1` (or press `1`–`4`), toggle `LIVE` / `SIM`, force refresh with `↻ Sync`, configure poll intervals or optional CricAPI key in `⚙ Feeds`, and toggle Dark/Light themes.
- **Bottom Scrolling Ticker**: Hover to pause, use `Pause`/`Play`, cycle scroll speed (`1x`, `1.5x`, `0.75x`), filter ticker items by sport (`ALL`, `⚽`, `🏏`, `🏎️`), or click any scrolling update to open its live detail modal.
