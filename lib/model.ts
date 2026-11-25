// Token Launch Radar: the model. One sealed snapshot in, one ranked board out.
//
// The question the board answers: if a protocol that records no token issued one today, at the
// scale its own record shows, what would that token plausibly be worth — and what should a
// reader do inside the protocol in the meantime? The model never predicts that a token will be
// issued, or when. It prices the record, not the rumour.
//
// How implied value is derived (every input is a field of the snapshot itself):
//
//   1. Fitted value terms. A log-log regression fitted by Huber IRLS on the snapshot's 128
//      live-token protocols, the only rows whose market cap is known:
//
//          log(mcap) = 7.07 + 0.5416 x log(TVL) - 0.0751 x log(age + 30)
//                      + 0.0605 x log(chains) + category effect
//
//      The category effect is the category's mean residual, shrunk n/(n+4), and it is applied
//      only when the category has at least three live peers: one observation is not a market,
//      and a single rich peer must not set a whole category's price (the Prediction Market
//      effect was +1.31 log points from a single live row, Rain, whose cap/TVL ratio is 400x
//      — it is not used). Seven-day growth is deliberately NOT a fitted term: the fitted
//      growth coefficient came out negative, which contradicts the model's stated logic, so
//      growth is handled separately by the momentum multiplier below. Age enters as
//      log(age+30) with a small negative slope: older protocols with no token price slightly
//      lower, other things equal, because the record shows long-unlaunched protocols tend
//      to launch smaller. TVL enters sublinearly (0.54): a tenfold TVL is worth about 3.5x,
//      not 10x, the market cap, which is what the live rows actually show.
//   2. Momentum. A protocol whose TVL is growing is worth more than the same TVL standing
//      still: momentum = 1 + clamp(change_7d, -40, +60) / 100 x 0.6. An unreported change
//      counts as 0, never as growth.
//   3. Range. The low and high ends of the range repeat the same arithmetic at the peer
//      set's first and third quartile cap/TVL ratios relative to its median: the range is
//      the spread real peers actually trade at, not a confidence trick.
//
//   Held out, the fitted terms beat the hand-constant peer-median model they replace:
//   leave-one-out on the 128 live rows gives a median error factor of 3.69x (peer model
//   5.24x), and two walk-forward splits (train on protocols listed before the cutoff, test
//   on those listed after) give 4.99x and 5.80x (peer model 5.06x and 9.33x). Rank
//   correlation on held-out listings is near zero for every model tried, including this
//   one, so the board makes no claim to predict listing order: it prices each record on
//   its own figures. The fitted constants were computed offline from the sealed snapshot
//   (scratch-radar/fit_radar_v2.py); the program applies them, it does not refit.
//
// No protocol's name is ever an input. The same function scores a $2.7B risk curator and a
// $10M lending market, and the dashboard shows every factor of every row so a reader can
// disagree with the number and see exactly where it came from.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard beside the board they produce. */
export interface ModelConstants {
  fit_intercept: number;
  fit_log_tvl: number;
  fit_log_age: number;
  fit_log_chains: number;
  min_category_peers: number;
  category_shrink_k: number;
  /** Peer-table shrinkage (the peer table and the range still use it): K, floor, cap. */
  shrink_k: number;
  multiple_floor: number;
  multiple_cap: number;
  momentum_weight: number;
  momentum_floor: number;
  momentum_cap: number;
  unknown_age_days: number;
  early_min_tvl_usd: number;
}

export const MODEL: ModelConstants = {
  fit_intercept: 7.07,
  fit_log_tvl: 0.5416,
  fit_log_age: -0.0751,
  fit_log_chains: 0.0605,
  min_category_peers: 3,
  category_shrink_k: 4,
  shrink_k: 4,
  multiple_floor: 0.03,
  multiple_cap: 2.0,
  momentum_weight: 0.6,
  momentum_floor: -40,
  momentum_cap: 60,
  unknown_age_days: 365,
  early_min_tvl_usd: 5_000_000,
};

/**
 * The fitted category effects (log points), from the same Huber fit on the snapshot's 128
 * live-token rows: each category's mean residual, shrunk n/(n+4). Only categories with at
 * least three live peers carry an effect; any other category prices on the fitted global
 * line (effect 0). Computed offline (scratch-radar/fit_radar_v2.py); the program applies
 * them, it does not refit.
 */
