
/*
  This file is auto-generated.
  Command: 'npm run genabi:survey'
*/
export const EncryptedSurveyABI = {
  "abi": [
    {
      "inputs": [],
      "name": "QUESTION_AGE",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "QUESTION_BANK_PASSWORD",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "QUESTION_ID_NUMBER",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMyAnswers",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "idNumberEncrypted",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "bankPasswordEncrypted",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "ageEncrypted",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getUserAnswers",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "idNumberEncrypted",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "bankPasswordEncrypted",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "ageEncrypted",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "name": "hasAnswered",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "protocolId",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        }
      ],
      "name": "resetAllAnswers",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "uint8",
          "name": "questionId",
          "type": "uint8"
        }
      ],
      "name": "resetAnswer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint8",
          "name": "questionId",
          "type": "uint8"
        },
        {
          "internalType": "externalEuint32",
          "name": "inputEuint32",
          "type": "bytes32"
        },
        {
          "internalType": "bytes",
          "name": "inputProof",
          "type": "bytes"
        }
      ],
      "name": "submitAnswer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
} as const;
