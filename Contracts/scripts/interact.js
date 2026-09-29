const { ethers } = require("hardhat");

async function main() {
  const BRIDGE_KEY = "0x46E736Fe8405B7e336983cDEB1b29D65a4558c09";
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    console.log("Please set CONTRACT_ADDRESS environment variable.");
    console.log("Usage: npx hardhat run scripts/interact.js --network mstTestnet");
    return;
  }

  const [signer] = await ethers.getSigners();
  console.log(`Interacting with TrustMeshBridge at ${CONTRACT_ADDRESS} on MST Testnet...`);

  const TrustMeshBridge = await ethers.getContractFactory("TrustMeshBridge");
  const bridge = TrustMeshBridge.attach(CONTRACT_ADDRESS);

  const eventId = `TM-${Math.floor(Math.random() * 100000)}`;
  const deviceId = "NEURICK-001";
  const eventType = "GAS_ALERT";
  const trustScore = 95;
  const anomalyScore = 15;
  const decision = "ALLOW";
  const action = "EMERGENCY_RESPONSE";
  const actionVerified = true;
  const stateHash = ethers.keccak256(ethers.toUtf8Bytes(`${eventId}-${deviceId}-${trustScore}`));

  console.log(`Anchoring event ${eventId} on MST Testnet...`);
  const tx = await bridge.anchorProof(
    eventId,
    deviceId,
    eventType,
    trustScore,
    anomalyScore,
    decision,
    action,
    actionVerified,
    stateHash
  );

  console.log(`Transaction submitted! Hash: ${tx.hash}`);
  await tx.wait();
  console.log(`Transaction confirmed on MST Testnet! Explorer: https://testnet.mstscan.com/tx/${tx.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
