"use client";

import type { ReactNode } from "react";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia, hardhat } from "wagmi/chains";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Props = {
  children: ReactNode;
};

const chains = [hardhat, sepolia, mainnet];

// Prefer RainbowKit helper to align versions with wagmi v2
// Use environment variable for WalletConnect projectId, or fallback to a placeholder
// Note: Using placeholder projectId will cause WalletConnect/Reown Allowlist errors in console.
// These errors are safe to ignore in development and don't affect core functionality.
// To eliminate these errors, get a valid projectId from https://cloud.walletconnect.com/
// and add it to .env.local, then add localhost:3003 to the project's allowlist.
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";

const wagmiConfig = getDefaultConfig({
  appName: "Encrypted Survey dApp",
  projectId: walletConnectProjectId,
  chains,
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
});

export function Providers({ children }: Props) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider theme={darkTheme()}>
          <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
