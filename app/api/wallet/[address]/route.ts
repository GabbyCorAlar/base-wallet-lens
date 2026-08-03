/**
 * GET /api/wallet/:address
 *
 * Runs entirely server-side so the Etherscan API key is never shipped to the
 * browser. Returns a fully computed `WalletStats` payload.
 */

import { NextResponse } from 'next/server';

import { computeWalletStats } from '@/lib/analytics';
import { resolveBasename } from '@/lib/basename';
import {
  EtherscanError,
  fetchBalanceWei,
  fetchInternalTxs,
  fetchNftTxs,
  fetchNormalTxs,
  fetchTokenTxs,
} from '@/lib/etherscan';
import { CHAIN_IDS, type RawTx } from '@/lib/types';

export const runtime = 'nodejs';
export const revalidate = 60;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await context.params;
  const address = raw?.trim();

  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Invalid address. Expected a 0x-prefixed 40-character hex string.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Server is missing ETHERSCAN_API_KEY. Copy .env.example to .env.local and add a free key from etherscan.io/apis.',
      },
      { status: 500 },
    );
  }

  const opts = { address, apiKey };
  const warnings: string[] = [];

  try {
    // Base-side history. Sequential by design — the client throttles to stay
    // under the free tier's 5 calls/second limit.
    const [normal, internal, erc20, nfts, balanceWei] = [
      await fetchNormalTxs(opts, CHAIN_IDS.base),
      await fetchInternalTxs(opts, CHAIN_IDS.base),
      await fetchTokenTxs(opts, CHAIN_IDS.base),
      await fetchNftTxs(opts, CHAIN_IDS.base),
      await fetchBalanceWei(opts, CHAIN_IDS.base),
    ];

    for (const [name, res] of [
      ['transactions', normal],
      ['internal transactions', internal],
      ['token transfers', erc20],
      ['NFT transfers', nfts],
    ] as const) {
      if (res.truncated) {
        warnings.push(`Hit the page cap while reading ${name}; totals are a lower bound.`);
      }
    }

    // L1 history, used only to measure bridged ETH. Non-fatal if it fails.
    let l1Txs: RawTx[] = [];
    let l1ScanIncomplete = false;
    try {
      const l1 = await fetchNormalTxs(opts, CHAIN_IDS.ethereum);
      l1Txs = l1.rows;
      l1ScanIncomplete = l1.truncated;
    } catch {
      l1ScanIncomplete = true;
    }

    const basename = await resolveBasename(address);

    const stats = computeWalletStats({
      address,
      baseTxs: normal.rows,
      baseInternalTxs: internal.rows,
      erc20Txs: erc20.rows,
      nftTxs: nfts.rows,
      balanceWei,
      l1Txs,
      l1ScanIncomplete,
      hasBasename: Boolean(basename),
      warnings,
    });

    return NextResponse.json({ ...stats, basename });
  } catch (error) {
    if (error instanceof EtherscanError) {
      return NextResponse.json({ error: error.message }, { status: error.retryable ? 503 : 502 });
    }
    console.error('wallet route failed', error);
    return NextResponse.json({ error: 'Unexpected error building the report.' }, { status: 500 });
  }
}
