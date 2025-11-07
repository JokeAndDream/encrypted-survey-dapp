import type { Metadata } from "next";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export const metadata: Metadata = {
  title: "Encrypted Survey dApp",
  description: "Privacy-preserving survey using Zama FHEVM",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`zama-bg text-white antialiased`}>
        <div className="fixed inset-0 w-full h-full zama-bg z-[-20] min-w-[850px]"></div>
        <Providers>
          <main className="flex flex-col max-w-screen-lg mx-auto pb-20 min-w-[850px]">
            <nav className="flex w-full px-3 md:px-0 h-fit py-10 justify-between items-center">
              <Image src="/app-logo.svg" alt="App Logo" width={140} height={140} priority style={{ width: 'auto', height: 'auto' }} />
              <div>
                <ConnectButton.Custom>
                  {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                    const ready = mounted;
                    const connected = ready && account && chain && !chain.unsupported;

                    if (!connected) {
                      return (
                        <button
                          type="button"
                          onClick={openConnectModal}
                          className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-white font-medium transition-colors"
                        >
                          Connect Wallet
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={openChainModal}
                          className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
                        >
                          {chain.hasIcon && chain.iconUrl ? (
                            <span className="inline-flex items-center gap-2">
                              <img
                                alt={chain.name ?? "Chain"}
                                src={chain.iconUrl}
                                className="w-4 h-4 rounded-full"
                              />
                              {chain.name}
                            </span>
                          ) : (
                            chain.name ?? "Change Network"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={openAccountModal}
                          className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-white font-medium transition-colors"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </nav>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
