/**
 * Thin client for the Etherscan V2 multichain API.
 *
 * V2 exposes one base URL and selects the network with `chainid`, so a single
 * API key covers both Base (8453) and Ethereum mainnet (1).
 * @see https://docs.etherscan.io/etherscan-v2/readme
 */

import type {
  EtherscanEnvelope,
  RawInternalTx,
  RawTokenTx,
  RawTx,
} from './types';

const BASE_URL = 'https://api.etherscan.io/v2/api';

/** Etherscan caps `offset` at 10 000 rows per page. */
const PAGE_SIZE = 10_000;

/** Safety valve so one whale wallet can't burn the whole rate-limit budget. */
const MAX_PAGES = 10;

/** Free tier allows 5 calls/second; 220 ms between calls keeps us comfortably under. */
const THROTTLE_MS = 220;

let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export class EtherscanError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'EtherscanError';
  }
}

interface QueryParams {
  chainId: number;
  module: string;
  action: string;
  apiKey: string;
  [key: string]: string | number;
}

async function request<T>(params: QueryParams): Promise<T> {
  const { chainId, apiKey, ...rest } = params;
  const url = new URL(BASE_URL);
  url.searchParams.set('chainid', String(chainId));
  url.searchParams.set('apikey', apiKey);
  for (const [key, value] of Object.entries(rest)) {
    url.searchParams.set(key, String(value));
  }

  await throttle();

  // `next` is a Next.js extension to RequestInit; typed explicitly so this file
  // also compiles under plain DOM lib types.
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { accept: 'application/json' },
    // Etherscan data for a closed block never changes; cache for a minute.
    next: { revalidate: 60 },
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    throw new EtherscanError(`Network error calling Etherscan: ${String(cause)}`, true);
  }

  if (res.status === 429) {
    throw new EtherscanError('Etherscan rate limit hit. Slow down or use a paid key.', true);
  }
  if (!res.ok) {
    throw new EtherscanError(`Etherscan responded ${res.status}`, res.status >= 500);
  }

  const body = (await res.json()) as EtherscanEnvelope<T>;

  if (body.status === '1') return body.result as T;

  // Etherscan signals "nothing found" with status 0 — that is not an error.
  const message = String(body.message ?? '');
  const detail = typeof body.result === 'string' ? body.result : '';
  if (/no transactions found|no records found/i.test(message)) {
    return [] as unknown as T;
  }
  if (/rate limit|max calls/i.test(`${message} ${detail}`)) {
    throw new EtherscanError('Etherscan rate limit hit. Slow down or use a paid key.', true);
  }
  if (/invalid api key|missing.*api key/i.test(`${message} ${detail}`)) {
    throw new EtherscanError('Invalid Etherscan API key. Check ETHERSCAN_API_KEY.');
  }
  throw new EtherscanError(detail || message || 'Unknown Etherscan error');
}

interface PaginateParams {
  chainId: number;
  apiKey: string;
  action: string;
  address: string;
}

/** Walks every page of a paginated `account` endpoint until it runs dry. */
async function paginate<T>(
  params: PaginateParams,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await request<T[]>({
      module: 'account',
      chainId: params.chainId,
      apiKey: params.apiKey,
      action: params.action,
      address: params.address,
      page,
      offset: PAGE_SIZE,
      sort: 'asc',
    });

    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export interface FetchOptions {
  address: string;
  apiKey: string;
}

export async function fetchNormalTxs(
  { address, apiKey }: FetchOptions,
  chainId: number,
): Promise<{ rows: RawTx[]; truncated: boolean }> {
  return paginate<RawTx>({ chainId, apiKey, action: 'txlist', address });
}

export async function fetchInternalTxs(
  { address, apiKey }: FetchOptions,
  chainId: number,
): Promise<{ rows: RawInternalTx[]; truncated: boolean }> {
  return paginate<RawInternalTx>({ chainId, apiKey, action: 'txlistinternal', address });
}

export async function fetchTokenTxs(
  { address, apiKey }: FetchOptions,
  chainId: number,
): Promise<{ rows: RawTokenTx[]; truncated: boolean }> {
  return paginate<RawTokenTx>({ chainId, apiKey, action: 'tokentx', address });
}

export async function fetchNftTxs(
  { address, apiKey }: FetchOptions,
  chainId: number,
): Promise<{ rows: RawTokenTx[]; truncated: boolean }> {
  return paginate<RawTokenTx>({ chainId, apiKey, action: 'tokennfttx', address });
}

export async function fetchBalanceWei(
  { address, apiKey }: FetchOptions,
  chainId: number,
): Promise<bigint> {
  const result = await request<string>({
    chainId,
    apiKey,
    module: 'account',
    action: 'balance',
    address,
    tag: 'latest',
  });
  return BigInt(result || '0');
}
