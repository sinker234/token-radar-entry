# token-radar-entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sinker234/token-radar-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sinker234/token-radar-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads the competition's sealed DefiLlama snapshot (758 protocols, 40 on the house watchlist), ranks 154 protocols that record no token by an implied value, and hands the reader a farm plan for each. The implied value is a peer-multiple model: each protocol is priced from the median market-cap-to-TVL ratio of its category's live-token peers in the same snapshot (shrunk toward the universe median, with the universe's stats used outright when a category has fewer than three live peers), adjusted for its own seven-day TVL momentum, its age with no token, and its chain breadth. Wrapped, staked and bridged pass-through products are not ranked: their TVL is a claim on a token that already trades. The dashboard is a static dark console with a sortable, filterable board, a per-protocol detail view showing every factor of its number, a live-token view set apart from the ranking, and the peer table the model prices from. Every figure comes from the snapshot; the model names no protocol and predicts no launch.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22.18 or later, standard library only. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`, byte for byte the same on every run. The screenshots were rendered from the built dashboard with `shoot.py` (a local static server plus a headless browser).

---

<sub>Entered on [make.fun](https://make.fun/?ref=coral-owl-12&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
