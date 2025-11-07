"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { ethers } from "ethers";

export function useWagmiEthersSigner() {
  const chainId = useChainId();
  const { isConnected } = useAccount();

  const [signer, setSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [readonlyProvider, setReadonlyProvider] = useState<ethers.ContractRunner | undefined>(undefined);

  const connectSigner = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    try {
      const browser = new ethers.BrowserProvider((window as any).ethereum);
      const s = await browser.getSigner();
      setSigner(s);
      setReadonlyProvider(browser);
    } catch {
      setSigner(undefined);
      setReadonlyProvider(undefined);
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      void connectSigner();
    } else {
      setSigner(undefined);
      setReadonlyProvider(undefined);
    }
  }, [isConnected, connectSigner, chainId]);

  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  // Use refs to store current values for stale checks
  const chainIdRef = useRef<number | undefined>(chainId);
  const signerRef = useRef<ethers.JsonRpcSigner | undefined>(signer);
  const signerAddressRef = useRef<string | undefined>(signer?.address);

  // Update refs when values change
  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    signerRef.current = signer;
    signerAddressRef.current = signer?.address;
  }, [signer]);

  // Create stable functions that use refs
  // Initialize with a default function to ensure current is never undefined
  const sameChainRef = useRef<(cid: number | undefined) => boolean>((cid: number | undefined) => cid === chainIdRef.current);
  const sameSignerRef = useRef<(s: ethers.JsonRpcSigner | undefined) => boolean>((s: ethers.JsonRpcSigner | undefined) => s?.address === signerAddressRef.current);

  // Update functions to use current ref values
  sameChainRef.current = (cid: number | undefined) => cid === chainIdRef.current;
  sameSignerRef.current = (s: ethers.JsonRpcSigner | undefined) => s?.address === signerAddressRef.current;

  const sameChain = sameChainRef;
  const sameSigner = sameSignerRef;

  return {
    provider,
    chainId,
    signer,
    readonlyProvider,
    sameChain,
    sameSigner,
  } as const;
}








