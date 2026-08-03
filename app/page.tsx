'use client';

import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

import { StatsDashboard, type WalletReport } from '@/components/StatsDashboard';
import { isAddress } from '@/lib/format';

export default function Home() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const { address: connectedAddress } = useAccount();

  const [input, setInput] = useState('');
  const [report, setReport] = useState<WalletReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Tells the Base App / Farcaster host to hide its splash screen.
  useEffect(() => {
    if (!isFrameReady) setFrameReady();
  }, [isFrameReady, setFrameReady]);

  // Pre-fill with the connected wallet, but never overwrite what the user typed.
  useEffect(() => {
    if (connectedAddress && !input) setInput(connectedAddress);
  }, [connectedAddress, input]);

  const scan = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`/api/wallet/${address}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setReport(data as WalletReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const address = input.trim();
    if (!isAddress(address)) {
      setError('That does not look like a wallet address.');
      return;
    }
    void scan(address);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold sm:text-5xl">Base Wallet Lens</h1>
        <p className="mx-auto mt-3 max-w-xl text-base-muted">
          Everything Base knows about a wallet — transactions, gas burned, streaks, bridged
          ETH and builder signals.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          aria-label="Wallet address"
          className="flex-1 rounded-xl border border-base-line bg-base-slate px-4 py-3 font-mono text-sm outline-none placeholder:text-base-muted focus:border-base-blue"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-base-blue px-6 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Scanning…' : 'Scan wallet'}
        </button>
      </form>

      {error ? (
        <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-sm text-base-muted">
          Reading the full history — large wallets take a few seconds.
        </p>
      ) : null}

      {report ? (
        <div className="mt-10">
          <StatsDashboard stats={report} />
        </div>
      ) : null}
    </main>
  );
}
