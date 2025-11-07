"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useEncryptedSurvey } from "@/hooks/useEncryptedSurvey";
import { useWagmiEthersSigner } from "@/hooks/useWagmiEthersSigner";

export function EncryptedSurvey() {
  const { storage } = useInMemoryStorage();
  const { provider, chainId, signer, readonlyProvider, sameChain, sameSigner } = useWagmiEthersSigner();

  const { instance, status: fhevmStatus, error: fhevmError } = useFhevm({ provider, chainId, enabled: true, initialMockChains: { 31337: "http://localhost:8545" } });

  const survey = useEncryptedSurvey({
    instance,
    fhevmDecryptionSignatureStorage: storage,
    chainId,
    ethersSigner: signer,
    ethersReadonlyProvider: readonlyProvider,
    sameChain,
    sameSigner,
  });

  const canShowSummary = useMemo(() => survey.clearTallies, [survey.clearTallies]);
  
  // Input values for each question
  const [inputValues, setInputValues] = useState<{ [key: number]: string }>({
    0: "",
    1: "",
    2: "",
  });

  // Removed automatic refresh on mount to avoid infinite loops
  // The hook will handle refreshing when needed

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold text-white">Encrypted Survey</h1>
      <p className="text-white/80">Three privacy-preserving numeric questions. Each user&apos;s answers are encrypted and stored separately. Only you can decrypt and view your own answers.</p>

      {/* FHEVM Status */}
      <div className="mt-4 p-3 rounded-lg bg-card-overlay border border-card">
        <div className="text-sm text-white">
          <div>FHEVM Status: <span className={fhevmStatus === "ready" ? "text-green-300" : fhevmStatus === "error" ? "text-red-300" : "text-yellow-300"}>{fhevmStatus}</span></div>
          {fhevmError && <div className="text-red-300 mt-1">FHEVM Error: {fhevmError.message}</div>}
          {!survey.contractAddress && <div className="text-yellow-300 mt-1">Contract not deployed on current network (Chain ID: {chainId})</div>}
          {survey.contractAddress && <div className="text-green-300 mt-1">Contract: {survey.contractAddress}</div>}
        </div>
      </div>

      {/* Three Questions */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {survey.questions.map((q) => (
          <div key={q.questionId} className="rounded-xl border border-card p-4 bg-card-overlay">
            <h2 className="font-medium mb-3 text-white text-lg">{q.question}</h2>
            
            {/* Input Field and Submit Button */}
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                min="0"
                max="4294967295"
                value={inputValues[q.questionId] || ""}
                onChange={(e) => setInputValues({ ...inputValues, [q.questionId]: e.target.value })}
                placeholder="Enter a number"
                className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                disabled={!survey.canSubmit}
              />
              <button
                className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-white font-medium disabled:opacity-50 transition-colors text-sm"
                onClick={() => {
                  const value = parseInt(inputValues[q.questionId] || "0", 10);
                  if (!isNaN(value) && value >= 0 && value <= 4294967295) {
                    survey.submit(q.questionId as 0 | 1 | 2, value);
                  } else {
                    alert("Please enter a valid number (0-4294967295)");
                  }
                }}
                disabled={!survey.canSubmit || !inputValues[q.questionId]}
              >
                Submit
              </button>
            </div>

            {/* Encrypted Handle */}
            <div className="mt-3 space-y-2">
              <div className="text-xs text-white/70">Encrypted Ciphertext:</div>
              {q.handle ? (
                <div className="text-xs font-mono text-cyan-300 break-all bg-black/30 p-2 rounded">
                  <div>{q.handle}</div>
                </div>
              ) : (
                <div className="text-xs text-white/50">No data</div>
              )}
            </div>

            {/* Decrypted Result */}
            {q.decrypted !== undefined && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-white/70 mb-2">Decrypted Result:</div>
                <div className="text-sm text-white font-semibold">
                  <div>Your Answer: {String(q.decrypted ?? "-")}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Decrypt Button and Summary */}
      <div className="mt-6 rounded-xl border border-card p-4 bg-card-overlay">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Summary Results</h2>
          <button
            className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-white font-medium disabled:opacity-50 transition-colors"
            onClick={() => survey.decryptTallies()}
            disabled={!survey.canDecrypt}
          >
            Decrypt My Answers
          </button>
        </div>
        
        <p className="text-sm mt-2 text-white/80 mb-4">{survey.message}</p>

        {canShowSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-black/30 p-3 rounded">
              <div className="text-sm text-white/70 mb-2">Question 1: What is your ID number?</div>
              <div className="text-lg text-white font-semibold">
                <div>Your Answer: {String(survey.clearTallies?.idNumber ?? "-")}</div>
              </div>
            </div>
            <div className="bg-black/30 p-3 rounded">
              <div className="text-sm text-white/70 mb-2">Question 2: What is your bank card password?</div>
              <div className="text-lg text-white font-semibold">
                <div>Your Answer: {String(survey.clearTallies?.bankPassword ?? "-")}</div>
              </div>
            </div>
            <div className="bg-black/30 p-3 rounded">
              <div className="text-sm text-white/70 mb-2">Question 3: What is your age?</div>
              <div className="text-lg text-white font-semibold">
                <div>Your Answer: {String(survey.clearTallies?.age ?? "-")}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
