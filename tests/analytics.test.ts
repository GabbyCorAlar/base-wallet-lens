import { describe, expect, it } from 'vitest';

import { computeWalletStats, currentStreak, longestStreak } from '../lib/analytics';
import type { AnalyticsInput } from '../lib/analytics';
import type { RawTx } from '../lib/types';

const WALLET = '0x1111111111111111111111111111111111111111';
const PEER = '0x2222222222222222222222222222222222222222';
const CONTRACT = '0x2626664c2603336e57b271c5c0b26f421741e481';
const L1_BRIDGE = '0x3154Cf16ccdb4C6d922629664174b904d80F2C35';

/** Seconds since epoch for a UTC date at noon, so timezone drift can't bite. */
const at = (date: string): string => String(Date.parse(`${date}T12:00:00Z`) / 1000);

function tx(overrides: Partial<RawTx> & { timeStamp: string }): RawTx {
  return {
    blockNumber: '1',
    hash: `0x${Math.random().toString(16).slice(2)}`,
    nonce: '0',
    from: WALLET,
    to: PEER,
    value: '0',
    gas: '21000',
    gasPrice: '1000000000',
    gasUsed: '21000',
    isError: '0',
    txreceipt_status: '1',
    input: '0x',
    contractAddress: '',
    ...overrides,
  };
}

function baseInput(overrides: Partial<AnalyticsInput> = {}): AnalyticsInput {
  return {
    address: WALLET,
    baseTxs: [],
    baseInternalTxs: [],
    erc20Txs: [],
    nftTxs: [],
    balanceWei: 0n,
    l1Txs: [],
    l1ScanIncomplete: false,
    hasBasename: false,
    now: new Date('2026-08-03T00:00:00Z'),
    ...overrides,
  };
}

