/**
 * Basename (Base's ENS-compatible naming service) reverse resolution.
 *
 * A Basename is a hard requirement for Base Builder Rewards, so we surface it
 * as a first-class signal. Resolution is best-effort: an RPC hiccup should
 * never fail the whole report.
 */

import { createPublicClient, http, namehash, type Address } from 'viem';
import { base } from 'viem/chains';

/** Base L2 resolver used by Basenames. */
const L2_RESOLVER: Address = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';

/** Reverse-lookup suffix for Base mainnet (`0x2105` = 8453, coin type 80002105). */
const REVERSE_SUFFIX = '80002105.reverse';

const RESOLVER_ABI = [
  {
    inputs: [{ name: 'node', type: 'bytes32' }],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function resolveBasename(address: string): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
    });

    const node = namehash(`${address.slice(2).toLowerCase()}.${REVERSE_SUFFIX}`);
    const name = await client.readContract({
      address: L2_RESOLVER,
      abi: RESOLVER_ABI,
      functionName: 'name',
      args: [node],
    });

    return name && name.length > 0 ? name : null;
  } catch {
    // Non-fatal: the wallet report is still useful without a Basename.
    return null;
  }
}
