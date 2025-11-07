import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed = await deploy("EncryptedSurvey", {
    from: deployer,
    log: true,
    reset: true, // Force redeployment
  });

  console.log(`EncryptedSurvey contract: `, deployed.address);
};
export default func;
func.id = "deploy_encrypted_survey"; // id required to prevent reexecution
func.tags = ["EncryptedSurvey"];







