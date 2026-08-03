/**
 * Pure analytics engine.
 *
 * Everything here is a deterministic function of raw Etherscan rows — no I/O,
 * no clock reads except the injected `now`. That keeps it unit-testable and
 * makes the numbers reproducible.
 */

import {
  L1_BRIDGE_LIST,
  type DayBucket,
  type RawInternalTx,
  type RawTokenTx,
  type RawTx,
  type WalletStats,
} from './types';

const WEI = 1e18;
const DAY_MS = 86_400_000;

/** Well-known Base contracts, for friendlier "top contracts" labels. */
const KNOWN_CONTRACTS: Record<string, string> = {
  '0x4200000000000000000000000000000000000006': 'WETH',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  '0x2626664c2603336e57b271c5c0b26f421741e481': 'Uniswap V3 Router',
  '0x6ff5693b99212da76ad316178a184ab56d299b43': 'Uniswap V4 Router',
  '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43': 'Aerodrome Router',
  '0x03059433bcdb6144624cc2443159d9445c32b7a8': 'Aerodrome Universal Router',
  '0x498581ff718922c3f8e6a244956af099b2652b2b': 'Uniswap V4 PoolManager',
  '0x03a520b32c04bf3beef7beb72e919cf822ed34f1': 'Permit2',
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Permit2',
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24': 'Uniswap V2 Router',
  '0x420000000000000000000000000000000000000f': 'Base Fee Vault',
  '0x4ccb0bb02fcaba27e82a56646e81d8c5bc4119a5': 'Basenames Registrar',
  '0xb94704422c2a1e396835a571837aa5ae53285a95': 'Basenames Resolver',
  '0x03c4738ee98ae44591e1a4a4f3cab6641d95dd9a': 'Basenames Registry',
  '0x2fc617e933a52713247ce25730f6695920b3befe': 'Zora',
  '0x777777c338d93e2c7adf08d102d45ca7cc4ed021': 'Zora 1155 Factory',
  '0x00000000fcce7f938e7ae6d3c335bd6a1a7c593d': 'Morpho Blue',
  '0xa238dd80c259a72e81d7e4664a9801593f98d1c5': 'Aave V3 Pool',
};

/** `0` address and burn-style sinks we never want to count as counterparties. */
const IGNORED_COUNTERPARTIES = new Set([
  '',
  '0x0000000000000000000000000000000000000000',
]);

const lower = (v: string | undefined | null): string => (v ?? '').toLowerCase();
const toEth = (wei: string): number => Number(BigInt(wei || '0')) / WEI;
const utcDay = (unixSeconds: string | number): string =>
  new Date(Number(unixSeconds) * 1000).toISOString().slice(0, 10);

/** ISO-ish week key, `YYYY-Www`, good enough for counting distinct weeks. */
function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const target = new Date(d);
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(
    (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS,
  );
}

/**
 * Longest run of consecutive calendar days present in `sortedDates`.
 * Dates must be unique, ascending, `YYYY-MM-DD`.
 */