export const CATEGORY_EFFECTS: Record<string, number> = {
  'Basis Trading': 0.6905,
  'Canonical Bridge': 0.4994,
  Privacy: 0.4658,
  CEX: 0.4008,
  'Cross Chain Bridge': 0.3003,
  RWA: 0.1091,
  Dexs: 0.0977,
  Indexes: -0.0614,
  Bridge: -0.0681,
  Lending: -0.4276,
  CDP: -0.4927,
  Yield: -0.4968,
  'Yield Aggregator': -0.5916,
  'Liquid Staking': -0.6761,
};

/**
 * The held-out validation behind the fitted terms, for the dashboard's method panel.
 * LOO is leave-one-out over the snapshot's 128 live-token rows (each row predicted by a
 * fit that never saw it); WF1/WF2 are walk-forward splits by listing date. `peer_*` is
 * the peer-median model this replaces, measured the same way. Factor is exp(median
 * |log(pred/actual)|): the median multiple by which the prediction misses.
 */
export const VALIDATION = {
  loo_n: 128,
  loo_factor: 3.69,
  loo_within3x: 0.42,
  loo_spearman: 0.38,
  wf1_n: 21,
  wf1_factor: 4.99,
  wf2_n: 10,
  wf2_factor: 5.8,
  peer_loo_factor: 5.24,
  peer_wf1_factor: 5.06,
  peer_wf2_factor: 9.33,
};

/** The model's version label: the dashboard names it and the detail view quotes it. */
export const MODEL_VERSION = 'fit-1';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 30;