describe('longestStreak', () => {
  it('returns 0 for no activity', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('finds the longest consecutive run', () => {
    expect(longestStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-09'])).toBe(3);
  });

  it('handles month and year boundaries', () => {
    expect(longestStreak(['2025-12-30', '2025-12-31', '2026-01-01'])).toBe(3);
  });

  it('treats isolated days as streaks of one', () => {
    expect(longestStreak(['2026-01-01', '2026-03-01'])).toBe(1);
  });
});

describe('currentStreak', () => {
  it('counts a run ending today', () => {
    expect(currentStreak(['2026-08-01', '2026-08-02', '2026-08-03'], '2026-08-03')).toBe(3);
  });

  it('still counts when the last activity was yesterday', () => {
    expect(currentStreak(['2026-08-01', '2026-08-02'], '2026-08-03')).toBe(2);
  });

  it('resets after a two-day gap', () => {
    expect(currentStreak(['2026-07-01', '2026-07-02'], '2026-08-03')).toBe(0);
  });
});

describe('computeWalletStats', () => {
  it('handles a wallet with no history', () => {
    const stats = computeWalletStats(baseInput());
    expect(stats.activity.totalTx).toBe(0);
    expect(stats.timeline.firstTxDate).toBeNull();
    expect(stats.timeline.activeDays).toBe(0);
    expect(stats.value.gasSpentEth).toBe(0);
  });

  it('separates outgoing from incoming transactions', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [
          tx({ timeStamp: at('2026-01-01') }),
          tx({ timeStamp: at('2026-01-02'), from: PEER, to: WALLET, value: '5000000000000000000' }),
        ],
      }),
    );

    expect(stats.activity.outgoingTx).toBe(1);
    expect(stats.activity.incomingTx).toBe(1);
    expect(stats.activity.totalTx).toBe(2);
    expect(stats.value.ethReceivedEth).toBe(5);
  });

  it('sums gas only for transactions the wallet signed', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [
          // 21000 * 1 gwei = 0.000021 ETH
          tx({ timeStamp: at('2026-01-01') }),
          tx({ timeStamp: at('2026-01-02'), from: PEER, to: WALLET }),
        ],
      }),
    );

    expect(stats.value.gasSpentEth).toBeCloseTo(0.000021, 12);
  });

  it('charges gas for reverted transactions but not their value', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [tx({ timeStamp: at('2026-01-01'), isError: '1', value: '1000000000000000000' })],
      }),
    );

    expect(stats.value.ethSentEth).toBe(0);
    expect(stats.value.gasSpentEth).toBeGreaterThan(0);
    expect(stats.activity.failedTx).toBe(1);
    expect(stats.activity.successRate).toBe(0);
  });

  it('counts contract deployments', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [
          tx({
            timeStamp: at('2026-02-01'),
            to: '',
            input: '0x60806040',
            contractAddress: CONTRACT,
          }),
        ],
      }),
    );

    expect(stats.activity.contractsDeployed).toBe(1);
    expect(stats.builder.contractsDeployed).toBe(1);
  });

  it('counts unique contracts only for calls with calldata', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [
          tx({ timeStamp: at('2026-01-01'), to: CONTRACT, input: '0xa9059cbb' }),
          tx({ timeStamp: at('2026-01-02'), to: CONTRACT, input: '0xa9059cbb' }),
          // A plain ETH transfer is a counterparty, not a contract interaction.
          tx({ timeStamp: at('2026-01-03'), to: PEER, input: '0x' }),
        ],
      }),
    );

    expect(stats.interactions.uniqueContracts).toBe(1);
    expect(stats.interactions.uniqueCounterparties).toBe(2);
    expect(stats.interactions.topContracts[0]).toMatchObject({ count: 2, label: 'Uniswap V3 Router' });
  });

  it('derives the timeline from every kind of activity', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [tx({ timeStamp: at('2026-01-10') })],
        erc20Txs: [
          {
            blockNumber: '1',
            timeStamp: at('2026-03-15'),
            hash: '0xabc',
            from: PEER,
            to: WALLET,
            value: '1',
            tokenName: 'USD Coin',
            tokenSymbol: 'USDC',
            tokenDecimal: '6',
            contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          },
        ],
      }),
    );

    expect(stats.timeline.firstTxDate).toBe('2026-01-10');
    expect(stats.timeline.lastTxDate).toBe('2026-03-15');
    expect(stats.timeline.activeDays).toBe(2);
    expect(stats.timeline.activeMonths).toBe(2);
    expect(stats.tokens.uniqueErc20Tokens).toBe(1);
  });

  it('measures bridged ETH from L1 deposits into the canonical bridge', () => {
    const stats = computeWalletStats(
      baseInput({
        l1Txs: [
          tx({ timeStamp: at('2025-06-01'), to: L1_BRIDGE, value: '1500000000000000000' }),
          tx({ timeStamp: at('2025-07-01'), to: L1_BRIDGE, value: '500000000000000000' }),
          // An unrelated L1 transfer must not be counted.
          tx({ timeStamp: at('2025-08-01'), to: PEER, value: '9000000000000000000' }),
          // A failed bridge attempt moves nothing.
          tx({ timeStamp: at('2025-09-01'), to: L1_BRIDGE, value: '1000000000000000000', isError: '1' }),
        ],
      }),
    );

    expect(stats.bridge.bridgedInEth).toBe(2);
    expect(stats.bridge.bridgeTxCount).toBe(2);
    expect(stats.bridge.firstBridgeDate).toBe('2025-06-01');
  });

  it('treats zero-gas-price system txs as L1 deposits, not signed transactions', () => {
    const stats = computeWalletStats(
      baseInput({
        baseTxs: [
          tx({
            timeStamp: at('2025-06-01'),
            from: WALLET,
            to: WALLET,
            value: '3000000000000000000',
            gasPrice: '0',
            gasUsed: '0',
          }),
          tx({ timeStamp: at('2025-06-02') }),
        ],
      }),
    );

    expect(stats.activity.outgoingTx).toBe(1);
    expect(stats.bridge.depositsSeenOnBaseEth).toBe(3);
    // The deposit day still counts as onchain activity.
    expect(stats.timeline.activeDays).toBe(2);
  });

  it('flags an incomplete L1 scan as a warning', () => {
    const stats = computeWalletStats(baseInput({ l1ScanIncomplete: true }));
    expect(stats.warnings.some((w) => w.includes('bridged ETH'))).toBe(true);
  });

  it('keeps the heuristic score inside 0–100', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      tx({ timeStamp: at(`2026-0${(i % 7) + 1}-0${(i % 9) + 1}`), to: CONTRACT, input: '0xdead' }),
    );
    const stats = computeWalletStats(baseInput({ baseTxs: many, hasBasename: true }));

    expect(stats.builder.onchainScore).toBeGreaterThan(0);
    expect(stats.builder.onchainScore).toBeLessThanOrEqual(100);
  });
});
