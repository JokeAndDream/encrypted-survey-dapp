import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { EncryptedSurvey } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = { alice: HardhatEthersSigner };

describe("EncryptedSurveySepolia", function () {
  let signers: Signers;
  let survey: EncryptedSurvey;
  let address: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }
    try {
      const d = await deployments.get("EncryptedSurvey");
      address = d.address;
      survey = (await ethers.getContractAt("EncryptedSurvey", d.address)) as unknown as EncryptedSurvey;
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --tags EncryptedSurvey --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("Alice answers Yes (1)", async function () {
    steps = 6;
    this.timeout(4 * 40000);

    progress("Encrypting '1'...");
    const encOne = await fhevm
      .createEncryptedInput(address, signers.alice.address)
      .add32(1)
      .encrypt();

    progress("Submit answer 1...");
    const tx = await survey.connect(signers.alice).submitAnswer(encOne.handles[0], encOne.inputProof);
    await tx.wait();

    progress("Read tallies (encrypted)...");
    const [yesEnc, noEnc] = await survey.getTallies();
    expect(yesEnc).to.not.eq(ethers.ZeroHash);
    expect(noEnc).to.not.eq(ethers.ZeroHash);

    progress("Decrypt tallies...");
    const yesClear = await fhevm.userDecryptEuint(FhevmType.euint32, yesEnc, address, signers.alice);
    const noClear = await fhevm.userDecryptEuint(FhevmType.euint32, noEnc, address, signers.alice);

    progress(`yes=${yesClear} no=${noClear}`);
    expect(yesClear).to.be.greaterThanOrEqual(1);
  });
});










