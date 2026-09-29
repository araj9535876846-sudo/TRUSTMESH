// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustMeshBridge
 * @notice Autonomous Trust & Machine-to-Machine IoT Network Bridge for MST Testnet (Chain ID: 4545)
 * @dev Manages trust telemetry proofs, machine reputation passports, and cross-chain bridge actions.
 */
contract TrustMeshBridge {

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    string public constant NETWORK_NAME = "MST Testnet";
    uint256 public constant CHAIN_ID = 4545;
    
    address public owner;
    address public bridgeKey;

    struct EventProof {
        uint256 index;
        string eventId;
        string deviceId;
        string eventType;
        uint8 trustScore;
        uint8 anomalyScore;
        string decision;
        string action;
        bool actionVerified;
        bytes32 stateHash;
        uint256 timestamp;
    }

    struct MachineReputation {
        string deviceId;
        uint256 score;
        string reputationState;
        uint256 totalVerifiedEvents;
        uint256 lastUpdated;
    }

    EventProof[] public proofs;
    mapping(string => MachineReputation) public machineReputations;
    mapping(bytes32 => bool) public processedBridgeTx;

    // ============================================================
    // EVENTS
    // ============================================================

    event ProofAnchored(
        uint256 indexed index,
        string indexed eventId,
        string deviceId,
        uint8 trustScore,
        bytes32 stateHash,
        uint256 timestamp
    );

    event ReputationUpdated(
        string indexed deviceId,
        uint256 newScore,
        string reputationState,
        uint256 timestamp
    );

    event BridgeKeyUpdated(
        address indexed previousBridgeKey,
        address indexed newBridgeKey,
        uint256 timestamp
    );

    event BridgeTransferExecuted(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed bridgeTxHash
    );

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustMesh: Caller is not owner");
        _;
    }

    modifier onlyBridge() {
        require(msg.sender == bridgeKey || msg.sender == owner, "TrustMesh: Caller is not authorized bridge key");
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    /**
     * @notice Initializes TrustMesh Bridge with the designated BridgeKey on MST Testnet
     * @param _bridgeKey Registered BridgeKey address (0x46E736Fe8405B7e336983cDEB1b29D65a4558c09)
     */
    constructor(address _bridgeKey) {
        require(_bridgeKey != address(0), "TrustMesh: Invalid bridge key address");
        owner = msg.sender;
        bridgeKey = _bridgeKey;

        // Initialize default machine reputation for NEURICK-001
        machineReputations["NEURICK-001"] = MachineReputation({
            deviceId: "NEURICK-001",
            score: 96,
            reputationState: "EXCELLENT",
            totalVerifiedEvents: 1,
            lastUpdated: block.timestamp
        });
    }

    // ============================================================
    // PUBLIC / EXTERNAL FUNCTIONS
    // ============================================================

    /**
     * @notice Anchor a verified machine event proof to MST Testnet
     */
    function anchorProof(
        string memory _eventId,
        string memory _deviceId,
        string memory _eventType,
        uint8 _trustScore,
        uint8 _anomalyScore,
        string memory _decision,
        string memory _action,
        bool _actionVerified,
        bytes32 _stateHash
    ) external onlyBridge returns (uint256) {
        uint256 newIndex = proofs.length;

        EventProof memory proof = EventProof({
            index: newIndex,
            eventId: _eventId,
            deviceId: _deviceId,
            eventType: _eventType,
            trustScore: _trustScore,
            anomalyScore: _anomalyScore,
            decision: _decision,
            action: _action,
            actionVerified: _actionVerified,
            stateHash: _stateHash,
            timestamp: block.timestamp
        });

        proofs.push(proof);

        // Update Reputation
        MachineReputation storage rep = machineReputations[_deviceId];
        if (bytes(rep.deviceId).length == 0) {
            rep.deviceId = _deviceId;
            rep.score = 90;
        }

        if (_trustScore >= 80) {
            if (rep.score + 3 <= 100) rep.score += 3;
            else rep.score = 100;
        } else if (_trustScore < 50) {
            if (rep.score >= 10) rep.score -= 10;
            else rep.score = 0;
        }

        if (rep.score >= 90) rep.reputationState = "EXCELLENT";
        else if (rep.score >= 75) rep.reputationState = "STABLE";
        else if (rep.score >= 60) rep.reputationState = "DEGRADED";
        else rep.reputationState = "AT RISK";

        rep.totalVerifiedEvents += 1;
        rep.lastUpdated = block.timestamp;

        emit ProofAnchored(newIndex, _eventId, _deviceId, _trustScore, _stateHash, block.timestamp);
        emit ReputationUpdated(_deviceId, rep.score, rep.reputationState, block.timestamp);

        return newIndex;
    }

    /**
     * @notice Execute cross-chain bridge transfer
     */
    function executeBridgeTransfer(
        address recipient,
        uint256 amount,
        bytes32 bridgeTxHash
    ) external onlyBridge returns (bool) {
        require(!processedBridgeTx[bridgeTxHash], "TrustMesh: Bridge tx already processed");
        require(recipient != address(0), "TrustMesh: Invalid recipient");

        processedBridgeTx[bridgeTxHash] = true;
        emit BridgeTransferExecuted(msg.sender, recipient, amount, bridgeTxHash);
        return true;
    }

    /**
     * @notice Update BridgeKey address
     */
    function updateBridgeKey(address _newBridgeKey) external onlyOwner {
        require(_newBridgeKey != address(0), "TrustMesh: Invalid new bridge key");
        address prev = bridgeKey;
        bridgeKey = _newBridgeKey;
        emit BridgeKeyUpdated(prev, _newBridgeKey, block.timestamp);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    function getProofCount() external view returns (uint256) {
        return proofs.length;
    }

    function getLatestProof() external view returns (EventProof memory) {
        require(proofs.length > 0, "TrustMesh: No proofs available");
        return proofs[proofs.length - 1];
    }

    function getReputation(string memory _deviceId) external view returns (
        uint256 score,
        string memory state,
        uint256 totalEvents,
        uint256 lastUpdated
    ) {
        MachineReputation memory rep = machineReputations[_deviceId];
        return (rep.score, rep.reputationState, rep.totalVerifiedEvents, rep.lastUpdated);
    }
}
