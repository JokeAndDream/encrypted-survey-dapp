"use client";

import { ethers } from "ethers";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { EncryptedSurveyAddresses } from "@/abi/EncryptedSurveyAddresses";
import { EncryptedSurveyABI } from "@/abi/EncryptedSurveyABI";

export type QuestionId = 0 | 1 | 2;

export type QuestionData = {
  questionId: QuestionId;
  question: string;
  handle: string | undefined;
  decrypted: string | bigint | boolean | undefined;
};

type ClearTalliesType = {
  idNumber: string | bigint | boolean;
  bankPassword: string | bigint | boolean;
  age: string | bigint | boolean;
};

type SurveyInfoType = {
  abi: typeof EncryptedSurveyABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getSurveyByChainId(chainId: number | undefined): SurveyInfoType {
  if (!chainId) {
    return { abi: EncryptedSurveyABI.abi };
  }
  const entry = EncryptedSurveyAddresses[chainId.toString() as keyof typeof EncryptedSurveyAddresses];
  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: EncryptedSurveyABI.abi, chainId };
  }
  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: EncryptedSurveyABI.abi,
  };
}

export const useEncryptedSurvey = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<(ethersSigner: ethers.JsonRpcSigner | undefined) => boolean>;
}) => {
  const { instance, fhevmDecryptionSignatureStorage, chainId, ethersSigner, ethersReadonlyProvider, sameChain, sameSigner } = parameters;
  
  // Determine effective chain ID for contract lookup
  // Priority: 1) Use wallet chainId if contract is deployed on that network
  //           2) Fall back to localhost (31337) ONLY if we're on localhost and wallet is not connected
  const effectiveChainId = (() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "undefined";
    console.log(`[useEncryptedSurvey] effectiveChainId: chainId=${chainId}, hostname=${hostname}`);

    const isLocalhost = typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "0.0.0.0");

    const localhostEntry = EncryptedSurveyAddresses["31337"];
    const sepoliaEntry = EncryptedSurveyAddresses["11155111"];

    // 1) Wallet connected
    if (typeof chainId === "number") {
      const chainEntry = EncryptedSurveyAddresses[chainId.toString() as keyof typeof EncryptedSurveyAddresses];
      console.log(`[useEncryptedSurvey] effectiveChainId: chainEntry for ${chainId}:`, chainEntry);

      if (chainEntry && chainEntry.address !== ethers.ZeroAddress) {
        // Prevent accidentally using Hardhat (31337) when running in production
        if (chainId === 31337 && !isLocalhost) {
          if (sepoliaEntry && sepoliaEntry.address !== ethers.ZeroAddress) {
            console.log(`[useEncryptedSurvey] effectiveChainId: Ignoring Hardhat chainId (31337) on non-localhost (${hostname}), switching to Sepolia (11155111).`);
            return sepoliaEntry.chainId;
          }
          console.warn(`[useEncryptedSurvey] effectiveChainId: Hardhat chainId (31337) detected on non-localhost but Sepolia deployment not found. Returning undefined.`);
          return undefined;
        }

        console.log(`[useEncryptedSurvey] Using wallet chainId (${chainId}) for contract lookup`);
        return chainId;
      }

      console.log(`[useEncryptedSurvey] effectiveChainId: No deployment found for chainId ${chainId}`);
    } else {
      console.log(`[useEncryptedSurvey] effectiveChainId: chainId is undefined (wallet may be disconnected)`);
    }

    // 2) Wallet not connected or chain not deployed
    if (isLocalhost) {
      if (localhostEntry && localhostEntry.address !== ethers.ZeroAddress) {
        console.log(`[useEncryptedSurvey] effectiveChainId: Defaulting to localhost Hardhat deployment (31337).`);
        return 31337;
      }
      console.warn(`[useEncryptedSurvey] effectiveChainId: Localhost detected but no Hardhat deployment found.`);
      return undefined;
    }

    if (sepoliaEntry && sepoliaEntry.address !== ethers.ZeroAddress) {
      console.log(`[useEncryptedSurvey] effectiveChainId: Defaulting to Sepolia (11155111) for production environment.`);
      return sepoliaEntry.chainId;
    }

    console.warn(`[useEncryptedSurvey] effectiveChainId: No suitable deployment found, returning undefined.`);
    return undefined;
  })();

  const [questions, setQuestions] = useState<QuestionData[]>([
    { questionId: 0, question: "What is your ID number?", handle: undefined, decrypted: undefined },
    { questionId: 1, question: "What is your bank card password?", handle: undefined, decrypted: undefined },
    { questionId: 2, question: "What is your age?", handle: undefined, decrypted: undefined },
  ]);
  const [clearTallies, setClearTallies] = useState<ClearTalliesType | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const clearTalliesRef = useRef<ClearTalliesType>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDecryptingRef = useRef<boolean>(isDecrypting);
  const isSubmittingRef = useRef<boolean>(isSubmitting);

  const surveyRef = useRef<SurveyInfoType | undefined>(undefined);

  const survey = useMemo(() => {
    const c = getSurveyByChainId(effectiveChainId);
    surveyRef.current = c;
    if (!c.address) {
      setMessage(`EncryptedSurvey deployment not found for chainId=${effectiveChainId}.`);
    }
    return c;
  }, [effectiveChainId]);

  const isDeployed = useMemo(() => {
    if (!survey) return undefined;
    return Boolean(survey.address) && survey.address !== ethers.ZeroAddress;
  }, [survey]);

  const canGetTallies = useMemo(() => {
    return survey.address && ethersReadonlyProvider && !isRefreshing;
  }, [survey.address, ethersReadonlyProvider, isRefreshing]);

  const refreshTallies = useCallback(async () => {
    if (isRefreshingRef.current) {
      console.log(`[EncryptedSurvey] Refresh already in progress, skipping...`);
      return;
    }
    if (!surveyRef.current?.address || !ethersReadonlyProvider || !ethersSigner) {
      console.log(`[EncryptedSurvey] Cannot refresh: address=${surveyRef.current?.address}, provider=${!!ethersReadonlyProvider}, signer=${!!ethersSigner}`);
      return;
    }
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    const thisAddress = surveyRef.current.address;
    try {
      console.log(`[EncryptedSurvey] Refreshing user answers from contract ${thisAddress}...`);
      // Use signer to call getMyAnswers() which uses msg.sender
      const contract = new ethers.Contract(thisAddress, surveyRef.current.abi, ethersSigner);
      
      // Call getMyAnswers() to get current user's encrypted answers
      // Handle potential decoding errors by catching and retrying with staticCall
      let idNumber: string;
      let bankPassword: string;
      let age: string;
      
      try {
        // Try calling getMyAnswers() directly
        [idNumber, bankPassword, age] = await contract.getMyAnswers();
        console.log(`[EncryptedSurvey] Refreshed user answers:`, { 
          idNumber, 
          bankPassword, 
          age 
        });
      } catch (decodeError: any) {
        // If decoding fails, try using callStatic with explicit return types
        console.warn(`[EncryptedSurvey] getMyAnswers() decoding failed, trying callStatic:`, decodeError);
        try {
          // Use callStatic to get raw bytes, then decode manually
          const result = await contract.getMyAnswers.staticCall();
          if (Array.isArray(result) && result.length === 3) {
            idNumber = result[0];
            bankPassword = result[1];
            age = result[2];
            console.log(`[EncryptedSurvey] Refreshed user answers via staticCall:`, { 
              idNumber, 
              bankPassword, 
              age 
            });
          } else {
            throw new Error("Invalid result format from getMyAnswers()");
          }
        } catch (staticCallError: any) {
          console.error(`[EncryptedSurvey] staticCall also failed:`, staticCallError);
          // Try using call() with explicit data encoding
          try {
            const iface = new ethers.Interface(surveyRef.current.abi);
            const data = iface.encodeFunctionData("getMyAnswers", []);
            const result = await ethersSigner.call({
              to: thisAddress,
              data: data,
            });
            const decoded = iface.decodeFunctionResult("getMyAnswers", result);
            idNumber = decoded[0];
            bankPassword = decoded[1];
            age = decoded[2];
            console.log(`[EncryptedSurvey] Refreshed user answers via call():`, { 
              idNumber, 
              bankPassword, 
              age 
            });
          } catch (callError: any) {
            console.error(`[EncryptedSurvey] call() also failed:`, callError);
            // If all methods fail, set all handles to undefined
            idNumber = "0x";
            bankPassword = "0x";
            age = "0x";
          }
        }
      }
      
      // Convert zero bytes32 to undefined, otherwise use the handle
      const normalizeHandle = (h: string): string | undefined => {
        if (!h || h === "0x" || h === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          return undefined;
        }
        return h;
      };
      
      const allZero = [idNumber, bankPassword, age].every(h => !h || h === "0x" || h === "0x0000000000000000000000000000000000000000000000000000000000000000");
      if (allZero) {
        console.log(`[EncryptedSurvey] All answers are zero (no submissions yet)`);
      }
      
      setQuestions(prev => [
        { ...prev[0], handle: normalizeHandle(idNumber) },
        { ...prev[1], handle: normalizeHandle(bankPassword) },
        { ...prev[2], handle: normalizeHandle(age) },
      ]);
    } catch (error: any) {
      console.error(`[EncryptedSurvey] Failed to refresh user answers:`, error);
      console.error(`[EncryptedSurvey] Error details:`, {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        reason: error?.reason,
        shortMessage: error?.shortMessage,
      });
      // Don't update state on error to avoid infinite loops
      // Only log the error
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [ethersReadonlyProvider, ethersSigner]);

  const hasRefreshedRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Only refresh once when contract address, provider, or signer changes
    if (survey.address && ethersReadonlyProvider && ethersSigner && !isRefreshing && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      const timeoutId = setTimeout(() => {
        refreshTallies();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    
    // Reset flag when address, provider, or signer changes
    if (!survey.address || !ethersReadonlyProvider || !ethersSigner) {
      hasRefreshedRef.current = false;
    }
  }, [survey.address, ethersReadonlyProvider, ethersSigner, refreshTallies, isRefreshing]);

  const canDecrypt = useMemo(() => {
    return (
      survey.address && instance && ethersSigner && !isRefreshing && !isDecrypting && 
      questions.every(q => q.handle)
    );
  }, [survey.address, instance, ethersSigner, isRefreshing, isDecrypting, questions]);

  const decryptTallies = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current) return;
    if (!survey.address || !instance || !ethersSigner) return;
    if (!questions.every(q => q.handle)) return;

    const thisChainId = chainId;
    const thisAddress = survey.address;
    const thisSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Start decrypt tallies");

    const run = async () => {
      const isStale = () => thisAddress !== surveyRef.current?.address || !sameChain.current(thisChainId) || !sameSigner.current(thisSigner);
      try {
        setMessage("🔑 Loading decryption signature...");
        console.log(`[EncryptedSurvey] Decrypt Step 1/3: Loading decryption signature for contract ${thisAddress}`);
        
        if (!instance) {
          throw new Error("FHEVM instance is not available");
        }
        
        const sig = await FhevmDecryptionSignature.loadOrSign(
          instance,
          [thisAddress],
          ethersSigner,
          fhevmDecryptionSignatureStorage
        );
        
        if (!sig) {
          throw new Error("Unable to build FHEVM decryption signature");
        }
        
        if (isStale()) {
          setMessage("❌ Decryption cancelled: chain or signer changed");
          return;
        }
        
        console.log(`[EncryptedSurvey] Decrypt Step 2/3: Decryption signature loaded, decrypting tallies...`);
        setMessage("🔓 Decrypting survey results...");
        
        // Decrypt all handles (one per question now)
        const handles = questions.map(q => ({
          handle: q.handle!,
          contractAddress: thisAddress,
        }));
        
        const res = await instance.userDecrypt(
          handles,
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );
        
        if (isStale()) {
          setMessage("❌ Decryption cancelled: chain or signer changed");
          return;
        }
        
        console.log(`[EncryptedSurvey] ✅ Decrypt Step 3/3: Decryption completed!`, res);
        
        // Update questions with decrypted values (user's own answers)
        setQuestions(prev => prev.map((q, idx) => ({
          ...q,
          decrypted: res[q.handle!],
        })));
        
        // Store decrypted values for summary display
        setClearTallies({
          idNumber: res[questions[0].handle!],
          bankPassword: res[questions[1].handle!],
          age: res[questions[2].handle!],
        });
        
        clearTalliesRef.current = {
          idNumber: res[questions[0].handle!],
          bankPassword: res[questions[1].handle!],
          age: res[questions[2].handle!],
        };
        
        setMessage(`✅ Decryption successful!`);
      } catch (error: any) {
        console.error(`[EncryptedSurvey] ❌ Decrypt error:`, error);
        const errorMessage = error?.message || error?.toString() || "Unknown error";
        setMessage(`❌ Decryption error: ${errorMessage}`);
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };
    run();
  }, [chainId, ethersSigner, fhevmDecryptionSignatureStorage, instance, questions, sameChain, sameSigner, survey.address]);

  const canSubmit = useMemo(() => {
    return survey.address && instance && ethersSigner && !isRefreshing && !isSubmitting;
  }, [survey.address, instance, ethersSigner, isRefreshing, isSubmitting]);

  const submit = useCallback(
    (questionId: QuestionId, value: number) => {
      if (isRefreshingRef.current || isSubmittingRef.current) {
        console.log(`[EncryptedSurvey] Submit blocked: isRefreshing=${isRefreshingRef.current}, isSubmitting=${isSubmittingRef.current}`);
        return;
      }
      if (!survey.address || !instance || !ethersSigner) {
        console.log(`[EncryptedSurvey] Submit blocked: address=${survey.address}, instance=${!!instance}, signer=${!!ethersSigner}`);
        setMessage("❌ Please connect wallet first");
        return;
      }

      // Validate value is a positive integer within uint32 range
      if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
        setMessage("❌ Please enter a valid number (0-4294967295)");
        return;
      }

      const thisChainId = chainId;
      const thisAddress = survey.address;
      const thisSigner = ethersSigner;
      const contract = new ethers.Contract(thisAddress, survey.abi, thisSigner);
      const questionText = questions[questionId].question;

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setMessage(`Starting to submit question ${questionId + 1}: ${questionText}...`);
      console.log(`[EncryptedSurvey] Starting submit for question ${questionId + 1}: ${questionText}, value: ${value}`);

      const run = async () => {
        const isStale = () => thisAddress !== surveyRef.current?.address || !sameChain.current(thisChainId) || !sameSigner.current(thisSigner);
        try {
          // Let the browser repaint before running 'input.encrypt()' (CPU-costly)
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          setMessage(`🔐 Encrypting answer ${value} (Question ${questionId + 1}: ${questionText})...`);
          console.log(`[EncryptedSurvey] Step 1/5: Creating encrypted input for address ${thisSigner.address} on contract ${thisAddress}`);
          
          if (!instance) {
            throw new Error("FHEVM instance is not available");
          }
          
          const input = instance.createEncryptedInput(thisAddress, thisSigner.address);
          console.log(`[EncryptedSurvey] Step 2/5: Encrypted input created, adding value ${value}`);
          
          input.add32(value);
          console.log(`[EncryptedSurvey] Step 3/5: Value added, encrypting (this may take a moment - please wait)...`);
          setMessage(`🔐 Encrypting... (this may take a few seconds, please wait)`);
          
          // is CPU-intensive (browser may freeze a little when FHE-WASM modules are loading)
          const enc = await input.encrypt();
          console.log(`[EncryptedSurvey] ✅ Step 4/5: Encryption completed!`);
          console.log(`[EncryptedSurvey] Encrypted handle type: ${typeof enc.handles[0]}`);
          console.log(`[EncryptedSurvey] Encrypted handle value:`, enc.handles[0]);
          console.log(`[EncryptedSurvey] Encrypted handles array:`, enc.handles);
          console.log(`[EncryptedSurvey] Input proof type: ${typeof enc.inputProof}`);
          console.log(`[EncryptedSurvey] Input proof length: ${enc.inputProof?.length || 'undefined'} bytes`);
          
          // Check if stale
          const stale = isStale();
          const addressMatch = thisAddress === surveyRef.current?.address;
          const chainMatch = sameChain.current(thisChainId);
          const signerMatch = sameSigner.current(thisSigner);
          console.log(`[EncryptedSurvey] Checking if stale: ${stale}`);
          console.log(`[EncryptedSurvey] Stale check details:`, {
            addressMatch,
            chainMatch,
            signerMatch,
            thisAddress,
            currentAddress: surveyRef.current?.address,
            thisChainId,
            currentChainId: chainId,
            thisSignerAddress: thisSigner?.address,
          });
          if (stale) {
            console.log(`[EncryptedSurvey] Transaction is stale, cancelling...`);
            if (!addressMatch) {
              setMessage("❌ Transaction cancelled: contract address changed");
            } else if (!chainMatch) {
              setMessage("❌ Transaction cancelled: chain changed");
            } else if (!signerMatch) {
              setMessage("❌ Transaction cancelled: signer changed");
            } else {
              setMessage("❌ Transaction cancelled: unknown reason");
            }
            return;
          }
          
          console.log(`[EncryptedSurvey] Not stale, proceeding to submit...`);
          setMessage(`📤 Submitting encrypted answer to contract...`);
          console.log(`[EncryptedSurvey] Step 5/5: Submitting transaction with questionId=${questionId}`);
          console.log(`[EncryptedSurvey] Contract address: ${thisAddress}, Signer: ${thisSigner.address}`);
          
          // Use enc.handles[0] and enc.inputProof directly, similar to useFHECounter
          // The ethers.js contract interface will handle the conversion automatically
          if (!enc.handles[0]) {
            throw new Error("Encrypted handle is undefined");
          }
          
          if (!enc.inputProof) {
            throw new Error("Input proof is undefined");
          }
          
          console.log(`[EncryptedSurvey] Using handle and inputProof directly (ethers.js will handle conversion)`);
          
          let tx: ethers.TransactionResponse;
          let receipt: ethers.TransactionReceipt;
          
          try {
            // Check if user has already answered this question before submitting
            try {
              const hasAnswered = await contract.hasAnswered(thisSigner.address, questionId);
              if (hasAnswered) {
                const errorMsg = `You have already answered question ${questionId + 1}. Each question can only be answered once.`;
                console.warn(`[EncryptedSurvey] ${errorMsg}`);
                setMessage(`❌ ${errorMsg}`);
                return;
              }
            } catch (checkError: any) {
              console.warn(`[EncryptedSurvey] Failed to check hasAnswered, proceeding anyway:`, checkError);
            }
            
            console.log(`[EncryptedSurvey] Calling submitAnswer with questionId=${questionId}...`);
            
            // Try static call first to get better error message (this will fail with the same error but earlier)
            try {
              console.log(`[EncryptedSurvey] Attempting static call to validate parameters...`);
              await contract.submitAnswer.staticCall(questionId, enc.handles[0], enc.inputProof);
              console.log(`[EncryptedSurvey] Static call succeeded, proceeding with transaction...`);
            } catch (staticError: any) {
              console.error(`[EncryptedSurvey] Static call failed:`, staticError);
              console.error(`[EncryptedSurvey] Static call error details:`, {
                message: staticError?.message,
                code: staticError?.code,
                data: staticError?.data,
                reason: staticError?.reason,
              });
              // If static call fails, the transaction will also fail, so throw early with better error message
              throw staticError;
            }
            
            // Pass handle and inputProof directly, similar to useFHECounter
            tx = await contract.submitAnswer(questionId, enc.handles[0], enc.inputProof);
            console.log(`[EncryptedSurvey] ✅ Transaction sent! Hash: ${tx.hash}`);
            
            setMessage(`⏳ Waiting for transaction confirmation... (Hash: ${tx.hash.slice(0, 10)}...)`);
            const receiptOrNull = await tx.wait();
            if (!receiptOrNull) {
              throw new Error("Transaction receipt is null");
            }
            receipt = receiptOrNull;
            console.log(`[EncryptedSurvey] ✅ Transaction confirmed! Block: ${receipt.blockNumber}, Hash: ${tx.hash}`);
          } catch (txError: any) {
            console.error(`[EncryptedSurvey] ❌ Transaction submission failed:`, txError);
            console.error(`[EncryptedSurvey] Transaction error details:`, {
              message: txError?.message,
              code: txError?.code,
              data: txError?.data,
              reason: txError?.reason,
              shortMessage: txError?.shortMessage,
            });
            
            // Parse error message to provide better user feedback
            let errorMessage = "Transaction failed";
            if (txError?.data) {
              // Check for common error selectors
              const errorData = txError.data;
              if (typeof errorData === 'string' && errorData.length > 10) {
                const errorSelector = errorData.slice(0, 10);
                console.log(`[EncryptedSurvey] Error selector: ${errorSelector}`);
                
                // Common error selectors (first 4 bytes of keccak256 hash)
                // "Already answered this question" = keccak256("Already answered this question")
                // "Invalid question ID" = keccak256("Invalid question ID")
                
                // Try to decode error message
                if (surveyRef.current) {
                  try {
                    const iface = new ethers.Interface(surveyRef.current.abi);
                    const decodedError = iface.parseError(errorData);
                    if (decodedError) {
                      errorMessage = `Contract error: ${decodedError.name}`;
                      console.log(`[EncryptedSurvey] Decoded error:`, decodedError);
                    }
                  } catch (decodeErr) {
                    console.warn(`[EncryptedSurvey] Could not decode error:`, decodeErr);
                  }
                }
              }
            }
            
            // Check for specific error messages
            if (txError?.message?.includes("Already answered")) {
              errorMessage = `You have already answered question ${questionId + 1}. Each question can only be answered once.`;
            } else if (txError?.message?.includes("Invalid question ID")) {
              errorMessage = `Invalid question ID: ${questionId}. Please try again.`;
            } else if (txError?.message?.includes("execution reverted")) {
              // Check for specific error selector 0x7a47c9a2
              const errorSelector = txError?.data?.slice(0, 10);
              if (errorSelector === "0x7a47c9a2") {
                errorMessage = `FHEVM error: Invalid input proof or encrypted value. This may be due to: 1) FHEVM configuration issue on Sepolia, 2) Invalid encryption parameters, or 3) Network connectivity issue. Please try again or check FHEVM status.`;
              } else {
                errorMessage = `Transaction reverted. This may be due to: 1) You have already answered this question, 2) Invalid input proof, or 3) FHEVM configuration issue. Error selector: ${errorSelector || 'unknown'}`;
              }
            }
            
            setMessage(`❌ ${errorMessage}`);
            throw txError; // Re-throw to be caught by outer catch
          }
          
          if (isStale()) {
            setMessage("❌ Transaction cancelled: chain or signer changed");
            return;
          }
          
          console.log(`[EncryptedSurvey] ✅ Transaction confirmed! Block: ${receipt.blockNumber}, Hash: ${tx.hash}`);
          setMessage(`✅ Submit successful! Refreshing ciphertext...`);
          
          // Wait a bit for the transaction to be fully processed
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          // Immediately refresh tallies to show the encrypted handles
          try {
            await refreshTallies();
            setMessage(`✅ Question ${questionId + 1} answer submitted, ciphertext updated!`);
          } catch (refreshError) {
            console.error(`[EncryptedSurvey] Failed to refresh after submit:`, refreshError);
            setMessage(`✅ Question ${questionId + 1} answer submitted, but failed to refresh ciphertext. Please refresh the page manually.`);
          }
        } catch (error: any) {
          console.error(`[EncryptedSurvey] ❌ Submit error:`, error);
          const errorMessage = error?.message || error?.toString() || "Unknown error";
          setMessage(`❌ Error: ${errorMessage}`);
          
          // Try to refresh anyway in case the transaction went through
          try {
            await refreshTallies();
          } catch (refreshError) {
            console.error(`[EncryptedSurvey] Failed to refresh after error:`, refreshError);
          }
        } finally {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      };
      run();
    },
    [chainId, ethersSigner, instance, questions, refreshTallies, sameChain, sameSigner, survey.address, survey.abi]
  );

  return {
    contractAddress: survey.address,
    canGetTallies,
    canDecrypt,
    canSubmit,
    decryptTallies,
    submit,
    refreshTallies,
    questions,
    clearTallies,
    isDecrypting,
    isRefreshing,
    isSubmitting,
    message,
    isDeployed,
  };
};
