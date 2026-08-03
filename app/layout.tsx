import type { Metadata } from 'next';

import { Providers } from './providers';
import './globals.css';

// Deliberately not named `URL` — that would shadow the global URL constructor
// used just below by `metadataBase`.
const APP_URL = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Base Wallet Lens',
  description:
    'Every number Base knows about a wallet: transactions, gas, streaks, bridged ETH and builder signals.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'Base Wallet Lens',
    description: 'Read any wallet’s full history on Base.',
    images: [`${APP_URL}/og.png`],
  },
  other: {
    // Embed metadata that lets Base App and Farcaster render this as a Mini App.
    'fc:frame': JSON.stringify({
      version: 'next',
      imageUrl: `${APP_URL}/og.png`,
      button: {
        title: 'Scan a wallet',
        action: {
          type: 'launch_frame',
          name: 'Base Wallet Lens',
          url: APP_URL,
          splashImageUrl: `${APP_URL}/icon.png`,
          splashBackgroundColor: '#0A0B0D',
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
