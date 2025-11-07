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
                <ConnectButton />
              </div>
            </nav>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
