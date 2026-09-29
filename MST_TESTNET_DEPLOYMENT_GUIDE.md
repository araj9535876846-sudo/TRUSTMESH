# TRUSTMESH - MST TESTNET DEPLOYMENT GUIDE 🚀

This document details the configuration, smart contract, and step-by-step deployment procedure for **TRUSTMESH** on the **MST Testnet**.

---

## 🌐 1. MST Testnet Network Parameters

| Parameter | Value |
| :--- | :--- |
| **Network Name** | MST Testnet |
| **RPC URL** | `https://testnetrpc.mstblockchain.com` |
| **Chain ID** | `4545` (0x11C1) |
| **Currency Symbol** | `tMSTC` |
| **Block Explorer** | [https://testnet.mstscan.com](https://testnet.mstscan.com) |
| **Registered BridgeKey** | `0x46E736Fe8405B7e336983cDEB1b29D65a4558c09` |

---

## 📜 2. Smart Contract: `TrustMeshBridge.sol`

Located in `Contracts/contracts/TrustMeshBridge.sol`.

Key capabilities:
- **BridgeKey Authorization**: Locks bridge transfers and proof anchoring to `0x46E736Fe8405B7e336983cDEB1b29D65a4558c09`.
- **Proof Anchoring**: Stores machine telemetry event state hashes directly on MST Testnet.
- **Machine Reputation Sync**: Tracks node performance scores (e.g. `NEURICK-001`) with automatic state classification (`EXCELLENT`, `STABLE`, `DEGRADED`, `AT RISK`).
- **Cross-Chain Bridge Transfers**: Verifies cross-chain bridge execution hashes and handles settlement logic.

---

## 🛠️ 3. How to Deploy

### Option A: Deploying via Hardhat (Recommended)

1. Open a terminal in the `Contracts` directory:
   ```bash
   cd Contracts
   ```

2. Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and paste your deployer account private key:
   ```env
   PRIVATE_KEY=0x_your_private_key_with_tMSTC_funds
   ```

3. Deploy directly to MST Testnet:
   ```bash
   npm run deploy:mst
   ```

   **Output will display:**
   - Contract Address
   - Registered BridgeKey (`0x46E736Fe8405B7e336983cDEB1b29D65a4558c09`)
   - MST Explorer Link (`https://testnet.mstscan.com/address/<contract_address>`)

---

### Option B: Deploying via Remix IDE

1. Open [Remix IDE](https://remix.ethereum.org/).
2. Create a new file `TrustMeshBridge.sol` and paste code from `Contracts/contracts/TrustMeshBridge.sol`.
3. Select Solidity compiler version **`0.8.20`**.
4. In **Deploy & Run Transactions**:
   - Environment: Select **Injected Provider - MetaMask**.
   - Ensure MetaMask is switched to **MST Testnet** (RPC: `https://testnetrpc.mstblockchain.com`, Chain ID: `4545`).
   - Constructor argument `_bridgeKey`: Enter `0x46E736Fe8405B7e336983cDEB1b29D65a4558c09`.
   - Click **Deploy**.

---

## ⚡ 4. Live API & Dashboard Integration

The backend and frontend are pre-configured for MST Testnet:

### Backend Endpoints
- **`GET http://localhost:8000/api/mst/config`**
  - Returns MST Testnet config, Chain ID 4545, and BridgeKey `0x46E736Fe8405B7e336983cDEB1b29D65a4558c09`.
- **`GET http://localhost:8000/api/mst/status`**
  - Queries live RPC (`https://testnetrpc.mstblockchain.com`) for latest block height and network status.

### Frontend Dashboard
- **MST Testnet Badge** in topbar with quick link to BridgeKey on MST Scan.
- **Blockchain Proof Panel** displaying MST Testnet verification details and live bridge key.
