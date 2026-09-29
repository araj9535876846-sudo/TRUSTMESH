import React, { useState, useEffect } from "react";
import { CONTRACT_DEPLOYMENT_DATA } from "./contractData";
import { CheckCircle2, Copy, ExternalLink, Network, Rocket, ShieldCheck, Wallet, AlertCircle, RefreshCw } from "lucide-react";

export default function MstDeployer() {
  const [walletAccount, setWalletAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [deployedContract, setDeployedContract] = useState(() => {
    return localStorage.getItem("trustmesh_contract_address") || "0xb1354afc236c3d190e817b0b16a94871c939eb00";
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Check if wallet is already connected
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts && accounts.length > 0) {
            handleAccount(accounts[0]);
          }
        })
        .catch(console.error);

      window.ethereum
        .request({ method: "eth_chainId" })
        .then((cId) => setChainId(cId))
        .catch(console.error);

      const handleChainChanged = (newChainId) => setChainId(newChainId);
      const handleAccountsChanged = (newAccounts) => {
        if (newAccounts && newAccounts.length > 0) {
          handleAccount(newAccounts[0]);
        } else {
          setWalletAccount(null);
          setBalance(null);
        }
      };

      window.ethereum.on("chainChanged", handleChainChanged);
      window.ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("chainChanged", handleChainChanged);
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  const handleAccount = async (account) => {
    setWalletAccount(account);
    try {
      const balHex = await window.ethereum.request({
        method: "eth_getBalance",
        params: [account, "latest"],
      });
      const balDec = parseInt(balHex, 16) / 1e18;
      setBalance(balDec.toFixed(4));
    } catch (e) {
      console.error(e);
    }
  };

  const connectWallet = async () => {
    setErrorMsg("");
    if (!window.ethereum) {
      setErrorMsg("No Web3 wallet found. Please install MetaMask or BridgeKey extension.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        await handleAccount(accounts[0]);
      }

      // Check / Switch to MST Testnet (Chain ID 4545 = 0x11C1)
      const currentChain = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(currentChain);

      if (currentChain !== CONTRACT_DEPLOYMENT_DATA.chainIdHex && currentChain !== "0x11c1") {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CONTRACT_DEPLOYMENT_DATA.chainIdHex }],
          });
        } catch (switchError) {
          // If network is not added yet, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: CONTRACT_DEPLOYMENT_DATA.chainIdHex,
                  chainName: "MST Testnet",
                  nativeCurrency: { name: "tMSTC", symbol: "tMSTC", decimals: 18 },
                  rpcUrls: [CONTRACT_DEPLOYMENT_DATA.rpcUrl],
                  blockExplorerUrls: [CONTRACT_DEPLOYMENT_DATA.explorer],
                },
              ],
            });
          }
        }
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to connect wallet");
    }
  };

  const deployContract = async () => {
    setErrorMsg("");
    if (!walletAccount) {
      await connectWallet();
      return;
    }

    setDeploying(true);
    setStatusMessage("Please confirm transaction in your BridgeKey / MetaMask wallet...");

    try {
      // Send deployment transaction (to is null, data is bytecode + constructor args)
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: walletAccount,
            data: CONTRACT_DEPLOYMENT_DATA.bytecode,
          },
        ],
      });

      setTxHash(hash);
      setStatusMessage(`Transaction submitted: ${hash.slice(0, 10)}...${hash.slice(-8)}. Waiting for MST Testnet block confirmation...`);

      // Poll for receipt
      let receipt = null;
      let attempts = 0;
      while (!receipt && attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        try {
          receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [hash],
          });
        } catch (e) {
          console.warn("Polling receipt...", e);
        }
      }

      if (receipt && receipt.contractAddress) {
        const address = receipt.contractAddress;
        setDeployedContract(address);
        localStorage.setItem("trustmesh_contract_address", address);
        setStatusMessage("Deployment confirmed on MST Testnet!");
      } else {
        setStatusMessage(`Transaction mined! Tx Hash: ${hash}. Check explorer for address.`);
      }
    } catch (err) {
      setErrorMsg(err.message || "Deployment was cancelled or failed.");
    } finally {
      setDeploying(false);
    }
  };

  const copyAddress = () => {
    if (deployedContract) {
      navigator.clipboard.writeText(deployedContract);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const isMstTestnet = chainId === "0x11c1" || chainId === "0x11C1" || chainId === 4545;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginBottom: "24px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              padding: "10px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Rocket size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#f8fafc" }}>
              MST Testnet 1-Click Deployment Engine
            </h3>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Chain ID: 4545 • BridgeKey: 0x46E736Fe8405B7e336983cDEB1b29D65a4558c09
            </span>
          </div>
        </div>

        {/* Wallet status pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {walletAccount ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "6px 14px",
                borderRadius: "30px",
                fontSize: "13px",
                color: "#34d399",
                fontWeight: 600,
              }}
            >
              <Wallet size={15} />
              <span>
                {walletAccount.slice(0, 6)}...{walletAccount.slice(-4)}
              </span>
              {balance && <span style={{ opacity: 0.8, marginLeft: "4px" }}>({balance} tMSTC)</span>}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid #3b82f6",
                color: "#60a5fa",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Wallet size={15} />
              Connect BridgeKey Wallet
            </button>
          )}

          <button
            onClick={deployContract}
            disabled={deploying}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: deploying ? "#475569" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
              border: "none",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: deploying ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
            }}
          >
            {deploying ? (
              <>
                <RefreshCw size={16} className="spin" />
                DEPLOYING TO MST...
              </>
            ) : (
              <>
                <Rocket size={16} />
                DEPLOY CONTRACT NOW
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress / Status display */}
      {statusMessage && (
        <div
          style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "#93c5fd",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <RefreshCw size={14} className={deploying ? "spin" : ""} />
          {statusMessage}
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "#fca5a5",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={15} />
          {errorMsg}
        </div>
      )}

      {/* Deployed Contract Result Box */}
      {deployedContract && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginTop: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34d399", fontWeight: 700, fontSize: "14px" }}>
                <CheckCircle2 size={18} />
                MST TESTNET CONTRACT DEPLOYED! (Paste this into your form)
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "15px",
                  color: "#ffffff",
                  background: "rgba(0, 0, 0, 0.4)",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  marginTop: "6px",
                  wordBreak: "break-all",
                }}
              >
                {deployedContract}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={copyAddress}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: copied ? "#059669" : "#1e293b",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  color: "#ffffff",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Copy size={14} />
                {copied ? "COPIED!" : "COPY ADDRESS"}
              </button>

              <a
                href={`${CONTRACT_DEPLOYMENT_DATA.explorer}/address/${deployedContract}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#1e293b",
                  border: "1px solid rgba(59, 130, 246, 0.5)",
                  color: "#60a5fa",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={14} />
                VIEW ON MST SCAN
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
