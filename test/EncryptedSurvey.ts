import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedSurvey, EncryptedSurvey__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedSurvey")) as EncryptedSurvey__factory;
  const survey = (await factory.deploy()) as EncryptedSurvey;
  const address = await survey.getAddress();
  return { survey, address };
}

describe("EncryptedSurvey", function () {
  let signers: Signers;
  let survey: EncryptedSurvey;
  let address: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
    ({ survey, address } = await deployFixture());
  });

  it("encrypted tallies should be uninitialized after deployment", async function () {
    const [yesEnc, noEnc] = await survey.getTallies();
    expect(yesEnc).to.eq(ethers.ZeroHash);
    expect(noEnc).to.eq(ethers.ZeroHash);
  });

  it("Alice answers Yes (1) and Bob answers No (0)", async function () {
    // Alice encrypts bit=1
    const encOne = await fhevm
      .createEncryptedInput(address, signers.alice.address)
      .add32(1)
      .encrypt();

    await (await survey.connect(signers.alice).submitAnswer(encOne.handles[0], encOne.inputProof)).wait();

    // Bob encrypts bit=0
    const encZero = await fhevm
      .createEncryptedInput(address, signers.bob.address)
      .add32(0)
      .encrypt();

    await (await survey.connect(signers.bob).submitAnswer(encZero.handles[0], encZero.inputProof)).wait();

    const [yesEnc, noEnc] = await survey.getTallies();

    const yesClear = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      yesEnc,
      address,
      signers.bob,
    );
    const noClear = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      noEnc,
      address,
      signers.bob,
    );

    expect(yesClear).to.eq(1);
    expect(noClear).to.eq(1);
  });

  it("prevents double submission per address", async function () {
    const encOne = await fhevm
      .createEncryptedInput(address, signers.alice.address)
      .add32(1)
      .encrypt();
    await (await survey.connect(signers.alice).submitAnswer(encOne.handles[0], encOne.inputProof)).wait();

    await expect(
      survey.connect(signers.alice).submitAnswer(encOne.handles[0], encOne.inputProof)
    ).to.be.revertedWith("Already answered");
  });
});


