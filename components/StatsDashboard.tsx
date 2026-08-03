'use client';

import { ActivityHeatmap } from './ActivityHeatmap';
import { StatCard } from './StatCard';
import {
  formatDate,
  formatDecimal,
  formatEth,
  formatNumber,
  formatPercent,
  shortAddress,
} from '@/lib/format';
import type { WalletStats } from '@/lib/types';

export type WalletReport = WalletStats & { basename?: string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-base-muted">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export function StatsDashboard({ stats }: { stats: WalletReport }) {
  const { activity, value, timeline, interactions, tokens, bridge, builder } = stats;

  return (
    <div>
      <header className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label">Wallet</p>
          <p className="mt-1 font-mono text-lg">
            {stats.basename ?? shortAddress(stats.address)}
          </p>
          {stats.basename ? (
            <p className="font-mono text-xs text-base-muted">{shortAddress(stats.address)}</p>
          ) : null}
        </div>
        <a
          className="rounded-lg border border-base-line px-3 py-2 text-sm text-base-muted hover:text-white"
          href={`https://basescan.org/address/${stats.address}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Basescan ↗
        </a>
      </header>

      {stats.warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          {stats.warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}

      <Section title="Activity">
        <StatCard
          label="Transactions"
          value={formatNumber(activity.totalTx)}
          hint={`${formatNumber(activity.outgoingTx)} sent · ${formatNumber(activity.incomingTx)} received`}
          accent
        />
        <StatCard
          label="Success rate"
          value={formatPercent(activity.successRate)}
          hint={`${formatNumber(activity.failedTx)} failed`}
        />
        <StatCard
          label="Contracts deployed"
          value={formatNumber(activity.contractsDeployed)}
          hint="Counts toward Builder Score"
        />
        <StatCard
          label="Internal txs"
          value={formatNumber(activity.internalTxCount)}
          hint="Contract-triggered transfers"
        />
      </Section>

      <Section title="Value">
        <StatCard
          label="ETH spent on gas"
          value={`${formatEth(value.gasSpentEth, 6)} ETH`}
          hint="L2 execution fee only"
          accent
        />
        <StatCard label="ETH sent" value={`${formatEth(value.ethSentEth)} ETH`} />
        <StatCard label="ETH received" value={`${formatEth(value.ethReceivedEth)} ETH`} />
        <StatCard
          label="Current balance"
          value={`${formatEth(value.currentBalanceEth)} ETH`}
          hint={`Avg gas/tx ${formatEth(value.avgGasPerTxEth, 6)} ETH`}
        />
      </Section>

      <Section title="Timeline">
        <StatCard
          label="First transaction"
          value={formatDate(timeline.firstTxDate)}
          hint={`${formatNumber(timeline.walletAgeDays)} days ago`}
        />
        <StatCard label="Last transaction" value={formatDate(timeline.lastTxDate)} />
        <StatCard
          label="Active days"
          value={formatNumber(timeline.activeDays)}
          hint={`${formatNumber(timeline.activeWeeks)} weeks · ${formatNumber(timeline.activeMonths)} months`}
          accent
        />
        <StatCard
          label="Longest streak"
          value={`${formatNumber(timeline.longestStreakDays)} days`}
          hint={`Current streak ${formatNumber(timeline.currentStreakDays)}`}
        />
        <StatCard
          label="Consistency"
          value={formatPercent(timeline.consistency)}
          hint="Active days ÷ wallet age"
        />
        <StatCard
          label="Avg txs / active day"
          value={formatDecimal(timeline.avgTxPerActiveDay)}
        />
        <StatCard
          label="Busiest day"
          value={timeline.busiestDay ? formatNumber(timeline.busiestDay.count) : '—'}
          hint={timeline.busiestDay ? formatDate(timeline.busiestDay.date) : undefined}
        />
        <StatCard
          label="Wallet age"
          value={`${formatNumber(timeline.walletAgeDays)} days`}
        />
      </Section>

      <div className="mt-4">
        <ActivityHeatmap heatmap={timeline.heatmap} />
      </div>

      <Section title="Bridge — Ethereum → Base">
        <StatCard
          label="ETH bridged in"
          value={`${formatEth(bridge.bridgedInEth)} ETH`}
          hint="Via the canonical Base bridge"
          accent
        />
        <StatCard label="Bridge deposits" value={formatNumber(bridge.bridgeTxCount)} />
        <StatCard label="First bridge" value={formatDate(bridge.firstBridgeDate)} />
        <StatCard
          label="Credited on Base"
          value={`${formatEth(bridge.depositsSeenOnBaseEth)} ETH`}
          hint="Independent L2-side check"
        />
      </Section>

      <Section title="Interactions">
        <StatCard label="Unique contracts" value={formatNumber(interactions.uniqueContracts)} />
        <StatCard
          label="Counterparties"
          value={formatNumber(interactions.uniqueCounterparties)}
        />
        <StatCard
          label="ERC-20 transfers"
          value={formatNumber(tokens.erc20TransferCount)}
          hint={`${formatNumber(tokens.uniqueErc20Tokens)} distinct tokens`}
        />
        <StatCard
          label="NFT transfers"
          value={formatNumber(tokens.nftTransferCount)}
          hint={`${formatNumber(tokens.uniqueNftCollections)} collections`}
        />
      </Section>

      {interactions.topContracts.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-base-muted">
            Most-used contracts
          </h2>
          <div className="card divide-y divide-base-line p-0">
            {interactions.topContracts.map((c) => (
              <div key={c.address} className="flex items-center justify-between px-5 py-3">
                <a
                  className="font-mono text-sm hover:text-base-blue"
                  href={`https://basescan.org/address/${c.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {c.label ?? shortAddress(c.address)}
                </a>
                <span className="font-mono text-sm tabular-nums text-base-muted">
                  {formatNumber(c.count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-base-muted">
          Builder signals
        </h2>
        <div className="card">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-semibold text-base-blue">
              {builder.onchainScore}
            </span>
            <span className="text-sm text-base-muted">/ 100 local activity score</span>
          </div>
          <p className="mt-2 text-xs text-base-muted">
            A local heuristic, not the official Talent Protocol Builder Score. Check the real
            one at talent.app.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-base-muted">
            {builder.notes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-base-muted">
        Generated {new Date(stats.generatedAt).toUTCString()}
      </p>
    </div>
  );
}
