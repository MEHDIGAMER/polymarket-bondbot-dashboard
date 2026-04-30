# BondBot Dashboard

Native Electron desktop app for monitoring the Polymarket bond bot live.

![dark dashboard with KPIs, OKR gates, equity curve, open & closed position tables, scan history]

## What it shows

- **6 KPI cards** — Total P&L, Win rate, Avg return, Resolved positions, Open positions, Mode
- **3 OKR gates** — the validation criteria for promoting from PAPER → LIVE capital (≥50 resolved · ≥94% win rate · ≥4.5% avg return)
- **Equity curve** — cumulative P&L over time, custom canvas chart
- **Open positions** — live list of paper bonds you're holding
- **Recent closed** — wins / losses / stop-loss outcomes with P&L
- **Scan history** — last 20 loops, markets seen, candidates, opens, capital used
- **Top skip reasons** — why markets got rejected (24h)
- **Operational config** — read-only snapshot of risk parameters

Auto-refresh every 5 seconds. No frameworks.

## Run from source

```bash
cd ~/Projects/polymarket-dashboard
npm install
npm start
```

On first launch click ⚙ **settings** and paste:

- **API URL:** `http://204.168.195.17:8001`
- **API Key:** the contents of `/opt/bondbot/data/api.key` on the VPS
  (one-liner: `ssh root@204.168.195.17 'cat /opt/bondbot/data/api.key'`)

## Build a Windows .exe

```bash
npm run build:win
```

Output at `dist/BondBot Dashboard Setup *.exe` — that's the installer you double-click.

## Build a macOS .dmg

```bash
npm run build:mac
```

## How it talks to the bot

The bot runs a tiny stdlib HTTP server on `:8001` of the Hetzner VPS with Bearer-token auth. The dashboard polls these endpoints:

| Endpoint | Returns |
|---|---|
| `GET /health` | liveness (no auth) |
| `GET /stats` | KPIs (all-time, 24h, 7d) |
| `GET /positions?status=OPEN` | live paper positions |
| `GET /positions?status=ALL` | recent closed |
| `GET /scans?limit=20` | scan-loop history |
| `GET /skips` | top skip reasons last 24h |
| `GET /equity` | cumulative P&L curve |
| `GET /config` | risk parameters |

All endpoints are read-only. Order placement is never exposed via HTTP.
