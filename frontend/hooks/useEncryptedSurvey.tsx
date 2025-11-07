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
  
  // If we're using a mock FHEVM instance (local Hardhat node), use chainId 31337 for contract lookup
  // This ensures we find the contract even if wallet is connected to a different network
  const effectiveChainId = (() => {
    // Check if we have a local Hardhat deployment (chainId 31337)
    const localhostEntry = EncryptedSurveyAddresses["31337"];
    if (localhostEntry && localhostEntry.address !== ethers.ZeroAddress) {
      // If wallet is not connected or connected to a different network, use localhost
      if (!chainId || chainId !== 31337) {
        console.log(`[useEncryptedSurvey] Using localhost chainId (31337) instead of wallet chainId (${chainId})`);
        return 31337;
      }
    }
    return chainId;
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
      const [idNumber, bankPassword, age]: [string, string, string] = await contract.getMyAnswers();
      console.log(`[EncryptedSurvey] Refreshed user answers:`, { 
        idNumber, 
        bankPassword, 
        age 
      });
      
      // Check if all handles are zero (no submissions yet)
      const allZero = [idNumber, bankPassword, age].every(h => h === "0x0000000000000000000000000000000000000000000000000000000000000000");
      if (allZero) {
        console.log(`[EncryptedSurvey] All answers are zero (no submissions yet)`);
      }
      
      setQuestions(prev => [
        { ...prev[0], handle: idNumber },
        { ...prev[1], handle: bankPassword },
        { ...prev[2], handle: age },
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
          
          // Ensure handle is in the correct format (bytes32)
          console.log(`[EncryptedSurvey] Converting handle to bytes32 format...`);
          const handle = enc.handles[0];
          if (!handle) {
            throw new Error("Encrypted handle is undefined");
          }
          
          // Convert handle to bytes32 hex string
          let handleBytes32: string;
          try {
            if (typeof handle === 'string') {
              console.log(`[EncryptedSurvey] Handle is already a string`);
              handleBytes32 = handle;
            } else if (handle instanceof Uint8Array) {
              console.log(`[EncryptedSurvey] Converting Uint8Array to hex string...`);
              // Convert Uint8Array to hex string
              handleBytes32 = '0x' + Array.from(handle).map((b: number) => b.toString(16).padStart(2, '0')).join('');
              console.log(`[EncryptedSurvey] Conversion complete`);
            } else if (Array.isArray(handle)) {
              console.log(`[EncryptedSurvey] Converting array to hex string...`);
              // Convert array to hex string
              const handleArray = handle as number[];
              handleBytes32 = '0x' + handleArray.map((b: number) => b.toString(16).padStart(2, '0')).join('');
              console.log(`[EncryptedSurvey] Conversion complete`);
            } else {
              throw new Error(`Invalid handle format: ${typeof handle}, constructor: ${handle?.constructor?.name}`);
            }
          } catch (conversionError: any) {
            console.error(`[EncryptedSurvey] Error converting handle:`, conversionError);
            throw conversionError;
          }
          
          console.log(`[EncryptedSurvey] Handle bytes32: ${handleBytes32}`);
          console.log(`[EncryptedSurvey] Handle length: ${handleBytes32.length} characters (should be 66 for 0x + 32 bytes)`);
          
          // Also convert inputProof if it's a Uint8Array
          console.log(`[EncryptedSurvey] Converting inputProof...`);
          let inputProofBytes: string | Uint8Array = enc.inputProof;
          if (enc.inputProof instanceof Uint8Array) {
            console.log(`[EncryptedSurvey] Converting inputProof from Uint8Array to hex string...`);
            inputProofBytes = '0x' + Array.from(enc.inputProof).map((b: number) => b.toString(16).padStart(2, '0')).join('');
            console.log(`[EncryptedSurvey] Converted inputProof from Uint8Array to hex string, length: ${inputProofBytes.length} characters`);
          } else {
            console.log(`[EncryptedSurvey] InputProof is already in correct format`);
          }
          
          let tx: ethers.TransactionResponse;
          let receipt: ethers.TransactionReceipt;
          
          try {
            console.log(`[EncryptedSurvey] Calling submitAnswer with questionId=${questionId}, handle=${handleBytes32.slice(0, 20)}...`);
            console.log(`[EncryptedSurvey] About to call contract.submitAnswer...`);
            tx = await contract.submitAnswer(questionId, handleBytes32, inputProofBytes);
            console.log(`[EncryptedSurvey] ✅ Transaction sent! Hash: ${tx.hash}`);
            
            setMessage(`⏳ Waiting for transaction confirmation... (Hash: ${tx.hash.slice(0, 10)}...)`);
            receipt = await tx.wait();
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
