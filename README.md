# Encrypted Survey dApp (FHEVM)

A minimal MVP demonstrating a privacy-preserving Yes/No survey on Zama FHEVM. Users submit encrypted answers on-chain; only aggregated results are decrypted client-side by authorized users.

## Features
- Encrypted submission using FHEVM (`FHE.encrypt()` on client, `FHE.fromExternal()` in contract)
- On-chain homomorphic aggregation of tallies
- Client-side decryption for final summary via FHEVM user decryption flow
- RainbowKit wallet connect (top-right) with styles imported
- Custom app logo and favicon

## Contracts
- `contracts/EncryptedSurvey.sol` — maintains encrypted tallies `_yes` and `_no`, prevents double submissions per address, returns encrypted tallies.

### Deploy
In `1/` directory:

```bash
# install root deps (if not already)
npm install

# compile and deploy to local hardhat
npx hardhat deploy --tags EncryptedSurvey --network localhost

# (Optional) deploy to Sepolia
npx hardhat deploy --tags EncryptedSurvey --network sepolia
```

## Tests
Two suites similar to `FHECounter`:
- `test/EncryptedSurvey.ts` (runs on local mock FHEVM)
- `test/EncryptedSurveySepolia.ts` (runs on Sepolia)

Run tests:
```bash
npx hardhat test
```

## Frontend
Located in `frontend/` (Next.js). Generates ABI and runs dev server.

```bash
cd frontend
npm install
npm run dev
```

The script will generate ABI/address files for both `FHECounter` and `EncryptedSurvey` from the hardhat deployments. Ensure contracts are deployed first.

- RainbowKit CSS is imported in `app/layout.tsx`.
- Connect button is in the top-right navbar.
- Main page shows the survey with Yes/No submit and a decrypt button for the aggregated summary.

## ABI Generation
- `npm run genabi` — generates FHECounter ABI
- `npm run genabi:survey` — generates EncryptedSurvey ABI

These run automatically in `npm run dev`.

## Branding
- App logo: `frontend/public/app-logo.svg`
- Favicon: `frontend/public/favicon.svg`

## Notes
- All code and documentation are in English per requirements.
- This is an MVP; it enforces one submission per EOA but does not attempt to deanonymize any response.

# FHEVM Hardhat Template

A Hardhat-based template for developing Fully Homomorphic Encryption (FHE) enabled Solidity smart contracts using the
FHEVM protocol by Zama.

## Quick Start

For detailed instructions see:
[FHEVM Hardhat Quick Start Tutorial](https://docs.zama.ai/protocol/solidity-guides/getting-started/quick-start-tutorial)

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm or yarn/pnpm**: Package manager

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   ```bash
   npx hardhat vars set MNEMONIC

   # Set your Infura API key for network access
   npx hardhat vars set INFURA_API_KEY

   # Optional: Set Etherscan API key for contract verification
   npx hardhat vars set ETHERSCAN_API_KEY
   ```

3. **Compile and test**

   ```bash
   npm run compile
   npm run test
   ```

4. **Deploy to local network**

   ```bash
   # Start a local FHEVM-ready node
   npx hardhat node
   # Deploy to local network
   npx hardhat deploy --network localhost
   ```

5. **Deploy to Sepolia Testnet**

   ```bash
   # Deploy to Sepolia
   npx hardhat deploy --network sepolia
   # Verify contract on Etherscan
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
   ```

6. **Test on Sepolia Testnet**

   ```bash
   # Once deployed, you can run a simple test on Sepolia.
   npx hardhat test --network sepolia
   ```

## 📁 Project Structure

```
fhevm-hardhat-template/
├── contracts/           # Smart contract source files
│   └── FHECounter.sol   # Example FHE counter contract
├── deploy/              # Deployment scripts
├── tasks/               # Hardhat custom tasks
├── test/                # Test files
├── hardhat.config.ts    # Hardhat configuration
└── package.json         # Dependencies and scripts
```

## 📜 Available Scripts

| Script             | Description              |
| ------------------ | ------------------------ |
| `npm run compile`  | Compile all contracts    |
| `npm run test`     | Run all tests            |
| `npm run coverage` | Generate coverage report |
| `npm run lint`     | Run linting checks       |
| `npm run clean`    | Clean build artifacts    |

## 📚 Documentation

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [FHEVM Hardhat Setup Guide](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [FHEVM Testing Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat/write_test)
- [FHEVM Hardhat Plugin](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat)

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/zama-ai/fhevm/issues)
- **Documentation**: [FHEVM Docs](https://docs.zama.ai)
- **Community**: [Zama Discord](https://discord.gg/zama)

---

**Built with ❤️ by the Zama team**
