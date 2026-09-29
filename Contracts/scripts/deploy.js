const { ethers, network } = require("hardhat");

async function main() {
  console.log("=================================================");
  console.log("   TRUSTMESH - MST TESTNET DEPLOYMENT ENGINE");
  console.log("=================================================");
  console.log(`Network Name  : ${network.name}`);
  console.log(`Chain ID      : ${network.config.chainId || 4545}`);
  console.log(`RPC Endpoint  : ${network.config.url || "https://testnetrpc.mstblockchain.com"}`);
  console.log("=================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Account : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account Balance  : ${ethers.formatEther(balance)} tMSTC\n`);

  // Target BridgeKey provided by user
  const BRIDGE_KEY = process.env.BRIDGE_KEY || "0x46E736Fe8405B7e336983cDEB1b29D65a4558c09";
  console.log(`Registered BridgeKey : ${BRIDGE_KEY}`);

  console.log("\nDeploying TrustMeshBridge smart contract to MST Testnet...");
  const TrustMeshBridge = await ethers.getContractFactory("TrustMeshBridge");
  const bridge = await TrustMeshBridge.deploy(BRIDGE_KEY);

  await bridge.waitForDeployment();
  const contractAddress = await bridge.getAddress();

  console.log("\n=================================================");
  console.log("          SUCCESSFUL MST TESTNET DEPLOYMENT");
  console.log("=================================================");
  console.log(`Contract Address     : ${contractAddress}`);
  console.log(`Registered BridgeKey : ${BRIDGE_KEY}`);
  console.log(`Network              : MST Testnet (Chain ID 4545)`);
  console.log(`Explorer URL         : https://testnet.mstscan.com/address/${contractAddress}`);
  console.log(`BridgeKey Explorer   : https://testnet.mstscan.com/address/${BRIDGE_KEY}`);
  console.log("=================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
