'use client';

import { useState, type ReactNode } from 'react';
import { WagmiProvider, type State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ✅ 关键：引入 RainbowKit Provider + 样式
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';

import { getConfig } from '@/wagmi';

export function Providers(props: { children: ReactNode; initialState?: State }) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config} initialState={props.initialState}>
      <QueryClientProvider client={queryClient}>
        {/* 👇 必须包住你所有使用 RainbowKit 的子树（包括 page.tsx） */}
        <RainbowKitProvider theme={lightTheme()}>
          {props.children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
