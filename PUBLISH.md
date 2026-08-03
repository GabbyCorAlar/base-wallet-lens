# Publishing to GitHub

I couldn't push directly — there's no GitHub connector available in this session and the sandbox has neither your credentials nor network access to github.com. Everything else is done; these are the last two minutes of work.

## Option A — with the commit history (recommended)

Alongside this folder there's `base-wallet-lens-git-history.bundle`, a portable git repository with seven commits already written. Cloning it gives you the project *and* the history in one step.

```bash
cd <the folder that contains base-wallet-lens-git-history.bundle>
git clone base-wallet-lens-git-history.bundle base-wallet-lens-repo
cd base-wallet-lens-repo
git remote remove origin
```

Then publish. With the [GitHub CLI](https://cli.github.com):

```bash
gh repo create base-wallet-lens --public --source=. --push
```

Or by hand — create an empty repo named `base-wallet-lens` at https://github.com/new (no README, no .gitignore, no license), then:

```bash
git remote add origin https://github.com/<your-username>/base-wallet-lens.git
git push -u origin main
```

## Option B — start fresh from this folder

```bash
cd base-wallet-lens
git init -b main
git add .
git commit -m "feat: Base Wallet Lens — read any wallet's history on Base"
gh repo create base-wallet-lens --public --source=. --push
```

## Before you push

Nothing sensitive is in the repo — `.gitignore` already excludes `.env`, `.env.local`, `node_modules/`, and the Foundry build output. Only `.env.example` is tracked, and it contains empty placeholders. Never commit a file with a real key or private key in it.

## Then

```bash
npm install
cp .env.example .env.local     # paste your Etherscan key
npm run dev
```

Make the repo **public** — private repositories don't count toward Builder Score.
