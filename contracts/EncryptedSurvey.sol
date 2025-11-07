// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted three-question survey using FHEVM
/// @notice Tracks three encrypted questions: "What is your ID number?", "What is your bank card password?", "What is your age?"
/// Each EOA can submit once per question. Values are encrypted and stored per user.
contract EncryptedSurvey is SepoliaConfig {
	// Question IDs
	uint8 public constant QUESTION_ID_NUMBER = 0;      // 你的身份证号是？
	uint8 public constant QUESTION_BANK_PASSWORD = 1;  // 你的银行卡密码是？
	uint8 public constant QUESTION_AGE = 2;            // 你的年龄是？

	// Encrypted answers for each user and question
	// mapping(user address => mapping(question ID => encrypted answer))
	mapping(address => mapping(uint8 => euint32)) private _userAnswers;

	// Anti-double-vote guard for each question
	mapping(address => mapping(uint8 => bool)) public hasAnswered;

	/// @notice Return encrypted answers for the caller (current user)
	/// @return idNumberEncrypted Encrypted answer for question 0 (ID Number)
	/// @return bankPasswordEncrypted Encrypted answer for question 1 (Bank Password)
	/// @return ageEncrypted Encrypted answer for question 2 (Age)
	function getMyAnswers() external view returns (
		bytes32 idNumberEncrypted,
		bytes32 bankPasswordEncrypted,
		bytes32 ageEncrypted
	) {
		return (
			euint32.unwrap(_userAnswers[msg.sender][QUESTION_ID_NUMBER]),
			euint32.unwrap(_userAnswers[msg.sender][QUESTION_BANK_PASSWORD]),
			euint32.unwrap(_userAnswers[msg.sender][QUESTION_AGE])
		);
	}

	/// @notice Return encrypted answers for a specific user
	/// @param user Address of the user to get answers for
	/// @return idNumberEncrypted Encrypted answer for question 0 (ID Number)
	/// @return bankPasswordEncrypted Encrypted answer for question 1 (Bank Password)
	/// @return ageEncrypted Encrypted answer for question 2 (Age)
	function getUserAnswers(address user) external view returns (
		bytes32 idNumberEncrypted,
		bytes32 bankPasswordEncrypted,
		bytes32 ageEncrypted
	) {
		return (
			euint32.unwrap(_userAnswers[user][QUESTION_ID_NUMBER]),
			euint32.unwrap(_userAnswers[user][QUESTION_BANK_PASSWORD]),
			euint32.unwrap(_userAnswers[user][QUESTION_AGE])
		);
	}

	/// @notice Submit an encrypted answer for a specific question
	/// @param questionId Question ID (0: ID Number, 1: Bank Password, 2: Age)
	/// @param inputEuint32 Encrypted value handle produced client-side
	/// @param inputProof Input proof produced by the FHEVM SDK
	function submitAnswer(uint8 questionId, externalEuint32 inputEuint32, bytes calldata inputProof) external {
		require(questionId <= QUESTION_AGE, "Invalid question ID");
		require(!hasAnswered[msg.sender][questionId], "Already answered this question");

		euint32 value = FHE.fromExternal(inputEuint32, inputProof);

		// Store the encrypted answer for this user and question
		_userAnswers[msg.sender][questionId] = value;
		
		// Allow the contract and the user to decrypt this value
		FHE.allowThis(_userAnswers[msg.sender][questionId]);
		FHE.allow(_userAnswers[msg.sender][questionId], msg.sender);

		hasAnswered[msg.sender][questionId] = true;
	}

	/// @notice Reset answers for a specific address (development only)
	/// @param user Address to reset answers for
	/// @param questionId Question ID to reset (0-2)
	function resetAnswer(address user, uint8 questionId) external {
		require(questionId <= QUESTION_AGE, "Invalid question ID");
		// Only allow resetting in development (you can add access control if needed)
		hasAnswered[user][questionId] = false;
		// Note: The encrypted answer remains in storage but won't be accessible
		// In a production environment, you might want to clear it as well
	}

	/// @notice Reset all answers for a specific address (development only)
	/// @param user Address to reset all answers for
	function resetAllAnswers(address user) external {
		hasAnswered[user][QUESTION_ID_NUMBER] = false;
		hasAnswered[user][QUESTION_BANK_PASSWORD] = false;
		hasAnswered[user][QUESTION_AGE] = false;
		// Note: The encrypted answers remain in storage but won't be accessible
		// In a production environment, you might want to clear them as well
	}
}


