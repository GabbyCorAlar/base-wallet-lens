# Base Wallet Lens

A Base Mini App that reads a wallet's entire history on Base and turns it into a report you can actually read: transactions, ETH burned on gas, first and last day, active days, longest streak, ETH bridged in from Ethereum, contracts touched, tokens and NFTs moved, and builder signals.

Runs standalone in a browser and embedded inside Base App / Farcaster from the same build.

## What it measures

**Activity** — total transactions, split into signed vs. received; failed transactions and success rate; contract deployments; internal transactions.

**Value** — ETH spent on L2 execution gas, ETH sent, ETH received, current balance, average gas per transaction, most expensive transaction.

**Timeline** — first transaction, last transaction, wallet age, distinct active days / weeks / months, longest streak of consecutive active days, current streak, busiest single day, average transactions per active day, consistency (active days ÷ wallet age), and a 12-month activity heatmap.

**Bridge** — ETH deposited from Ethereum mainnet through the canonical Base bridge, number of deposits, and the date of the first one. Cross-checked against the L1→L2 deposit transactions credited on the Base side.

**Interactions** — unique contracts called, unique counterparties, and the ten most-used contracts with human labels for well-known ones.

**Tokens** — ERC-20 transfer count and distinct tokens, NFT transfer count and distinct collections.

**Builder signals** — Basename, contract deployments, and a local 0–100 activity heuristic.

## How the numbers are derived

Everything comes from the [Etherscan V2 multichain API](https://docs.etherscan.io/etherscan-v2/readme), which serves every chain from one base URL and one API key by switching a `chainid` parameter — `8453` for Base, `1` for Ethereum.

Two details worth knowing:

**Bridged ETH is measured on L1, not L2.** The app reads the wallet's Ethereum mainnet history and sums the value of successful transactions sent to Base's canonical bridge contracts — the [L1StandardBridge](https://etherscan.io/address/0x3154Cf16ccdb4C6d922629664174b904d80F2C35) and the [OptimismPortal](https://etherscan.io/address/0x49048044D57e1C92A77f79988d21Fa8fAF74E97e). This is the reliable way to attribute a deposit to a specific wallet. It does not count third-party bridges (Across, Hop, Stargate, exchange withdrawals) — those aren't canonical deposits and can't be told apart from ordinary transfers. As a cross-check the app separately sums L1→L2 deposit system transactions credited on the Base side, which do include third-party routes that use the canonical bridge underneath.

**Gas is the L2 execution fee only.** On an OP Stack chain the total a wallet pays is the L2 execution fee plus an L1 data-availability fee. The Etherscan transaction list exposes `gasUsed` and `gasPrice`, which give the L2 half; the L1 fee isn't in that response. Real spend is therefore somewhat higher than the figure shown, and the UI says so.

The analytics engine (`lib/analytics.ts`) is a pure function over raw rows — no network calls, no clock reads except an injected `now`. That's what makes it unit-testable and the numbers reproducible.

## Getting started

```bash
npm install
cp .env.example .env.local     # add your Etherscan key
npm run dev
```

Open http://localhost:3000 and paste any Base address.

A free Etherscan key at [etherscan.io/apis](https://etherscan.io/apis) covers both chains and allows 5 calls/second — the client throttles itself to stay under it. The key is only ever read server-side, inside the API route; it never reaches the browser.

```bash
npm test         # unit tests for the analytics engine
npm run typecheck
npm run build
```

## The contract

`contracts/src/WalletLensRegistry.sol` lets a wallet publish a snapshot of its own stats onchain. A wallet can only write its own entry, so no snapshot can be forged on someone else's behalf, and anyone can read any entry.

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge test -vvv

# deploy + verify on Base in one step
export PRIVATE_KEY=0x...
export BASE_RPC_URL=https://mainnet.base.org
export ETHERSCAN_API_KEY=...
forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify -vvvv
```

Verifying the contract on Basescan matters beyond good manners — a verified deployment is what turns the contract into a readable credential (see below).

## Deploying as a Mini App

1. Deploy to Vercel (or anywhere that runs Next.js) and set `NEXT_PUBLIC_URL` to the live URL.
2. Add `og.png` (1200×630) and `icon.png` (1024×1024) to `public/`.
3. Run `npx create-onchain --manifest`, sign with the wallet that owns the Farcaster account, and paste the three `FARCASTER_*` values into your environment.
4. Submit the app at [base.dev](https://base.dev).

The manifest is served from `/.well-known/farcaster.json`; the embed metadata lives in `app/layout.tsx`.

## A note on Base Builder Rewards

There is no "Base airdrop" you qualify for by pushing a repo. What does exist is [Base Builder Rewards](https://talent.app/~/ecosystems/base), run with Talent Protocol: a weekly ETH pool distributed to top-ranked builders. Ranking is driven by a Builder Score built from verified GitHub contributions to crypto repositories and verified onchain activity, and there are hard entry requirements — a Basename, a Builder Score of 40 or more, and human verification.

That is why this project is shaped the way it is. A public repo with real commit history feeds the GitHub half of the score. A verified contract deployed on Base feeds the onchain half. Shipping it as a listed Mini App puts it in front of users, and usage counts too. Rewards follow sustained work, so the useful pattern is small commits over many weeks rather than one large push.

Connect your GitHub and wallet at [talent.app](https://talent.app) so the work is attributed to you.

## Project layout

```
app/
  api/wallet/[address]/route.ts   server-side orchestration, hides the API key
  .well-known/farcaster.json/     Mini App manifest
  page.tsx                        the UI
components/                       dashboard, stat cards, heatmap
lib/
  analytics.ts                    pure metric computation
  etherscan.ts                    Etherscan V2 client, paginated + throttled
  basename.ts                     Basename reverse resolution
contracts/                        Foundry project
tests/                            vitest suite for the analytics engine
```

## License

MIT
