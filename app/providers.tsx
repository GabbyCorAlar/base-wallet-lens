'use client';

import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';
import type { ReactNode } from 'react';

/**
 * MiniKit wraps OnchainKit + wagmi and adds the Base App / Farcaster host
 * bindings, so the same build runs standalone in a browser and embedded as a
 * Mini App.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{
        appearance: {
          mode: 'dark',
          theme: 'base',
          name: 'Base Wallet Lens',
        },
      }}
    >
      {children}
    </MiniKitProvider>
  );
}
