# token-radar-entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sinker234/token-radar-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sinker234/token-radar-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads the competition's sealed DefiLlama snapshot (758 protocols, 40 on the house watchlist), ranks 204 protocols that record no token by an implied value, and hands the reader a farm plan for each. The implied value comes from value terms fitted by Huber regression on the snapshot's 128 live-token protocols — log market cap on log TVL, log age and log chain count, plus a shrunk category effect applied only where a category has at least three live peers — adjusted for each protocol's own seven-day TVL momentum; the range on each row is the spread its peer set actually trades at. Versioned names are ranked when the protocol has no unversioned record in the snapshot (RocketSwap Anubis V2, a $350M DEX with no token, ranks 9th); five versioned records are excluded on verified evidence that the token already exists. Wrapped, staked and bridged pass-through products are not ranked: their TVL is a claim on a token that already trades. Held out, the fitted terms beat the peer-median model they replace: leave-one-out median error factor 3.69x (was 5.24x), and two walk-forward splits 4.99x and 5.80x (was 5.06x and 9.33x). The dashboard is a static dark console with a sortable, filterable board, a per-protocol detail view showing every factor of its number, a live-token view set apart from the ranking, and the full peer table behind the range. Every figure comes from the snapshot; the model names no protocol and predicts no launch.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22.18 or later, standard library only. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`, byte for byte the same on every run. The screenshots were rendered from the built dashboard with `shoot.py` (a local static server plus a headless browser).

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c94brae&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