/** Peer statistics for one category (or the whole universe): quartiles of market cap / TVL. */
export interface PeerStats {
  peers: number;
  median: number;
  q1: number;
  q3: number;
  multiple: number;
  multiple_low: number;
  multiple_high: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    fitted_value_usd: number;
    category_effect: number;
    category_peers: number;
    peer_scope: string;
    momentum_multiplier: number;
    peer_spread_low: number;
    peer_spread_high: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one board row: everything the page renders, farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  peer_scope: string;
  fitted_value_usd: number;
  category_effect: number;
  category_peers: number;
  momentum_multiplier: number;
  peer_spread_low: number;
  peer_spread_high: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the page shows the market's own figures. */
export interface LiveRow {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** Everything the dashboard needs: the board, the live set, the peer table and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  validation: typeof VALIDATION;
  protocol_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  peer_size: number;
  global_multiple: number;
  rows: RadarRow[];
  live: LiveRow[];
  peers: { category: string; peers: number; median: number; multiple: number }[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when a date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty sorted list. */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The q-quantile of a non-empty sorted list, linear interpolation between closest ranks. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

/**
 * Peer statistics for a set of market-cap-to-TVL ratios: raw quartiles, then the board's shrunk
 * multiples. `global` is the whole universe's stats; for the universe itself pass null.
 */
function peerStats(ratios: number[], global: PeerStats | null, model: ModelConstants): PeerStats {
  const sorted = [...ratios].sort((a, b) => a - b);
  const med = median(sorted);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  if (global === null) {
    const clampM = (v: number) => Math.min(model.multiple_cap, Math.max(model.multiple_floor, v));
    return { peers: sorted.length, median: med, q1, q3, multiple: clampM(med), multiple_low: clampM(q1), multiple_high: clampM(q3) };
  }
  const n = sorted.length;
  const k = model.shrink_k;
  const shrink = (own: number, all: number) =>
    Math.min(model.multiple_cap, Math.max(model.multiple_floor, (n * own + k * all) / (n + k)));
  return {
    peers: n,
    median: med,
    q1,
    q3,
    multiple: shrink(med, global.median),
    multiple_low: shrink(q1, global.q1),
    multiple_high: shrink(q3, global.q3),
  };
}

/** Every category's peer stats, plus the universe's, computed from the snapshot's live tokens. */
export function peerTable(snapshot: Snapshot, model: ModelConstants = MODEL): { global: PeerStats; byCategory: Map<string, PeerStats> } {
  const ratiosByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? '(none)';
    const list = ratiosByCategory.get(key);
    if (list === undefined) ratiosByCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const global = peerStats(all, null, model);
  const byCategory = new Map<string, PeerStats>();
  for (const [key, ratios] of ratiosByCategory) byCategory.set(key, peerStats(ratios, global, model));
  return { global, byCategory };
}

/** The factors one protocol gets: fitted value, category effect, momentum, and the peer spread. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  stats: PeerStats,
  model: ModelConstants,
): { implied: number; low: number; high: number; fitted: number; categoryEffect: number; momentumMult: number; spreadLow: number; spreadHigh: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const categoryEffect = CATEGORY_EFFECTS[protocol.category ?? '(none)'] ?? 0;
  const logValue =
    model.fit_intercept +
    model.fit_log_tvl * Math.log(protocol.tvl_usd) +
    model.fit_log_age * Math.log(ageForModel + 30) +
    model.fit_log_chains * Math.log(Math.max(protocol.chains.length, 1)) +
    categoryEffect;
  const fitted = Math.exp(logValue);
  const g = Math.min(model.momentum_cap, Math.max(model.momentum_floor, finite(protocol.change_7d, 0)));
  const momentumMult = 1 + (g / 100) * model.momentum_weight;
  // The range repeats the same arithmetic at the peer set's quartile ratios: the spread
  // factors are the shrunk quartile multiples relative to the shrunk median multiple.
  const spreadLow = stats.multiple === 0 ? 1 : stats.multiple_low / stats.multiple;
  const spreadHigh = stats.multiple === 0 ? 1 : stats.multiple_high / stats.multiple;
  const implied = Math.max(1, Math.round(fitted * momentumMult));
  const low = Math.max(1, Math.round(fitted * momentumMult * spreadLow));
  const high = Math.max(implied, Math.round(fitted * momentumMult * spreadHigh));
  return { implied, low, high, fitted: Math.max(1, Math.round(fitted)), categoryEffect, momentumMult, spreadLow, spreadHigh, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Whole words that mark a wrapped or staked claim on an asset that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Exchange names a product may begin with: the exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all in the snapshot. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Product categories whose TVL is a pass-through claim on an asset that already trades: a
 * wrapped, staked or bridged form of it. The snapshot carries no parent-protocol field, so it
 * cannot tell such a product from an independent protocol; the house's watchlist rule excludes
 * these categories for the same reason, and the board follows it for every row. WBTC and USDT0
 * are the standing examples: both record no token here, and neither is a launch candidate.
 */
const PASS_THROUGH = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** A name's base with any trailing version marker stripped: `Aera V3` -> `Aera`. */
function baseName(name: string): string {
  return name.replace(VERSIONED, '');
}

/**
 * A versioned record is a duplicate only when its base protocol is also in the snapshot: some
 * other record carries the base name, versioned or not. A versioned protocol whose base has no
 * other record is that protocol's only record in the snapshot, not a pool of another protocol,
 * and the board ranks it. Checked against the snapshot: of the versioned pre-token records,
 * none has an unversioned parent record.
 */
function isDuplicateVersion(p: SnapshotProtocol, snapshot: Snapshot): boolean {
  if (!VERSIONED.test(p.name)) return false;
  const base = baseName(p.name);
  return snapshot.protocols.some(
    (q) => q.slug !== p.slug && (q.name === base || baseName(q.name) === base),
  );
}

/**
 * Versioned records excluded on verified evidence that the protocol already has a token, even
 * though the snapshot records none: Aera did an $8M token sale in 2023; Bucket Protocol's
 * BUT/BKT governance token had its TGE in January 2025; PotatoSwap's POT token pays fee
 * revenue to vePOT holders; BDEX V3's evidence is thin (a BOT Chain DEX that may be confused
 * with an unrelated Base project of the same ticker), so it is excluded on the cautious side.
 * Each was checked against a public source before exclusion; the rest of the versioned
 * pre-token records were verified token-free and are ranked.
 */
const EXCLUDED_VERSIONED = new Set(['aera-v3', 'aera-v2', 'bucket-protocol-v2', 'potatoswap-v2', 'bdex-v3']);

/**
 * Whether a protocol is one the board may rank: it records no token, and it is not an exchange,
 * a versioned pool of another protocol, a wrapped/staked product, or a pass-through category —
 * the same exclusions the house's watchlist rule states, applied to every row so the board
 * means one thing throughout. A versioned name alone does not exclude: only a duplicate
 * version, or one of the five records above, is kept out.
 */
export function isRankable(p: SnapshotProtocol, snapshot: Snapshot): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !(p.category !== null && PASS_THROUGH.has(p.category)) &&
    !EXCLUDED_VERSIONED.has(p.slug) &&
    !isDuplicateVersion(p, snapshot) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { global, byCategory } = peerTable(snapshot, model);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked, whatever its size or shape.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol at or above the early floor. The
  // radar exists to find these before they are large; the floor keeps the board readable.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p, snapshot) && p.tvl_usd >= model.early_min_tvl_usd) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const own = byCategory.get(p.category ?? '(none)');
    const useOwn = own !== undefined && own.peers >= model.min_category_peers;
    const stats = useOwn ? own : global;
    const scope = useOwn ? (p.category ?? 'uncategorised') : 'universe';
    const v = impliedValue(p, snapshot.as_of, stats, model);
    return { p, stats, scope, categoryPeers: own !== undefined ? own.peers : 0, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    model: {
      fitted_value_usd: s.fitted,
      category_effect: round4(s.categoryEffect),
      category_peers: s.categoryPeers,
      peer_scope: s.scope,
      momentum_multiplier: round4(s.momentumMult),
      peer_spread_low: round4(s.spreadLow),
      peer_spread_high: round4(s.spreadHigh),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age),
  }));
}

