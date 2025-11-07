import { isAddress, Eip1193Provider, JsonRpcProvider } from "ethers";
import type {
  FhevmInitSDKOptions,
  FhevmInitSDKType,
  FhevmLoadSDKType,
  FhevmWindowType,
} from "./fhevmTypes";
import { isFhevmWindowType, RelayerSDKLoader } from "./RelayerSDKLoader";
import { publicKeyStorageGet, publicKeyStorageSet } from "./PublicKeyStorage";
import { FhevmInstance, FhevmInstanceConfig } from "../fhevmTypes";

export class FhevmReactError extends Error {
  code: string;
  constructor(code: string, message?: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = "FhevmReactError";
  }
}

function throwFhevmError(
  code: string,
  message?: string,
  cause?: unknown
): never {
  throw new FhevmReactError(code, message, cause ? { cause } : undefined);
}

const isFhevmInitialized = (): boolean => {
  if (!isFhevmWindowType(window, console.log)) {
    return false;
  }
  return window.relayerSDK.__initialized__ === true;
};

const fhevmLoadSDK: FhevmLoadSDKType = () => {
  const loader = new RelayerSDKLoader({ trace: console.log });
  return loader.load();
};

const fhevmInitSDK: FhevmInitSDKType = async (
  options?: FhevmInitSDKOptions
) => {
  if (!isFhevmWindowType(window, console.log)) {
    throw new Error("window.relayerSDK is not available");
  }
  const result = await window.relayerSDK.initSDK(options);
  window.relayerSDK.__initialized__ = result;
  if (!result) {
    throw new Error("window.relayerSDK.initSDK failed.");
  }
  return true;
};

function checkIsAddress(a: unknown): a is `0x${string}` {
  if (typeof a !== "string") {
    return false;
  }
  if (!isAddress(a)) {
    return false;
  }
  return true;
}

export class FhevmAbortError extends Error {
  constructor(message = "FHEVM operation was cancelled") {
    super(message);
    this.name = "FhevmAbortError";
  }
}

type FhevmRelayerStatusType =
  | "sdk-loading"
  | "sdk-loaded"
  | "sdk-initializing"
  | "sdk-initialized"
  | "creating";

