import { FhevmRelayerSDKType, FhevmWindowType } from "./fhevmTypes";
import { SDK_CDN_URL } from "./constants";

type TraceType = (message?: unknown, ...optionalParams: unknown[]) => void;

export class RelayerSDKLoader {
  private _trace?: TraceType;

  constructor(options: { trace?: TraceType }) {
    this._trace = options.trace;
  }

  public isLoaded() {
    if (typeof window === "undefined") {
      throw new Error("RelayerSDKLoader: can only be used in the browser.");
    }
    return isFhevmWindowType(window, this._trace);
  }

  public load(): Promise<void> {
    console.log("[RelayerSDKLoader] load...");
    // Ensure this only runs in the browser
    if (typeof window === "undefined") {
      console.log("[RelayerSDKLoader] window === undefined");
      return Promise.reject(
        new Error("RelayerSDKLoader: can only be used in the browser.")
      );
    }

    if ("relayerSDK" in window) {
      if (!isFhevmRelayerSDKType(window.relayerSDK, this._trace)) {
        console.log("[RelayerSDKLoader] window.relayerSDK === undefined");
        throw new Error("RelayerSDKLoader: Unable to load FHEVM Relayer SDK");
      }
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        `script[src="${SDK_CDN_URL}"]`
      );
      if (existingScript) {
        if (!isFhevmWindowType(window, this._trace)) {
          reject(
            new Error(
              "RelayerSDKLoader: window object does not contain a valid relayerSDK object."
            )
          );
        }
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;

      // Add timeout to detect if script never loads
      const timeoutId = setTimeout(() => {
        console.log("[RelayerSDKLoader] Script load timeout - checking if script loaded...");
        if (!isFhevmWindowType(window, this._trace)) {
          console.log("[RelayerSDKLoader] Script load timeout - window.relayerSDK still not available");
          // Don't reject here, let onload/onerror handle it
        }
      }, 10000); // 10 seconds timeout

      script.onload = () => {
        clearTimeout(timeoutId);
        console.log("[RelayerSDKLoader] script onload callback triggered");
        console.log("[RelayerSDKLoader] Script URL:", SDK_CDN_URL);
        console.log("[RelayerSDKLoader] Checking window.relayerSDK immediately...");
        console.log("[RelayerSDKLoader] window.relayerSDK exists:", "relayerSDK" in window);
        console.log("[RelayerSDKLoader] window.relayerSDK value:", (window as any).relayerSDK);
        
        // Poll for window.relayerSDK to be available (script may need time to execute)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total (50 * 100ms)
        const checkInterval = setInterval(() => {
          attempts++;
          console.log(`[RelayerSDKLoader] Polling attempt ${attempts}/${maxAttempts}...`);
          if (isFhevmWindowType(window, this._trace)) {
            console.log("[RelayerSDKLoader] script onload SUCCESS - window.relayerSDK is available");
            clearInterval(checkInterval);
            resolve();
          } else if (attempts >= maxAttempts) {
            console.log("[RelayerSDKLoader] script onload FAILED - window.relayerSDK not available after polling");
            console.log("[RelayerSDKLoader] Final check - window.relayerSDK exists:", "relayerSDK" in window);
            console.log("[RelayerSDKLoader] Final check - window.relayerSDK value:", (window as any).relayerSDK);
            clearInterval(checkInterval);
            reject(
              new Error(
                `RelayerSDKLoader: Relayer SDK script has been successfully loaded from ${SDK_CDN_URL}, however, the window.relayerSDK object is invalid after ${maxAttempts} attempts.`
              )
            );
          }
        }, 100);
      };

      script.onerror = (error) => {
        clearTimeout(timeoutId);
        console.log("[RelayerSDKLoader] script onerror... ", error);
        console.log("[RelayerSDKLoader] Script URL:", SDK_CDN_URL);
        reject(
          new Error(
            `RelayerSDKLoader: Failed to load Relayer SDK from ${SDK_CDN_URL}. This may be due to network issues or CORS restrictions.`
          )
        );
      };

      console.log("[RelayerSDKLoader] add script to DOM...");
      console.log("[RelayerSDKLoader] Script URL:", SDK_CDN_URL);
      document.head.appendChild(script);
      console.log("[RelayerSDKLoader] script added!")
    });
  }
}