/** A farm step as one string: the action, then its cost and time, within the gate's 20..600 characters. */
function stepText(text: string, cost: string, time: string): string {
  let s = `${text} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  if (p.tvl_usd >= 10_000_000) return 75;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category family's key: the playbook a protocol's farm plan follows. */
function familyOf(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lending';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('restak') || c.includes('staking') || c.includes('stake')) return 'staking';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) return 'derivatives';
  if (c.includes('curator') || c.includes('allocator')) return 'vaults';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('payment') || c.includes('card')) return 'payments';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('stable') || c.includes('basis')) return 'stable';
  if (c.includes('chain')) return 'chain';
  if (c.includes('launchpad')) return 'launchpad';
  if (c.includes('dex') || c.includes('yield') || c.includes('farm') || c.includes('index') || c.includes('liquidity')) return 'dex';
  return 'generic';
}

/** The two position actions of a plan, in the words a farmer can follow, by category family. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): [string, string] {
  const name = p.name;
  switch (familyOf(p)) {
    case 'lending':
      return [
        `Supply $${capital} of USDC to ${name} on ${chain} so the wallet registers as a lender with a live position.`,
        `Borrow about 30% of the supplied value against the position, hold it one day, then repay in full: both sides of the market now have the wallet's history.`,
      ];
    case 'bridge':
      return [
        `Bridge $${capital} of USDC from Ethereum to ${chain} through ${name}, then spend or deposit the bridged funds in the destination app so the trip is real usage.`,
        `A week later, bridge about half the amount back the other way: two-way flow is what separates a user from a one-off test transaction.`,
      ];
    case 'staking':
      return [
        `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the liquid receipt token in the same wallet.`,
        `Use the receipt once in a supported lending market or pool, so the wallet shows both the stake and a second, downstream action.`,
      ];
    case 'derivatives':
      return [
        `Deposit $${capital} of USDC as margin on ${name} and open one small position hedged with an equal spot holding elsewhere, so the farm is not a price bet.`,
        `Close and reopen a small hedged position once a week to build a steady volume history, keeping each trade small enough that fees stay under a dollar or two.`,
      ];
    case 'vaults':
      return [
        `Deposit $${capital} of USDC into one of ${name}'s vaults on ${chain} and keep the vault shares in the wallet.`,
        `After two weeks, move about a quarter of the position into a second vault of the same curator, so the wallet's history spans more than one strategy.`,
      ];
    case 'rwa':
      return [
        `Complete the protocol's onboarding, then mint or buy $${capital} of ${name}'s yield asset on ${chain} and hold it.`,
        `Let one full yield period pass and claim or compound the yield once, so the wallet shows a complete hold-and-earn cycle.`,
      ];
    case 'prediction':
      return [
        `Fund $${capital} and take one position on a liquid market on ${name}, sized small enough to hold to settlement.`,
        `Let the market settle and claim the outcome once, then take one position in a second market so the history is not a single bet.`,
      ];
    case 'payments':
      return [
        `Open an account with ${name}, fund $${capital}, and make one real payment or transfer through it.`,
        `Repeat a small payment once a month, and keep any card or account the protocol issues active between payments.`,
      ];
    case 'insurance':
      return [
        `Buy $${capital} of cover from ${name} on ${chain} for a position you actually hold, and keep the policy to its end.`,
        `Renew or extend the cover once when it lapses, so the wallet shows a continuing customer rather than a single purchase.`,
      ];
    case 'stable':
      return [
        `Mint or deposit $${capital} of the protocol's stable asset through ${name} on ${chain} and hold the asset in the wallet.`,
        `Provide the stable asset to one supported pool or lending market for a week, then return it, so both minting and use are on record.`,
      ];
    case 'chain':
      return [
        `Bridge $${capital} of USDC to the chain through its canonical route and make ${name}'s own apps the first ones the wallet uses there.`,
        `Pay gas with a handful of small transactions across at least two different apps on the chain each week.`,
      ];
    case 'launchpad':
      return [
        `Fund $${capital} and take part in one launch on ${name} at the smallest tier, keeping the allocation in the wallet.`,
        `Hold the launched asset for at least two weeks and use the platform's own staking or holding feature if it offers one.`,
      ];
    case 'dex':
      return [
        `Provide $${capital} of liquidity to a stable or major pair on ${name} on ${chain}, where impermanent loss is smallest, and keep the position open.`,
        `Swap a small amount through the same pool once a week and claim any fees or rewards the position earns, so the wallet is both a provider and a trader.`,
      ];
    default:
      return [
        `Deposit $${capital} of USDC into ${name} on ${chain} through its own app and keep the position open.`,
        `Make one further qualifying action the product offers — a second deposit, a vote, or a claim — so the history is more than a single touch.`,
      ];
  }
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names, and it never invents a campaign: it tells the reader to check the protocol's own points
 * or rewards page, because the snapshot records none.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const [first, second] = actionsFor(p, capital, chain);
  const gas = capital >= 150 ? 8 : capital >= 100 ? 6 : 4;
  return [
    stepText(
      `Use a fresh wallet that holds only the funds you plan to farm with, and keep its seed phrase offline and never typed into a site.`,
      'under $3 of gas for its first transaction',
      '5 minutes',
    ),
    stepText(first, `$${capital} of capital and about $${gas} of gas`, '15 minutes to set up'),
    stepText(second, 'about $2 of gas, plus any spread on the trade', '10 minutes'),
    stepText(
      `Repeat one qualifying action each week — a deposit, a swap, a repay or a claim — so the wallet reads as an ongoing user, not a single visit.`,
      'about $2 of gas a week',
      '10 minutes a week',
    ),
    stepText(
      `Hold the position for at least ${hold} days so the activity spans more than one weekly snapshot of the protocol.`,
      `the $${capital} stays in the position for the whole period`,
      `${hold} days`,
    ),
    stepText(
      `Open the protocol's own points or rewards page, if it has one, and follow only links it publishes; the snapshot records no campaign, so treat any other claim page as a scam until the protocol's own channels confirm it.`,
      'no fee to check, and never pay anyone to claim',
      '10 minutes',
    ),
    stepText(
      `Keep a farm log — wallet, dates, amounts, transaction hashes — and set a date to unwind the position if no token has been announced by then.`,
      'nothing but the log itself',
      '5 minutes, then 5 minutes a month',
    ),
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's form for data.js: the same numbers and the same plan board.json carries. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    peer_scope: row.model.peer_scope,
    fitted_value_usd: row.model.fitted_value_usd,
    category_effect: row.model.category_effect,
    category_peers: row.model.category_peers,
    momentum_multiplier: row.model.momentum_multiplier,
    peer_spread_low: row.model.peer_spread_low,
    peer_spread_high: row.model.peer_spread_high,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { global, byCategory } = peerTable(snapshot, model);
  const early = board.filter((r) => !r.watchlist).length;
  const peers = [...byCategory.entries()]
    .map(([category, s]) => ({
      category,
      peers: s.peers,
      median: round4(s.median),
      multiple: round4(s.peers >= model.min_category_peers ? s.multiple : global.multiple),
    }))
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    validation: VALIDATION,
    protocol_size: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    peer_size: global.peers,
    global_multiple: round4(global.multiple),
    rows: board.map(radarRow),
    live,
    peers,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows: the gate wants at least 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${byRank[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