export function longestStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    run = daysBetween(sortedDates[i - 1], sortedDates[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Streak ending today. A wallet that transacted yesterday but not yet today is
 * still "on streak" — the day isn't over — so we allow a one-day grace period.
 */
export function currentStreak(sortedDates: string[], today: string): number {
  if (sortedDates.length === 0) return 0;
  const last = sortedDates[sortedDates.length - 1];
  const gap = daysBetween(last, today);
  if (gap > 1) return 0;

  let streak = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    if (daysBetween(sortedDates[i - 1], sortedDates[i]) !== 1) break;
    streak++;
  }
  return streak;
}

export interface AnalyticsInput {
  address: string;
  baseTxs: RawTx[];
  baseInternalTxs: RawInternalTx[];
  erc20Txs: RawTokenTx[];
  nftTxs: RawTokenTx[];
  balanceWei: bigint;
  /** Ethereum L1 transactions, used to measure bridged ETH. Empty if not scanned. */
  l1Txs: RawTx[];
  l1ScanIncomplete: boolean;
  hasBasename: boolean;
  warnings?: string[];
  /** Injected for deterministic tests. */
  now?: Date;
}

export function computeWalletStats(input: AnalyticsInput): WalletStats {
  const address = lower(input.address);
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const warnings = [...(input.warnings ?? [])];

  // ---------------------------------------------------------------- partition
  // L1→L2 deposits surface on Base as system transactions with a zero gas price
  // and `from === to === wallet`. They are not user-signed L2 activity, so they
  // are excluded from tx counts and tracked separately as bridge inflow.
  const isDepositSystemTx = (tx: RawTx): boolean =>
    lower(tx.from) === address && BigInt(tx.gasPrice || '0') === 0n && BigInt(tx.value || '0') > 0n;

  const depositTxs = input.baseTxs.filter(isDepositSystemTx);
  const realTxs = input.baseTxs.filter((tx) => !isDepositSystemTx(tx));

  const outgoing = realTxs.filter((tx) => lower(tx.from) === address);
  const incoming = realTxs.filter((tx) => lower(tx.to) === address && lower(tx.from) !== address);

  // ------------------------------------------------------------------- values
  let gasWei = 0n;
  let sentWei = 0n;
  let mostExpensiveWei = 0n;

  for (const tx of outgoing) {
    const fee = BigInt(tx.gasUsed || '0') * BigInt(tx.gasPrice || '0');
    gasWei += fee;
    if (fee > mostExpensiveWei) mostExpensiveWei = fee;
    // A reverted tx still burns gas but moves no value.
    if (tx.isError !== '1') sentWei += BigInt(tx.value || '0');
  }

  let receivedWei = 0n;
  for (const tx of incoming) {
    if (tx.isError !== '1') receivedWei += BigInt(tx.value || '0');
  }
  for (const tx of input.baseInternalTxs) {
    if (lower(tx.to) === address && tx.isError !== '1') receivedWei += BigInt(tx.value || '0');
  }

  const failedTx = outgoing.filter((tx) => tx.isError === '1').length;
  const contractsDeployed = outgoing.filter(
    (tx) => lower(tx.to) === '' && tx.isError !== '1',
  ).length;

  // ----------------------------------------------------------------- timeline
  // Every timestamped event counts toward "activity", including token transfers
  // received passively — that is what a block explorer shows on the wallet page.
  const timestamps: number[] = [
    ...realTxs.map((t) => Number(t.timeStamp)),
    ...input.baseInternalTxs.map((t) => Number(t.timeStamp)),
    ...input.erc20Txs.map((t) => Number(t.timeStamp)),
    ...input.nftTxs.map((t) => Number(t.timeStamp)),
    ...depositTxs.map((t) => Number(t.timeStamp)),
  ].filter((n) => Number.isFinite(n) && n > 0);

  const dayCounts = new Map<string, number>();
  for (const ts of timestamps) {
    const day = utcDay(ts);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const activeDates = [...dayCounts.keys()].sort();
  const firstTxDate = activeDates[0] ?? null;
  const lastTxDate = activeDates[activeDates.length - 1] ?? null;

  const walletAgeDays = firstTxDate ? Math.max(daysBetween(firstTxDate, today), 0) : 0;
  const activeDays = activeDates.length;

  let busiestDay: DayBucket | null = null;
  for (const [date, count] of dayCounts) {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date, count };
  }

  // A rolling 365-day window is what a contribution-graph style heatmap needs.
  const heatmapStart = new Date(now.getTime() - 364 * DAY_MS).toISOString().slice(0, 10);
  const heatmap: DayBucket[] = activeDates
    .filter((date) => date >= heatmapStart)
    .map((date) => ({ date, count: dayCounts.get(date) ?? 0 }));

  // -------------------------------------------------------------- interaction
  const contractCounts = new Map<string, number>();
  const counterparties = new Set<string>();

  for (const tx of outgoing) {
    const to = lower(tx.to);
    if (IGNORED_COUNTERPARTIES.has(to)) continue;
    counterparties.add(to);
    // Non-empty calldata means the destination is a contract being called.
    if (tx.input && tx.input !== '0x') {
      contractCounts.set(to, (contractCounts.get(to) ?? 0) + 1);
    }
  }
  for (const tx of incoming) {
    const from = lower(tx.from);
    if (!IGNORED_COUNTERPARTIES.has(from)) counterparties.add(from);
  }

  const topContracts = [...contractCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([addr, count]) => ({
      address: addr,
      count,
      label: KNOWN_CONTRACTS[addr],
    }));

  // ------------------------------------------------------------------ bridge
  const bridgeTxs = input.l1Txs.filter(
    (tx) =>
      lower(tx.from) === address &&
      L1_BRIDGE_LIST.includes(lower(tx.to)) &&
      tx.isError !== '1' &&
      BigInt(tx.value || '0') > 0n,
  );

  let bridgedWei = 0n;
  for (const tx of bridgeTxs) bridgedWei += BigInt(tx.value || '0');

  let depositsOnBaseWei = 0n;
  for (const tx of depositTxs) depositsOnBaseWei += BigInt(tx.value || '0');

  if (input.l1ScanIncomplete) {
    warnings.push(
      'Ethereum L1 history was not fully scanned, so bridged ETH may be understated.',
    );
  }

  // ------------------------------------------------------------------ builder
  const builderNotes: string[] = [];
  if (contractsDeployed > 0) {
    builderNotes.push(
      `${contractsDeployed} contract deployment${contractsDeployed === 1 ? '' : 's'} detected — verify them on Basescan so they count as Builder Score credentials.`,
    );
  } else {
    builderNotes.push(
      'No contract deployments found. Deploying and verifying a contract on Base is the single strongest onchain Builder Score signal.',
    );
  }
  if (!input.hasBasename) {
    builderNotes.push('No Basename detected. A Basename is required for Base Builder Rewards.');
  }
  if (activeDays < 30) {
    builderNotes.push('Fewer than 30 active days — consistency is weighted heavily.');
  }

  // Heuristic only: rewards sustained, varied, self-directed activity.
  const onchainScore = Math.round(
    Math.min(100, [
      Math.min(25, outgoing.length / 20),
      Math.min(20, activeDays / 5),
      Math.min(15, longestStreak(activeDates)),
      Math.min(15, contractCounts.size / 2),
      Math.min(15, contractsDeployed * 5),
      input.hasBasename ? 10 : 0,
    ].reduce((a, b) => a + b, 0)),
  );

  const totalTx = outgoing.length + incoming.length;

  return {
    address,
    generatedAt: now.toISOString(),

    activity: {
      outgoingTx: outgoing.length,
      incomingTx: incoming.length,
      totalTx,
      failedTx,
      successRate: outgoing.length ? (outgoing.length - failedTx) / outgoing.length : 0,
      contractsDeployed,
      internalTxCount: input.baseInternalTxs.length,
    },

    value: {
      gasSpentEth: Number(gasWei) / WEI,
      ethSentEth: Number(sentWei) / WEI,
      ethReceivedEth: Number(receivedWei) / WEI,
      currentBalanceEth: Number(input.balanceWei) / WEI,
      avgGasPerTxEth: outgoing.length ? Number(gasWei) / WEI / outgoing.length : 0,
      mostExpensiveTxEth: Number(mostExpensiveWei) / WEI,
    },

    timeline: {
      firstTxDate,
      lastTxDate,
      walletAgeDays,
      activeDays,
      activeWeeks: new Set(activeDates.map(weekKey)).size,
      activeMonths: new Set(activeDates.map((d) => d.slice(0, 7))).size,
      longestStreakDays: longestStreak(activeDates),
      currentStreakDays: currentStreak(activeDates, today),
      busiestDay,
      avgTxPerActiveDay: activeDays ? timestamps.length / activeDays : 0,
      consistency: walletAgeDays > 0 ? Math.min(1, activeDays / (walletAgeDays + 1)) : 0,
      heatmap,
    },

    interactions: {
      uniqueContracts: contractCounts.size,
      uniqueCounterparties: counterparties.size,
      topContracts,
    },

    tokens: {
      erc20TransferCount: input.erc20Txs.length,
      uniqueErc20Tokens: new Set(input.erc20Txs.map((t) => lower(t.contractAddress))).size,
      nftTransferCount: input.nftTxs.length,
      uniqueNftCollections: new Set(input.nftTxs.map((t) => lower(t.contractAddress))).size,
    },

    bridge: {
      bridgedInEth: Number(bridgedWei) / WEI,
      bridgeTxCount: bridgeTxs.length,
      firstBridgeDate: bridgeTxs.length ? utcDay(bridgeTxs[0].timeStamp) : null,
      depositsSeenOnBaseEth: Number(depositsOnBaseWei) / WEI,
      l1ScanIncomplete: input.l1ScanIncomplete,
    },

    builder: {
      contractsDeployed,
      hasBasename: input.hasBasename,
      onchainScore,
      notes: builderNotes,
    },

    warnings,
  };
}

export { toEth, utcDay };