async function getChainId(
  providerOrUrl: Eip1193Provider | string
): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("web3_clientVersion", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "WEB3_CLIENTVERSION_ERROR",
      `The URL ${rpcUrl} is not a Web3 node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<
  | {
      ACLAddress: `0x${string}`;
      InputVerifierAddress: `0x${string}`;
      KMSVerifierAddress: `0x${string}`;
    }
  | undefined
> {
  const version = await getWeb3Client(rpcUrl);
  if (
    typeof version !== "string" ||
    !version.toLowerCase().includes("hardhat")
  ) {
    // Not a Hardhat Node
    return undefined;
  }
  try {
    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }
    if (
      !(
        "ACLAddress" in metadata &&
        typeof metadata.ACLAddress === "string" &&
        metadata.ACLAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    if (
      !(
        "InputVerifierAddress" in metadata &&
        typeof metadata.InputVerifierAddress === "string" &&
        metadata.InputVerifierAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    if (
      !(
        "KMSVerifierAddress" in metadata &&
        typeof metadata.KMSVerifierAddress === "string" &&
        metadata.KMSVerifierAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    return metadata;
  } catch {
    // Not a FHEVM Hardhat Node
    return undefined;
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("fhevm_relayer_metadata", []);
    return version;
  } catch (e) {
    // Don't throw error here, let the caller handle it
    // This allows tryFetchFHEVMHardhatNodeRelayerMetadata to return undefined
    // instead of throwing, which prevents fallback to real relayer SDK
    console.warn(`Failed to get FHEVM relayer metadata from ${rpcUrl}:`, e);
    return undefined;
  } finally {
    rpc.destroy();
  }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

async function resolve(
  providerOrUrl: Eip1193Provider | string,
  mockChains?: Record<number, string>
): Promise<ResolveResult> {
  const _mockChains: Record<number, string> = {
    31337: "http://localhost:8545",
    ...(mockChains ?? {}),
  };

  // If provider is a string (RPC URL), use it directly
  if (typeof providerOrUrl === "string") {
    const chainId = await getChainId(providerOrUrl);
    console.log(`[resolve] Provider is string URL, chainId=${chainId}, rpcUrl=${providerOrUrl}`);
    
    if (Object.hasOwn(_mockChains, chainId)) {
      console.log(`[resolve] Detected mock chain ${chainId}, using rpcUrl=${providerOrUrl}`);
      return { isMock: true, chainId, rpcUrl: providerOrUrl };
    }
    return { isMock: false, chainId, rpcUrl: providerOrUrl };
  }

  // If provider is Eip1193Provider (wallet), try to get chainId
  let chainId: number;
  try {
    chainId = await getChainId(providerOrUrl);
  } catch (error) {
    // If we can't get chainId (e.g., wallet not connected), check if we have a default mock chain
    console.log(`[resolve] Failed to get chainId from provider, checking for default mock chain`);
    if (Object.keys(_mockChains).length > 0) {
      const defaultChainId = Number(Object.keys(_mockChains)[0]);
      const defaultRpcUrl = _mockChains[defaultChainId];
      console.log(`[resolve] Using default mock chain ${defaultChainId} with rpcUrl=${defaultRpcUrl}`);
      return { isMock: true, chainId: defaultChainId, rpcUrl: defaultRpcUrl };
    }
    throw error;
  }

  // Resolve rpc url
  let rpcUrl = undefined;

  console.log(`[resolve] chainId=${chainId}, rpcUrl=${rpcUrl}, mockChains=`, _mockChains);

  // Help Typescript solver here:
  if (Object.hasOwn(_mockChains, chainId)) {
    if (!rpcUrl) {
      rpcUrl = _mockChains[chainId];
    }

    console.log(`[resolve] Detected mock chain ${chainId}, using rpcUrl=${rpcUrl}`);
    return { isMock: true, chainId, rpcUrl };
  }

  // If not a mock chain but we have mock chains configured, and we're in development,
  // we can still use the local Hardhat node if available
  // BUT: Only use mock chain if we're actually on localhost (not Vercel/production)
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  
  console.log(`[resolve] Checking localhost: hostname=${typeof window !== "undefined" ? window.location.hostname : "undefined"}, isLocalhost=${isLocalhost}`);
  
  if (Object.keys(_mockChains).length > 0 && isLocalhost) {
    const defaultChainId = Number(Object.keys(_mockChains)[0]);
    const defaultRpcUrl = _mockChains[defaultChainId];
    console.log(`[resolve] Not a mock chain (chainId=${chainId}), but using default mock chain ${defaultChainId} for localhost development`);
    return { isMock: true, chainId: defaultChainId, rpcUrl: defaultRpcUrl };
  }

  console.log(`[resolve] Not a mock chain (chainId=${chainId} not in mockChains), using real FHEVM relayer for production`);
  return { isMock: false, chainId, rpcUrl };
}

export const createFhevmInstance = async (parameters: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
  signal: AbortSignal;
  onStatusChange?: (status: FhevmRelayerStatusType) => void;
}): Promise<FhevmInstance> => {
  const throwIfAborted = () => {
    if (signal.aborted) throw new FhevmAbortError();
  };

  const notify = (status: FhevmRelayerStatusType) => {
    if (onStatusChange) onStatusChange(status);
  };

  const {
    signal,
    onStatusChange,
    provider: providerOrUrl,
    mockChains,
  } = parameters;

  // Resolve chainId
  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);

  console.log(`[createFhevmInstance] Resolved: isMock=${isMock}, chainId=${chainId}, rpcUrl=${rpcUrl}`);

  if (isMock) {
    console.log(`[createFhevmInstance] Detected mock chain, attempting to fetch FHEVM metadata from ${rpcUrl}`);
    
    // Check if we're actually on localhost before trying to connect
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    
    if (!isLocalhost) {
      console.log(`[createFhevmInstance] Not on localhost (hostname=${typeof window !== "undefined" ? window.location.hostname : "undefined"}), cannot use mock chain. Falling back to real FHEVM relayer.`);
      // Force use of real FHEVM relayer instead of mock
      // Skip the mock instance creation and continue to real SDK initialization below
    } else {
      // Throws an error if cannot connect or url does not refer to a Web3 client
      const fhevmRelayerMetadata =
        await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);

      console.log(`[createFhevmInstance] FHEVM metadata:`, fhevmRelayerMetadata ? 'found' : 'not found');

      if (fhevmRelayerMetadata) {
        // fhevmRelayerMetadata is defined, which means rpcUrl refers to a FHEVM Hardhat Node
        notify("creating");

        //////////////////////////////////////////////////////////////////////////
        // 
        // WARNING!!
        // ALWAY USE DYNAMIC IMPORT TO AVOID INCLUDING THE ENTIRE FHEVM MOCK LIB 
        // IN THE FINAL PRODUCTION BUNDLE!!
        // 
        //////////////////////////////////////////////////////////////////////////
        const fhevmMock = await import("./mock/fhevmMock");
        const mockInstance = await fhevmMock.fhevmMockCreateInstance({
          rpcUrl,
          chainId,
          metadata: fhevmRelayerMetadata,
        });

        throwIfAborted();

        return mockInstance;
      } else {
        // If we're on a mock chain but can't get FHEVM metadata, throw an error
        // instead of falling back to real relayer SDK which won't work with local node
        console.error(`[createFhevmInstance] Mock chain detected but FHEVM metadata not found. Throwing error to prevent fallback to real SDK.`);
        throw new FhevmReactError(
          "FHEVM_MOCK_CHAIN_NO_METADATA",
          `Chain ${chainId} is configured as a mock chain but FHEVM relayer metadata could not be fetched from ${rpcUrl}. Please ensure Hardhat node is running with FHEVM plugin enabled.`
        );
      }
    }
  }

  console.log(`[createFhevmInstance] Not a mock chain or mock chain handling failed, falling back to real relayer SDK`);
  throwIfAborted();

  if (!isFhevmWindowType(window, console.log)) {
    notify("sdk-loading");

    // throws an error if failed
    await fhevmLoadSDK();
    throwIfAborted();

    notify("sdk-loaded");
  }

  // notify that state === "sdk-loaded"

  if (!isFhevmInitialized()) {
    notify("sdk-initializing");

    // throws an error if failed
    await fhevmInitSDK();
    throwIfAborted();

    notify("sdk-initialized");
  }

  const relayerSDK = (window as unknown as FhevmWindowType).relayerSDK;

  const aclAddress = relayerSDK.SepoliaConfig.aclContractAddress;
  if (!checkIsAddress(aclAddress)) {
    throw new Error(`Invalid address: ${aclAddress}`);
  }

  const pub = await publicKeyStorageGet(aclAddress);
  throwIfAborted();

  const config: FhevmInstanceConfig = {
    ...relayerSDK.SepoliaConfig,
    network: providerOrUrl,
    publicKey: pub.publicKey,
    publicParams: pub.publicParams,
  };

  // notify that state === "creating"
  notify("creating");

  const instance = await relayerSDK.createInstance(config);

  // Save the key even if aborted
  await publicKeyStorageSet(
    aclAddress,
    instance.getPublicKey(),
    instance.getPublicParams(2048)
  );

  throwIfAborted();

  return instance;
};