function isFhevmRelayerSDKType(
  o: unknown,
  trace?: TraceType
): o is FhevmRelayerSDKType {
  console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: checking object...", o);
  if (typeof o === "undefined") {
    trace?.("RelayerSDKLoader: relayerSDK is undefined");
    console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - undefined");
    return false;
  }
  if (o === null) {
    trace?.("RelayerSDKLoader: relayerSDK is null");
    console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - null");
    return false;
  }
  if (typeof o !== "object") {
    trace?.("RelayerSDKLoader: relayerSDK is not an object");
    console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - not an object, type:", typeof o);
    return false;
  }
  console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: checking initSDK...");
  if (!objHasProperty(o, "initSDK", "function", trace)) {
    trace?.("RelayerSDKLoader: relayerSDK.initSDK is invalid");
    console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - initSDK invalid");
    return false;
  }
  console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: checking createInstance...");
  if (!objHasProperty(o, "createInstance", "function", trace)) {
    trace?.("RelayerSDKLoader: relayerSDK.createInstance is invalid");
    console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - createInstance invalid");
    return false;
  }
  console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: checking SepoliaConfig...");
  if (!objHasProperty(o, "SepoliaConfig", "object", trace)) {
    trace?.("RelayerSDKLoader: relayerSDK.SepoliaConfig is invalid");
    console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - SepoliaConfig invalid");
    return false;
  }
  if ("__initialized__" in o) {
    if (o.__initialized__ !== true && o.__initialized__ !== false) {
      trace?.("RelayerSDKLoader: relayerSDK.__initialized__ is invalid");
      console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: FAILED - __initialized__ invalid");
      return false;
    }
  }
  console.log("[RelayerSDKLoader] isFhevmRelayerSDKType: SUCCESS - all checks passed");
  return true;
}

export function isFhevmWindowType(
  win: unknown,
  trace?: TraceType
): win is FhevmWindowType {
  console.log("[RelayerSDKLoader] isFhevmWindowType: checking window...");
  if (typeof win === "undefined") {
    trace?.("RelayerSDKLoader: window object is undefined");
    console.log("[RelayerSDKLoader] isFhevmWindowType: FAILED - window undefined");
    return false;
  }
  if (win === null) {
    trace?.("RelayerSDKLoader: window object is null");
    console.log("[RelayerSDKLoader] isFhevmWindowType: FAILED - window null");
    return false;
  }
  if (typeof win !== "object") {
    trace?.("RelayerSDKLoader: window is not an object");
    console.log("[RelayerSDKLoader] isFhevmWindowType: FAILED - window not an object");
    return false;
  }
  console.log("[RelayerSDKLoader] isFhevmWindowType: checking relayerSDK property...");
  if (!("relayerSDK" in win)) {
    trace?.("RelayerSDKLoader: window does not contain 'relayerSDK' property");
    console.log("[RelayerSDKLoader] isFhevmWindowType: FAILED - relayerSDK not in window");
    return false;
  }
  console.log("[RelayerSDKLoader] isFhevmWindowType: relayerSDK found, checking type...");
  const result = isFhevmRelayerSDKType(win.relayerSDK, trace);
  console.log("[RelayerSDKLoader] isFhevmWindowType: result:", result);
  return result;
}

function objHasProperty<
  T extends object,
  K extends PropertyKey,
  V extends string // "string", "number", etc.
>(
  obj: T,
  propertyName: K,
  propertyType: V,
  trace?: TraceType
): obj is T &
  Record<
    K,
    V extends "string"
      ? string
      : V extends "number"
      ? number
      : V extends "object"
      ? object
      : V extends "boolean"
      ? boolean
      : V extends "function"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (...args: any[]) => any
      : unknown
  > {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  if (!(propertyName in obj)) {
    trace?.(`RelayerSDKLoader: missing ${String(propertyName)}.`);
    return false;
  }

  const value = (obj as Record<K, unknown>)[propertyName];

  if (value === null || value === undefined) {
    trace?.(`RelayerSDKLoader: ${String(propertyName)} is null or undefined.`);
    return false;
  }

  if (typeof value !== propertyType) {
    trace?.(
      `RelayerSDKLoader: ${String(propertyName)} is not a ${propertyType}.`
    );
    return false;
  }

  return true;
}
