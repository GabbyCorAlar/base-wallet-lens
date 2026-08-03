/**
 * Shared types for Base Wallet Lens.
 *
 * All raw shapes mirror the Etherscan V2 API responses (module=account),
 * which are identical across chains — only the `chainid` query param changes.
 * @see https://docs.etherscan.io/etherscan-v2/readme
 */

export const CHAIN_IDS = {
  ethereum: 1,
  base: 8453,
} as const;

/** Canonical Base bridge contracts on Ethereum L1. */
export const L1_BRIDGE_ADDRESSES = {
  /** Base L1StandardBridge — `depositETH` / plain ETH transfers. */
  l1StandardBridge: '0x3154cf16ccdb4c6d922629664174b904d80f2c35',
  /** Base OptimismPortal — `depositTransaction`, used by the official bridge UI. */
  optimismPortal: '0x49048044d57e1c92a77f79988d21fa8faf74e97e',
} as const;

export const L1_BRIDGE_LIST: readonly string[] = Object.values(L1_BRIDGE_ADDRESSES);

/** A normal (EOA-initiated) transaction as returned by `action=txlist`. */
export interface RawTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  methodId?: string;
  functionName?: string;
}

/** An internal transaction as returned by `action=txlistinternal`. */
export interface RawInternalTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  type: string;
  isError: string;
}

/** An ERC-20 / ERC-721 transfer as returned by `action=tokentx` / `action=tokennfttx`. */
export interface RawTokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenID?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

export interface EtherscanEnvelope<T> {
  status: '0' | '1';
  message: string;
  result: T | string;
}

/** One bar in the yearly activity heatmap. */
export interface DayBucket {
  /** UTC date, `YYYY-MM-DD`. */
  date: string;
  count: number;
}

export interface WalletStats {
  address: string;
  generatedAt: string;

  activity: {
    /** Transactions signed by this wallet on Base (excludes L1→L2 deposit system txs). */
    outgoingTx: number;
    /** Transactions where the wallet is the recipient. */
    incomingTx: number;
    /** Outgoing + incoming normal transactions. */
    totalTx: number;
    failedTx: number;
    successRate: number;
    /** Outgoing txs whose `to` is empty — i.e. contract deployments. */
    contractsDeployed: number;
    internalTxCount: number;
  };

  value: {
    /** L2 execution gas paid, in ETH. Excludes the L1 data-availability fee. */
    gasSpentEth: number;
    ethSentEth: number;
    ethReceivedEth: number;
    currentBalanceEth: number;
    /** Average L2 gas cost per outgoing transaction, in ETH. */
    avgGasPerTxEth: number;
    mostExpensiveTxEth: number;
  };

  timeline: {
    firstTxDate: string | null;
    lastTxDate: string | null;
    /** Days between the first transaction and today. */
    walletAgeDays: number;
    /** Distinct UTC dates with at least one transaction. */
    activeDays: number;
    activeWeeks: number;
    activeMonths: number;
    longestStreakDays: number;
    /** Streak counting back from today (0 if there was no activity today or yesterday). */
    currentStreakDays: number;
    busiestDay: DayBucket | null;
    avgTxPerActiveDay: number;
    /** Share of the wallet's lifetime on which it was active, 0–1. */
    consistency: number;
    heatmap: DayBucket[];
  };

  interactions: {
    uniqueContracts: number;
    uniqueCounterparties: number;
    topContracts: Array<{ address: string; count: number; label?: string }>;
  };

  tokens: {
    erc20TransferCount: number;
    uniqueErc20Tokens: number;
    nftTransferCount: number;
    uniqueNftCollections: number;
  };

  bridge: {
    /** ETH sent into the canonical Base bridge contracts from L1, in ETH. */
    bridgedInEth: number;
    bridgeTxCount: number;
    firstBridgeDate: string | null;
    /** ETH credited on Base by L1→L2 deposit system txs — an independent cross-check. */
    depositsSeenOnBaseEth: number;
    /** True when the L1 scan was skipped (e.g. rate limit) and figures may be partial. */
    l1ScanIncomplete: boolean;
  };

  /** Signals that map onto Talent Protocol's Builder Score credentials. */
  builder: {
    contractsDeployed: number;
    hasBasename: boolean;
    /** 0–100 heuristic. Not the official Builder Score — a local approximation. */
    onchainScore: number;
    notes: string[];
  };

  warnings: string[];
}
