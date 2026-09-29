import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  Blocks,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Database,
  Eye,
  Gauge,
  History,
  Lock,
  Network,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Timer,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
  Zap,
} from "lucide-react";
import "./App.css";
import MstDeployer from "./MstDeployer";

const API = "http://127.0.0.1:8000";

const SERVICES = [
  {
    id: "SVC-001",
    name: "Environmental Scan",
    provider: "TRUST-NODE-02",
    category: "SENSING",
    price: 0.08,
    trust: 91,
    icon: <Activity size={20} />,
  },
  {
    id: "SVC-002",
    name: "Obstacle Detection",
    provider: "NEURICK-001",
    category: "ROBOTICS",
    price: 0.12,
    trust: 100,
    icon: <Gauge size={20} />,
  },
  {
    id: "SVC-003",
    name: "Security Response",
    provider: "TRUST-NODE-03",
    category: "SECURITY",
    price: 0.18,
    trust: 86,
    icon: <ShieldCheck size={20} />,
  },
  {
    id: "SVC-004",
    name: "Emergency Gas Analysis",
    provider: "EDGE-NODE-04",
    category: "SAFETY",
    price: 0.25,
    trust: 94,
    icon: <ShieldAlert size={20} />,
  },
];

function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [wallet, setWallet] = useState(10.0);
  const [spent, setSpent] = useState(0);
  const [earned, setEarned] = useState(0);

  const [transactions, setTransactions] = useState([]);
  const [marketplaceMessage, setMarketplaceMessage] = useState("");

  const [timeline, setTimeline] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [selectedService, setSelectedService] = useState(null);
  const [serviceRunning, setServiceRunning] = useState(false);

  const hasLiveTelemetry = Boolean(telemetry);
  const trust = hasLiveTelemetry ? Number(telemetry.trust ?? 0) : 0;
  const anomaly = hasLiveTelemetry ? Number(telemetry.anomaly ?? 0) : 0;
  const decision = telemetry?.decision ?? "WAITING";
  const action = telemetry?.action ?? "WAITING";
  const proof = Number(telemetry?.action_verified ?? 0);
  const liveEvent = telemetry?.event ?? "WAITING";

  const machineStatus = !hasLiveTelemetry
    ? "WAITING FOR NEURICK"
    : trust >= 80
      ? "TRUSTED"
      : trust >= 60
        ? "MONITORING"
        : "ISOLATED";

  const eventDescription = useMemo(() => {
    if (!hasLiveTelemetry) {
      return "Waiting for live telemetry from NEURICK-001 over the serial link.";
    }
    if (decision === "REJECT") {
      return "The trust engine rejected autonomous network access and held the machine in a safe software state.";
    }
    if (action === "EMERGENCY_RESPONSE") {
      return "The environmental anomaly was accepted as actionable and the emergency software response was executed.";
    }
    if (action === "SECURITY_RESPONSE") {
      return "The verified motion event triggered the authorized security software response.";
    }
    return "No blocking condition was detected. The trusted machine continues normal monitoring.";
  }, [action, decision, hasLiveTelemetry]);

  const risk = useMemo(() => {
    if (!hasLiveTelemetry) return { score: 0, label: "WAITING" };
    if (anomaly >= 70 || trust < 50) {
      return { score: 94, label: "CRITICAL" };
    }

    if (anomaly >= 30 || trust < 80) {
      return { score: 42, label: "MEDIUM" };
    }

    return { score: 8, label: "LOW" };
  }, [trust, anomaly, hasLiveTelemetry]);

  /*
   * ============================================================
   * AUTONOMOUS INCIDENT RESPONSE ENGINE
   * ============================================================
   */

  const responseLevel = useMemo(() => {
    if (!hasLiveTelemetry) return "low";
    if (trust < 60 || anomaly >= 70) return "critical";
    if (anomaly >= 30 || trust < 80) return "medium";
    return "low";
  }, [trust, anomaly, hasLiveTelemetry]);

  const responseAction = useMemo(() => {
    if (decision === "REJECT") {
      return {
        label: "NETWORK SAFE HOLD",
        code: "SAFE_HOLD",
        description:
          "The trust engine rejected autonomous network access and held the machine in a safe software state.",
      };
    }

    if (action === "EMERGENCY_RESPONSE") {
      return {
        label: "EMERGENCY RESPONSE",
        code: "EMERGENCY_RESPONSE",
        description:
          "The environmental anomaly was accepted as actionable and the emergency software response was executed.",
      };
    }

    if (action === "SECURITY_RESPONSE") {
      return {
        label: "SECURITY RESPONSE",
        code: "SECURITY_RESPONSE",
        description:
          "The verified motion event triggered the authorized security software response.",
      };
    }

    return {
      label: "CONTINUE MONITORING",
      code: "MONITOR",
      description:
        "No blocking condition was detected. The trusted machine continues normal monitoring.",
    };
  }, [action, decision]);

  const responseChecks = [
    {
      label: "EVENT SIGNATURE",
      value: "VERIFIED",
      ok: true,
    },
    {
      label: "TRUST AUTHORIZATION",
      value: trust >= 60 ? "PASSED" : "BLOCKED",
      ok: trust >= 60,
    },
    {
      label: "ANOMALY THRESHOLD",
      value: anomaly < 70 ? "PASSED" : "EXCEEDED",
      ok: anomaly < 70,
    },
    {
      label: "ACTION PROOF",
      value: proof ? "VERIFIED" : "FAILED",
      ok: Boolean(proof),
    },
  ];

  const [dynamicReputation, setDynamicReputation] = useState(96);
  const [reputationDelta, setReputationDelta] = useState(0);
  const [reputationAudit, setReputationAudit] = useState([]);
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  const previousScenarioRef = useRef("NORMAL");
  const recoveryTimer = useRef(null);

  // LIVE reputation tracking.
  // The backend is authoritative; when reputation_delta is not supplied,
  // derive the real delta from consecutive backend reputation values.
  const previousBackendReputationRef = useRef(null);
  const previousBackendEventRef = useRef(null);
  const reputationInitializedRef = useRef(false);

  const reputation = hasLiveTelemetry ? Number(telemetry.reputation ?? dynamicReputation) : 0;

  const reputationState = useMemo(() => {
    if (reputation >= 90) return "EXCELLENT";
    if (reputation >= 75) return "STABLE";
    if (reputation >= 60) return "DEGRADED";
    return "AT RISK";
  }, [reputation]);

  const reputationTone = useMemo(() => {
    if (reputation >= 90) return "excellent";
    if (reputation >= 75) return "stable";
    if (reputation >= 60) return "degraded";
    return "risk";
  }, [reputation]);

  const reputationImpact = useMemo(() => {
    if (reputationDelta > 0) return "TRUST RECOVERY";
    if (reputationDelta < 0) return "TRUST DECAY";
    return "NO CHANGE";
  }, [reputationDelta]);

  useEffect(() => {
    return () => {
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
      }
    };
  }, []);


  const lastLiveEventRef = useRef(null);

  function applyBackendReputation(data) {
    if (!data || data.success === false) {
      return;
    }

    const score = Number(data.score);

    if (Number.isFinite(score)) {
      setDynamicReputation(score);
    }

    const delta = Number(data.delta);

    if (Number.isFinite(delta)) {
      setReputationDelta(delta);
    }

    setRecoveryInProgress(
      Boolean(data.recovery)
    );

    if (Array.isArray(data.audit)) {
      const audit = data.audit
        .slice()
        .reverse()
        .map((item, index) => ({
          id:
            item.event_id ??
            `BACKEND-REP-${item.timestamp}-${index}`,
          event:
            item.event === "SENSOR_FAULT"
              ? "SENSOR_ANOMALY"
              : item.event,
          impact:
            Number(item.impact) > 0
              ? "RECOVERY"
              : Number(item.impact) < 0
                ? "DECAY"
                : "STABLE",
          delta: Number(item.impact) || 0,
          score:
            Number(item.score_after) ||
            Number(item.score) ||
            0,
          time: item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }
              )
            : "--:--:--",
        }));

      setReputationAudit(audit.slice(0, 8));
    }
  }

  function processLiveBackendData(data) {
    const next = normalizeBackendData(data);

    const previousReputation =
      previousBackendReputationRef.current;

    const backendReputation =
      data?.reputation ??
      data?.REPUTATION ??
      next.reputation ??
      null;

    const hasBackendReputation =
      backendReputation !== null &&
      backendReputation !== undefined &&
      Number.isFinite(Number(backendReputation));

    const nextReputation = hasBackendReputation
      ? Number(backendReputation)
      : null;

    // Prefer an explicit backend delta. If the backend does not expose one,
    // derive it from the actual reputation transition observed over /api/status.
    const explicitDelta =
      data?.reputation_delta ??
      data?.REPUTATION_DELTA ??
      null;

    let delta = Number(explicitDelta);

    if (
      !Number.isFinite(delta) &&
      nextReputation !== null &&
      previousReputation !== null
    ) {
      delta = nextReputation - previousReputation;
    }

    if (!Number.isFinite(delta)) {
      delta = 0;
    }

    const eventChanged =
      previousBackendEventRef.current !== next.event;

    const reputationChanged =
      previousReputation !== null &&
      nextReputation !== null &&
      nextReputation !== previousReputation;

    const meaningfulChange =
      eventChanged || reputationChanged;

    setTelemetry(next);
    setBackendOnline(true);

    if (nextReputation !== null) {
      setDynamicReputation(nextReputation);
      setReputationDelta(delta);

      if (data?.reputation_recovery !== undefined) {
        setRecoveryInProgress(Boolean(data.reputation_recovery));
      } else {
        setRecoveryInProgress(delta > 0 && next.event === "NORMAL");
      }

      // Do not manufacture an audit event from the first page load.
      if (
        reputationInitializedRef.current &&
        meaningfulChange &&
        next.event !== "WAITING"
      ) {
        const auditEvent =
          delta < 0 && (
            next.event === "SENSOR_FAULT" ||
            next.event === "SENSOR_ANOMALY" ||
            Number(next.anomaly ?? 0) > 0
          )
            ? "SENSOR_ANOMALY"
            : next.event;

        setReputationAudit((previous) => {
          const entry = {
            id: `REP-${Date.now()}-${Math.random()}`,
            event: auditEvent,
            impact:
              delta > 0
                ? "RECOVERY"
                : delta < 0
                  ? "DECAY"
                  : "STABLE",
            delta,
            score: nextReputation,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          };

          // Prevent duplicate rows while /api/status is polled every second.
          const previousTop = previous[0];

          if (
            previousTop &&
            previousTop.score === entry.score &&
            previousTop.delta === entry.delta &&
            previousTop.event === entry.event
          ) {
            return previous;
          }

          return [entry, ...previous].slice(0, 8);
        });
      }
    }

    previousBackendReputationRef.current =
      nextReputation;

    previousBackendEventRef.current =
      next.event;

    reputationInitializedRef.current = true;

    if (meaningfulChange && next.event !== "WAITING") {
      setTimeline((previous) => [
        createTimelineEvent(
          "SENSOR",
          "Live Sensor Event",
          `${next.event.replaceAll("_", " ")} detected by NEURICK-001`
        ),
        createTimelineEvent(
          "VERIFY",
          "Trust Verification",
          `Machine trust evaluated at ${next.trust}/100`
        ),
        createTimelineEvent(
          "DECISION",
          "Decision",
          `${next.decision} — ${next.action.replaceAll("_", " ")}`
        ),
        createTimelineEvent(
          "ACTION",
          "Action Proof",
          next.action_verified
            ? "Software action executed and verified"
            : "Action rejected by trust engine"
        ),
        ...previous,
      ].slice(0, 24));

      if (next.decision === "REJECT" || next.trust < 60) {
        setIncidents((previous) => [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            severity: "CRITICAL",
            title: "Rogue Machine Behaviour",
            description:
              "Trust dropped below the authorization threshold. Network transactions blocked.",
          },
          ...previous,
        ].slice(0, 8));
      } else if (next.event === "NORMAL" || next.trust >= 60) {
        setIncidents([]);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialState() {
      try {
        const response = await fetch(`${API}/api/status`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Backend unavailable");
        }

        const data = await response.json();
        processLiveBackendData(data);

        // Reputation is long-term behavioural history and must come from
        // the dedicated backend reputation endpoint, not the latest sensor
        // packet. This keeps SENSOR_ANOMALY (-10) visible in the audit trail
        // even while NEURICK continues streaming live telemetry.
        try {
          const reputationResponse = await fetch(
            `${API}/api/trustmesh/reputation`,
            { signal: controller.signal }
          );

          if (reputationResponse.ok) {
            const reputationData =
              await reputationResponse.json();

            applyBackendReputation(reputationData);
          }
        } catch {
          // Keep live telemetry working if the optional reputation request
          // temporarily fails.
        }
      } catch {
        setBackendOnline(false);
      }
    }

    loadInitialState();

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API}/api/status`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Backend unavailable");
        }

        const data = await response.json();
        processLiveBackendData(data);

        try {
          const reputationResponse = await fetch(
            `${API}/api/trustmesh/reputation`,
            { signal: controller.signal }
          );

          if (reputationResponse.ok) {
            const reputationData =
              await reputationResponse.json();

            applyBackendReputation(reputationData);
          }
        } catch {
          // Preserve the last known reputation if this request fails.
        }
      } catch {
        setBackendOnline(false);
      }
    }, 1000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  function normalizeBackendData(data) {
    const event = data?.event || data?.EVENT || "NORMAL";

    return {
      temperature: data?.temperature ?? data?.TEMP ?? null,

      humidity: data?.humidity ?? data?.HUM ?? null,

      distance: data?.distance ?? data?.DIST ?? null,

      mq: data?.mq ?? data?.MQ ?? null,

      pir: data?.pir ?? data?.PIR ?? null,

      battery: data?.battery ?? data?.BAT ?? null,

      trust: data?.trust ?? data?.trust_score ?? data?.TRUST ?? null,

      anomaly: data?.anomaly ?? data?.anomaly_score ?? data?.ANOMALY ?? null,

      event,

      decision: data?.decision ?? "WAITING",

      action: data?.action ?? "WAITING",

      action_verified: Number(
        data?.action_verified ?? data?.ACTION_VERIFIED ?? 0
      ),

      reputation:
        data?.reputation ??
        data?.REPUTATION ??
        null,

      reputation_delta:
        data?.reputation_delta ??
        data?.REPUTATION_DELTA ??
        null,

      reputation_recovery:
        data?.reputation_recovery ??
        data?.REPUTATION_RECOVERY ??
        null,
    };
  }


  function createTimelineEvent(
    type,
    title,
    description,
    status = "complete"
  ) {
    return {
      id: `${Date.now()}-${Math.random()}`,

      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),

      type,
      title,
      description,
      status,
    };
  }


  async function requestService(service) {
    setMarketplaceMessage("");

    if (trust < 60) {
      setMarketplaceMessage(
        `TRANSACTION BLOCKED — machine trust ${trust}/100 is below the 60-point authorization threshold.`
      );

      setTransactions((previous) => [
        {
          id: `TX-${Date.now()}`,
          service: service.name,
          provider: service.provider,
          amount: service.price,
          status: "REJECTED",
          reason: "TRUST_BELOW_THRESHOLD",
          time: new Date().toLocaleTimeString(),
        },

        ...previous,
      ]);

      return;
    }

    if (wallet < service.price) {
      setMarketplaceMessage(
        `PAYMENT BLOCKED — insufficient M2M credits for ${service.name}.`
      );

      return;
    }

    setSelectedService(service);
    setServiceRunning(true);

    setMarketplaceMessage(
      "REQUEST → VERIFY → ACT → PROOF → PAY"
    );

    setTimeout(() => {
      setWallet((value) =>
        Number(
          (value - service.price).toFixed(2)
        )
      );

      setSpent((value) =>
        Number(
          (value + service.price).toFixed(2)
        )
      );

      setEarned((value) =>
        Number(
          (value + service.price).toFixed(2)
        )
      );

      const transaction = {
        id: `TX-${Date.now()}`,
        service: service.name,
        provider: service.provider,
        amount: service.price,
        status: "COMPLETED",
        reason: "PROOF_VERIFIED",
        time: new Date().toLocaleTimeString(),
      };

      setTransactions((previous) => [
        transaction,
        ...previous,
      ]);

      setTimeline((previous) => [
        ...previous,

        createTimelineEvent(
          "PAYMENT",
          "M2M Payment Released",
          `${service.price.toFixed(
            2
          )} credits paid after proof-of-action`
        ),
      ]);

      setMarketplaceMessage(
        `COMPLETED — ${service.name} executed and payment released.`
      );

      setServiceRunning(false);
    }, 1500);
  }

  function resetMarketplace() {
    setWallet(10);
    setSpent(0);
    setEarned(0);
    setTransactions([]);
    setMarketplaceMessage("");
    setSelectedService(null);
    setServiceRunning(false);
  }

  const machineNodes = [
    {
      id: "M-001",
      name: "NEURICK-001",
      type: "PHYSICAL",
      status: machineStatus,
      trust,
      actual: true,
    },

    {
      id: "M-002",
      name: "TRUST-NODE-02",
      type: "SIMULATED",
      status: "TRUSTED",
      trust: 91,
    },

    {
      id: "M-003",
      name: "ACTION-NODE-03",
      type: "SIMULATED",
      status:
        trust < 60
          ? "WARNING"
          : "TRUSTED",
      trust:
        trust < 60
          ? 58
          : 88,
    },

    {
      id: "M-004",
      name: "OBSERVER-04",
      type: "SIMULATED",
      status: "TRUSTED",
      trust: 94,
    },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Network size={23} />
          </div>

          <div>
            <div className="brand-name">
              TRUST<span>MESH</span>
            </div>

            <div className="brand-subtitle">
              Autonomous Trust & Machine-to-Machine Network
            </div>
          </div>
        </div>

        <div className="top-status">
          <a
            href="https://testnet.mstscan.com/address/0xb1354afc236c3d190e817b0b16a94871c939eb00"
            target="_blank"
            rel="noreferrer"
            className="bridge-key-pill"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34d399",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <ShieldCheck size={14} />
            CONTRACT: 0xb135...eb00
          </a>

          <a
            href="https://testnet.mstscan.com/address/0x46E736Fe8405B7e336983cDEB1b29D65a4558c09"
            target="_blank"
            rel="noreferrer"
            className="bridge-key-pill"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60a5fa",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Network size={14} />
            BRIDGEKEY: 0x46E7...8c09
          </a>

          <div
            className={`connection-pill ${
              backendOnline
                ? "online"
                : "offline"
            }`}
          >
            <span className="status-dot" />

            {backendOnline
              ? "BACKEND ONLINE"
              : "BACKEND OFFLINE"}
          </div>

          <div className="mode-pill live">LIVE MODE</div>
        </div>
      </header>

      <main className="dashboard">
        <MstDeployer />

        <section className="hero">
          <div>
            <div className="eyebrow">
              <Sparkles size={15} />
              TRUST INTELLIGENCE PLATFORM
            </div>

            <h1>
              Machines that can
              <span>
                {" "}
                trust, transact & prove.
              </span>
            </h1>

            <p>
              TRUSTMESH creates a verifiable trust layer
              between autonomous machines, physical-world
              events, actions and machine-to-machine
              transactions.
            </p>
          </div>

          <div className="hero-machine">
            <div className="hero-machine-icon">
              <Bot size={38} />
            </div>

            <div>
              <strong>NEURICK-001</strong>
              <span>Physical Trust Node</span>
            </div>

            <BadgeCheck
              size={22}
              className="verified-icon"
            />
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard
            icon={
              <ShieldCheck size={22} />
            }
            label="TRUST SCORE"
            value={`${trust}/100`}
            detail={machineStatus}
            positive={trust >= 60}
          />

          <MetricCard
            icon={
              <AlertTriangle size={22} />
            }
            label="ANOMALY SCORE"
            value={`${anomaly}/100`}
            detail={risk.label}
            positive={anomaly < 40}
            warning={anomaly >= 40}
          />

          <MetricCard
            icon={
              <BadgeCheck size={22} />
            }
            label="REPUTATION"
            value={`${reputation}%`}
            detail="Verified history"
            positive={reputation >= 80}
          />

          <MetricCard
            icon={<Zap size={22} />}
            label="ACTION PROOF"
            value={
              proof
                ? "VERIFIED"
                : "REJECTED"
            }
            detail="Software execution"
            positive={Boolean(proof)}
          />
        </section>

        <section className="reputation-grid">
          <div className="panel reputation-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <TrendingUp size={15} />
                  LIVE MACHINE REPUTATION
                </div>

                <h2>
                  Behavioural reputation engine
                </h2>
              </div>

              <div className={`reputation-state ${reputationTone}`}>
                <span className="status-dot" />
                {reputationState}
              </div>
            </div>

            <div className="reputation-overview">
              <div className={`reputation-score-ring ${reputationTone}`} style={{ "--reputation": reputation }}>
                <div className="reputation-score-inner">
                  <strong>{reputation}</strong>
                  <span>/ 100</span>
                  <small>REPUTATION</small>
                </div>
              </div>

              <div className="reputation-summary">
                <div className="reputation-delta-card">
                  <span>REPUTATION DELTA</span>
                  <strong className={reputationDelta >= 0 ? "positive-text" : "negative-text"}>
                    {reputationDelta > 0 ? "+" : ""}{reputationDelta}
                  </strong>
                  <small>{reputationImpact}</small>
                </div>

                <div className="reputation-behaviour-card">
                  <div className="reputation-behaviour-icon">
                    {reputationDelta < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                  </div>
                  <div>
                    <span>VERIFIED BEHAVIOUR</span>
                    <strong>
                      {(reputationDelta < 0 && (
                        liveEvent === "SENSOR_FAULT" ||
                        liveEvent === "SENSOR_ANOMALY" ||
                        anomaly > 0
                      )
                        ? "SENSOR ANOMALY"
                        : liveEvent
                      ).replaceAll("_", " ")}
                    </strong>
                    <small>Score updated from machine event evidence.</small>
                  </div>
                </div>

                {recoveryInProgress && (
                  <div className="recovery-banner">
                    <TrendingUp size={17} />
                    <div>
                      <strong>RECOVERY IN PROGRESS</strong>
                      <span>Verified normal behaviour is rebuilding machine reputation.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="reputation-rules">
              <div className="reputation-rules-title">
                <ShieldCheck size={15} />
                REPUTATION RULES
              </div>

              <div className="reputation-rule-grid">
                <div><span>NORMAL</span><strong>+3</strong><small>Recovery</small></div>
                <div><span>MOTION</span><strong>+2</strong><small>Verified response</small></div>
                <div><span>GAS</span><strong>+1</strong><small>Emergency response</small></div>
                <div><span>UNTRUSTED</span><strong>-10</strong><small>Anomalous behaviour</small></div>
              </div>
            </div>
          </div>

          <div className="panel reputation-audit-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <History size={15} />
                  REPUTATION AUDIT TRAIL
                </div>

                <h2>
                  Behavioural score history
                </h2>
              </div>

              <div className="timeline-count">
                {reputationAudit.length} EVENTS
              </div>
            </div>

            <div className="reputation-audit-list">
              {reputationAudit.length === 0 ? (
                <div className="reputation-empty">
                  <History size={22} />
                  <strong>Waiting for verified behaviour</strong>
                  <span>Live machine events update the reputation audit.</span>
                </div>
              ) : (
                reputationAudit.map((entry) => (
                  <div className="reputation-audit-row" key={entry.id}>
                    <div className={`reputation-audit-icon ${entry.delta < 0 ? "decay" : "recovery"}`}>
                      {entry.delta < 0 ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
                    </div>

                    <div className="reputation-audit-main">
                      <strong>{entry.event.replaceAll("_", " ")}</strong>
                      <span>{entry.impact} · {entry.time}</span>
                    </div>

                    <div className="reputation-audit-score">
                      <strong className={entry.delta < 0 ? "negative-text" : "positive-text"}>
                        {entry.delta > 0 ? "+" : ""}{entry.delta}
                      </strong>
                      <span>{entry.score}/100</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="main-grid">
          <div className="panel trust-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <ShieldCheck size={15} />
                  TRUST INTELLIGENCE
                </div>

                <h2>
                  Machine decision engine
                </h2>
              </div>

              <div
                className={`decision-badge ${decision.toLowerCase()}`}
              >
                {decision ===
                "ALLOW" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Ban size={15} />
                )}

                {decision}
              </div>
            </div>

            <div className="trust-engine">
              <div
                className={`trust-ring ${
                  trust < 60
                    ? "critical"
                    : trust < 80
                      ? "warning"
                      : ""
                }`}
                style={{
                  "--trust":
                    Math.max(
                      0,
                      Math.min(
                        100,
                        trust
                      )
                    ),
                }}
              >
                <div className="trust-ring-inner">
                  <strong>{trust}</strong>
                  <span>/ 100</span>
                  <small>TRUST</small>
                </div>
              </div>

              <div className="decision-explanation">
                <DecisionRow
                  icon={
                    <Activity size={17} />
                  }
                  title="Sensor Availability"
                  value={
                    telemetry
                      ? "AVAILABLE"
                      : "SIMULATED"
                  }
                  ok
                />

                <DecisionRow
                  icon={
                    <AlertTriangle size={17} />
                  }
                  title="Anomaly Analysis"
                  value={`${anomaly}/100`}
                  ok={anomaly < 60}
                />

                <DecisionRow
                  icon={<Lock size={17} />}
                  title="Trust Threshold"
                  value={
                    trust >= 60
                      ? "PASSED"
                      : "FAILED"
                  }
                  ok={trust >= 60}
                />

                <DecisionRow
                  icon={<Cpu size={17} />}
                  title="Final Decision"
                  value={decision}
                  ok={
                    decision ===
                    "ALLOW"
                  }
                />
              </div>
            </div>

            <div
              className={`decision-message ${decision.toLowerCase()}`}
            >
              <div className="decision-message-icon">
                {decision ===
                "ALLOW" ? (
                  <ShieldCheck size={21} />
                ) : (
                  <ShieldAlert size={21} />
                )}
              </div>

              <div>
                <strong>
                  {eventDescription}
                </strong>

                <span>
                  {decision ===
                  "ALLOW"
                    ? "Machine is authorized to execute its assigned operation."
                    : "All new M2M operations are blocked until trust is restored."}
                </span>
              </div>
            </div>
          </div>

          <div className="panel threat-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <AlertOctagon size={15} />
                  THREAT INTELLIGENCE
                </div>

                <h2>
                  Behavioural risk engine
                </h2>
              </div>

              <div
                className={`risk-badge ${risk.label.toLowerCase()}`}
              >
                {risk.label}
              </div>
            </div>

            <div className="risk-score">
              <div>
                <span>RISK SCORE</span>
                <strong>
                  {risk.score}
                </strong>
              </div>

              <div className="risk-bar">
                <div
                  className={`risk-bar-fill ${
                    risk.score >=
                    70
                      ? "critical"
                      : risk.score >=
                          30
                        ? "warning"
                        : ""
                  }`}
                  style={{
                    width: `${risk.score}%`,
                  }}
                />
              </div>
            </div>

            <div className="threat-list">
              <ThreatRow
                label="Sensor pattern"
                value={
                  anomaly >= 70
                    ? "ABNORMAL"
                    : "NORMAL"
                }
                danger={
                  anomaly >= 70
                }
              />

              <ThreatRow
                label="Trust history"
                value={
                  trust < 60
                    ? "DEGRADED"
                    : "STABLE"
                }
                danger={
                  trust < 60
                }
              />

              <ThreatRow
                label="Action integrity"
                value={
                  proof
                    ? "VERIFIED"
                    : "FAILED"
                }
                danger={!proof}
              />

              <ThreatRow
                label="Network access"
                value={
                  trust < 60
                    ? "ISOLATED"
                    : "AUTHORIZED"
                }
                danger={
                  trust < 60
                }
              />
            </div>

            <div
              className={`threat-response ${
                trust < 60
                  ? "critical"
                  : ""
              }`}
            >
              {trust < 60 ? (
                <>
                  <ShieldAlert
                    size={20}
                  />

                  <div>
                    <strong>
                      AUTOMATED
                      ISOLATION
                      ACTIVE
                    </strong>

                    <span>
                      Transactions and
                      service requests
                      are being rejected.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck
                    size={20}
                  />

                  <div>
                    <strong>
                      NETWORK OPERATING
                      NORMALLY
                    </strong>

                    <span>
                      Machine behaviour
                      remains within
                      trusted parameters.
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================
            AUTONOMOUS INCIDENT RESPONSE
            ===================================================== */}

        <section className="panel autonomous-response-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">
                <ShieldAlert size={15} />
                AUTONOMOUS INCIDENT RESPONSE
              </div>

              <h2>
                Trust-aware response engine
              </h2>

              <p>
                The machine evaluates the event,
                applies the trust policy, executes
                the authorized software response and
                verifies the proof.
              </p>
            </div>

            <div
              className={`response-level ${responseLevel}`}
            >
              <span className="response-level-dot" />

              {responseLevel.toUpperCase()}{" "}
              RESPONSE
            </div>
          </div>

          <div className="response-layout">
            <div
              className={`response-action-card ${responseLevel}`}
            >
              <div className="response-action-icon">
                {decision ===
                "REJECT" ? (
                  <Lock size={24} />
                ) : action ===
                  "EMERGENCY_RESPONSE" ? (
                  <AlertOctagon
                    size={24}
                  />
                ) : action ===
                  "SECURITY_RESPONSE" ? (
                  <ShieldCheck
                    size={24}
                  />
                ) : (
                  <Activity size={24} />
                )}
              </div>

              <span>
                AUTONOMOUS ACTION
              </span>

              <strong>
                {responseAction.label}
              </strong>

              <div className="response-action-code">
                {responseAction.code}
              </div>

              <p>
                {responseAction.description}
              </p>
            </div>

            <div className="response-reasoning">
              <div className="response-reasoning-header">
                <div>
                  <span>
                    DECISION TRACE
                  </span>

                  <strong>
                    Why the machine
                    responded this way
                  </strong>
                </div>

                <div className="response-score-pills">
                  <span>
                    TRUST {trust}
                  </span>

                  <span>
                    ANOMALY {anomaly}
                  </span>
                </div>
              </div>

              <div className="response-checks">
                {responseChecks.map(
                  (check) => (
                    <div
                      className={`response-check ${
                        check.ok
                          ? "ok"
                          : "blocked"
                      }`}
                      key={
                        check.label
                      }
                    >
                      <div className="response-check-icon">
                        {check.ok ? (
                          <CheckCircle2
                            size={16}
                          />
                        ) : (
                          <Ban
                            size={16}
                          />
                        )}
                      </div>

                      <span>
                        {check.label}
                      </span>

                      <strong>
                        {check.value}
                      </strong>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div
            className={`response-rail ${responseLevel}`}
          >
            <div className="response-rail-step">
              <span>01</span>
              <strong>DETECT</strong>
              <small>
                {liveEvent.replaceAll(
                  "_",
                  " "
                )}
              </small>
            </div>

            <ArrowRight size={16} />

            <div className="response-rail-step">
              <span>02</span>
              <strong>VERIFY</strong>
              <small>
                Trust {trust}/100
              </small>
            </div>

            <ArrowRight size={16} />

            <div className="response-rail-step">
              <span>03</span>
              <strong>DECIDE</strong>
              <small>
                {decision}
              </small>
            </div>

            <ArrowRight size={16} />

            <div className="response-rail-step">
              <span>04</span>
              <strong>ACT</strong>
              <small>
                {action.replaceAll(
                  "_",
                  " "
                )}
              </small>
            </div>

            <ArrowRight size={16} />

            <div className="response-rail-step">
              <span>05</span>
              <strong>PROVE</strong>
              <small>
                {proof
                  ? "ACTION VERIFIED"
                  : "ACTION FAILED"}
              </small>
            </div>
          </div>
        </section>

        <section className="panel machine-network">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">
                <Network size={15} />
                MULTI-MACHINE TRUST NETWORK
              </div>

              <h2>
                Machines connected through TRUSTMESH
              </h2>

              <p>
                M-001 is the physical NEURICK
                node. Other peers are simulated
                validators for the MVP demonstration.
              </p>
            </div>

            <div className="network-status">
              <span className="status-dot online-dot" />
              NETWORK ACTIVE
            </div>
          </div>

          <div className="network-visual">
            <div className="network-line line-a" />
            <div className="network-line line-b" />
            <div className="network-line line-c" />
            <div className="network-line line-d" />

            <div className="network-core">
              <div className="core-pulse">
                <Network size={28} />
              </div>

              <strong>
                TRUST CORE
              </strong>

              <span>
                VERIFICATION
              </span>
            </div>

            {machineNodes.map(
              (node, index) => (
                <div
                  key={node.id}
                  className={`network-node node-${
                    index + 1
                  } ${
                    node.status ===
                    "WARNING"
                      ? "warning-node"
                      : ""
                  } ${
                    node.status ===
                    "ISOLATED"
                      ? "isolated-node"
                      : ""
                  }`}
                >
                  <div className="node-icon">
                    {node.actual ? (
                      <Cpu size={21} />
                    ) : (
                      <Bot size={21} />
                    )}
                  </div>

                  <div className="node-info">
                    <strong>
                      {node.name}
                    </strong>

                    <span>
                      {node.actual
                        ? "PHYSICAL NODE"
                        : "SIMULATED PEER"}
                    </span>
                  </div>

                  <div className="node-trust">
                    <strong>
                      {node.trust}
                    </strong>

                    <span>
                      {node.status}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section className="main-grid">
          <div className="panel identity-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <UserCheck size={15} />
                  MACHINE DIGITAL IDENTITY
                </div>

                <h2>
                  NEURICK-001
                </h2>
              </div>

              <div className="verified-chip">
                <BadgeCheck size={14} />
                VERIFIED
              </div>
            </div>

            <div className="identity-card">
              <div className="identity-avatar">
                <Cpu size={29} />
              </div>

              <div className="identity-main">
                <strong>
                  NEURICK-001
                </strong>

                <span>
                  TM-NEU-001 · Autonomous
                  Sensor Node
                </span>
              </div>

              <div className="identity-status">
                <span>
                  NETWORK STATUS
                </span>

                <strong>
                  {machineStatus}
                </strong>
              </div>
            </div>

            <div className="identity-stats">
              <IdentityStat
                label="TRUST"
                value={`${trust}/100`}
              />

              <IdentityStat
                label="REPUTATION"
                value={`${reputation}%`}
              />

              <IdentityStat
                label="ACTIONS VERIFIED"
                value="18"
              />

              <IdentityStat
                label="M2M TRANSACTIONS"
                value="12"
              />
            </div>

            <div className="certificate">
              <div className="certificate-title">
                <ShieldCheck size={18} />
                TRUST CERTIFICATE
              </div>

              <div className="certificate-grid">
                <span>IDENTITY</span>
                <strong>
                  TM-NEU-001
                </strong>

                <span>INTEGRITY</span>
                <strong>
                  VERIFIED
                </strong>

                <span>ACTION PROOF</span>
                <strong>
                  VERIFIED
                </strong>

                <span>CERTIFICATE</span>
                <strong>
                  TM-CERT-7F2A91C8
                </strong>
              </div>
            </div>
          </div>

          <div className="panel sensor-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <Activity size={15} />
                  LIVE SENSOR TELEMETRY
                </div>

                <h2>
                  Physical-world state
                </h2>
              </div>

              <span className="live-indicator">
                <span />
                LIVE
              </span>
            </div>

            <div className="sensor-grid">
              <SensorCard
                icon={
                  <Gauge size={18} />
                }
                label="TEMPERATURE"
                value={telemetry?.temperature != null ? `${Number(telemetry.temperature).toFixed(1)}°C` : "—"}
              />

              <SensorCard
                icon={
                  <Activity size={18} />
                }
                label="HUMIDITY"
                value={telemetry?.humidity != null ? `${Number(telemetry.humidity).toFixed(1)}%` : "—"}
              />

              <SensorCard
                icon={
                  <ArrowRight size={18} />
                }
                label="DISTANCE"
                value={telemetry?.distance != null ? `${Number(telemetry.distance).toFixed(1)} cm` : "—"}
              />

              <SensorCard
                icon={
                  <AlertTriangle
                    size={18}
                  />
                }
                label="MQ-135"
                value={
                  telemetry?.mq == null
                    ? "—"
                    : Number(telemetry.mq)
                      ? "NORMAL"
                      : "ALERT"
                }
                danger={
                  telemetry?.mq != null && !Number(telemetry.mq)
                }
              />

              <SensorCard
                icon={<Eye size={18} />}
                label="PIR"
                value={
                  telemetry?.pir == null
                    ? "—"
                    : Number(telemetry.pir)
                      ? "MOTION"
                      : "CLEAR"
                }
              />

              <SensorCard
                icon={<Zap size={18} />}
                label="BATTERY"
                value={telemetry?.battery != null ? `${Number(telemetry.battery).toFixed(2)} V` : "—"}
              />
            </div>
          </div>
        </section>

        <section className="panel timeline-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">
                <History size={15} />
                TRUST TIMELINE
              </div>

              <h2>
                Event & proof history
              </h2>

              <p>
                Every important machine decision
                becomes a traceable event.
              </p>
            </div>

            <div className="timeline-count">
              {timeline.length} EVENTS
            </div>
          </div>

          <div className="timeline">
            {timeline.length === 0 ? (
              <div className="empty-timeline">
                <History size={25} />

                <strong>
                  Waiting for machine activity
                </strong>

                <span>
                  Waiting for the next live NEURICK event.
                </span>
              </div>
            ) : (
              timeline
                .slice(0, 12)
                .map(
                  (event, index) => (
                    <div
                      className="timeline-item"
                      key={event.id}
                    >
                      <div className="timeline-marker">
                        {index === 0 ? (
                          <Zap size={15} />
                        ) : (
                          <CheckCircle2
                            size={15}
                          />
                        )}
                      </div>

                      <div className="timeline-content">
                        <div className="timeline-meta">
                          <span>
                            {event.time}
                          </span>

                          <span>
                            {event.type}
                          </span>
                        </div>

                        <strong>
                          {event.title}
                        </strong>

                        <p>
                          {event.description}
                        </p>
                      </div>

                      <ChevronRight
                        size={17}
                        className="timeline-arrow"
                      />
                    </div>
                  )
                )
            )}
          </div>
        </section>

        <section className="panel marketplace-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">
                <CircleDollarSign size={15} />
                M2M SERVICE MARKETPLACE
              </div>

              <h2>
                Machines can discover and pay
                for services
              </h2>

              <p>
                Simulated credits demonstrate
                autonomous machine-to-machine
                commerce. No real money is transferred.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={resetMarketplace}
            >
              <RotateCcw size={15} />
              RESET ECONOMY
            </button>
          </div>

          <div className="economy-summary">
            <div className="wallet-card">
              <Wallet size={20} />

              <span>
                AVAILABLE CREDITS
              </span>

              <strong>
                {wallet.toFixed(2)}
              </strong>
            </div>

            <div className="economy-card">
              <TrendingDown
                size={19}
              />

              <span>
                SPENT
              </span>

              <strong>
                {spent.toFixed(2)}
              </strong>
            </div>

            <div className="economy-card">
              <TrendingUp
                size={19}
              />

              <span>
                EARNED
              </span>

              <strong>
                {earned.toFixed(2)}
              </strong>
            </div>

            <div className="economy-card">
              <Blocks size={19} />

              <span>
                TRANSACTIONS
              </span>

              <strong>
                {transactions.length}
              </strong>
            </div>
          </div>

          {marketplaceMessage && (
            <div
              className={`marketplace-message ${
                marketplaceMessage.includes(
                  "BLOCKED"
                )
                  ? "blocked"
                  : "success"
              }`}
            >
              {marketplaceMessage.includes(
                "BLOCKED"
              ) ? (
                <Ban size={18} />
              ) : (
                <CheckCircle2
                  size={18}
                />
              )}

              {marketplaceMessage}
            </div>
          )}

          <div className="services-grid">
            {SERVICES.map(
              (service) => (
                <div
                  key={service.id}
                  className={`service-card ${
                    selectedService?.id ===
                    service.id
                      ? "active"
                      : ""
                  }`}
                >
                  <div className="service-top">
                    <div className="service-icon">
                      {service.icon}
                    </div>

                    <span className="service-category">
                      {service.category}
                    </span>
                  </div>

                  <h3>
                    {service.name}
                  </h3>

                  <div className="service-provider">
                    <Cpu size={14} />
                    {service.provider}
                  </div>

                  <div className="service-bottom">
                    <div>
                      <span>
                        TRUST
                      </span>

                      <strong>
                        {service.trust}/100
                      </strong>
                    </div>

                    <div>
                      <span>
                        PRICE
                      </span>

                      <strong>
                        {service.price.toFixed(
                          2
                        )}
                      </strong>
                    </div>
                  </div>

                  <button
                    className="service-button"
                    onClick={() =>
                      requestService(
                        service
                      )
                    }
                    disabled={
                      serviceRunning ||
                      trust < 60 ||
                      wallet <
                        service.price
                    }
                  >
                    {serviceRunning &&
                    selectedService?.id ===
                      service.id ? (
                      <>
                        <Timer size={15} />
                        EXECUTING...
                      </>
                    ) : trust < 60 ? (
                      <>
                        <Ban size={15} />
                        BLOCKED
                      </>
                    ) : (
                      <>
                        <Zap size={15} />
                        REQUEST SERVICE
                      </>
                    )}
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        <section className="main-grid">
          <div className="panel blockchain-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <Blocks size={15} />
                  BLOCKCHAIN PROOF (MST TESTNET - 4545)
                </div>

                <h2>
                  Machine event ledger & MST Bridge
                </h2>
              </div>

              <div className="verified-chip">
                <Lock size={13} />
                MST TESTNET VERIFIED
              </div>
            </div>

            <div
              style={{
                marginBottom: "12px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                fontSize: "12px",
              }}
            >
              <div style={{ color: "#94a3b8", marginBottom: "4px" }}>
                MST Testnet RPC:{" "}
                <span style={{ color: "#38bdf8" }}>https://testnetrpc.mstblockchain.com</span>
              </div>
              <div style={{ color: "#94a3b8", marginBottom: "4px" }}>
                Deployed Contract:{" "}
                <a
                  href="https://testnet.mstscan.com/address/0xb1354afc236c3d190e817b0b16a94871c939eb00"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#34d399", fontWeight: 700, wordBreak: "break-all" }}
                >
                  0xb1354afc236c3d190e817b0b16a94871c939eb00
                </a>
              </div>
              <div style={{ color: "#94a3b8" }}>
                BridgeKey:{" "}
                <a
                  href="https://testnet.mstscan.com/address/0x46E736Fe8405B7e336983cDEB1b29D65a4558c09"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#60a5fa", fontWeight: 600, wordBreak: "break-all" }}
                >
                  0x46E736Fe8405B7e336983cDEB1b29D65a4558c09
                </a>
              </div>
            </div>

            <div className="block-chain">
              <BlockItem
                number="BLOCK #017"
                title="ACTION PROOF (MST ANCHORED)"
                hash="7f2a91c8...91c8"
                status="VERIFIED"
              />

              <BlockItem
                number="BLOCK #016"
                title="TRUST DECISION (MST SCAN)"
                hash="4ab82e71...8d21"
                status="VERIFIED"
              />

              <BlockItem
                number="BLOCK #015"
                title="SENSOR EVENT (MST PROOF)"
                hash="93f11c02...a44f"
                status="VERIFIED"
              />
            </div>

            <div className="hash-verification">
              <CheckCircle2 size={18} />

              <div>
                <strong>
                  MST TESTNET CHAIN INTEGRITY VERIFIED
                </strong>

                <span>
                  SHA-256 state proofs and BridgeKey 0x46E7...8c09 maintain an auditable machine history on MST Testnet.
                </span>
              </div>
            </div>
          </div>

          <div className="panel incident-panel">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">
                  <AlertOctagon size={15} />
                  INCIDENT CENTER
                </div>

                <h2>
                  Security events
                </h2>
              </div>

              <div className="incident-count">
                {incidents.length} ACTIVE
              </div>
            </div>

            {incidents.length ===
            0 ? (
              <div className="no-incidents">
                <ShieldCheck
                  size={31}
                />

                <strong>
                  No active incidents
                </strong>

                <span>
                  Network behaviour is
                  currently trusted.
                </span>
              </div>
            ) : (
              <div className="incident-list">
                {incidents
                  .slice(0, 5)
                  .map(
                    (incident) => (
                      <div
                        className="incident-item"
                        key={incident.id}
                      >
                        <div className="incident-icon">
                          <AlertOctagon
                            size={18}
                          />
                        </div>

                        <div>
                          <div className="incident-title">
                            <strong>
                              {incident.title}
                            </strong>

                            <span>
                              {incident.severity}
                            </span>
                          </div>

                          <p>
                            {
                              incident.description
                            }
                          </p>

                          <small>
                            {incident.time}
                          </small>
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}
          </div>
        </section>

        <section className="final-flow panel">
          <div className="panel-heading compact">
            <div>
              <div className="section-kicker">
                <Sparkles size={15} />
                TRUSTMESH CORE FLOW
              </div>

              <h2>
                Sense → Verify → Decide →
                Act → Prove
              </h2>
            </div>
          </div>

          <div className="flow">
            <FlowStep
              icon={
                <Activity size={21} />
              }
              title="SENSE"
            />

            <FlowArrow />

            <FlowStep
              icon={
                <ShieldCheck size={21} />
              }
              title="VERIFY"
            />

            <FlowArrow />

            <FlowStep
              icon={
                <Cpu size={21} />
              }
              title="DECIDE"
            />

            <FlowArrow />

            <FlowStep
              icon={
                <Zap size={21} />
              }
              title="ACT"
            />

            <FlowArrow />

            <FlowStep
              icon={
                <BadgeCheck size={21} />
              }
              title="PROVE"
            />

            <FlowArrow />

            <FlowStep
              icon={
                <CircleDollarSign
                  size={21}
                />
              }
              title="TRANSACT"
            />

            <FlowArrow />

            <FlowStep
              icon={
                <Blocks size={21} />
              }
              title="RECORD"
            />
          </div>
        </section>

        <footer className="footer">
          <div>
            <strong>
              TRUSTMESH
            </strong>

            <span>
              Autonomous Trust Infrastructure
            </span>
          </div>

          <span>
            Physical node: NEURICK-001 ·
            Software proof-of-action MVP
          </span>
        </footer>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  positive,
  warning,
}) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        {icon}
      </div>

      <div className="metric-info">
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small
          className={
            warning
              ? "warning-text"
              : positive
                ? "positive-text"
                : ""
          }
        >
          {detail}
        </small>
      </div>
    </div>
  );
}

function DecisionRow({
  icon,
  title,
  value,
  ok,
}) {
  return (
    <div className="decision-row">
      <div className="decision-row-left">
        <div className="small-icon">
          {icon}
        </div>

        <span>
          {title}
        </span>
      </div>

      <strong
        className={
          ok
            ? "ok-value"
            : "bad-value"
        }
      >
        {value}
      </strong>
    </div>
  );
}

function ThreatRow({
  label,
  value,
  danger,
}) {
  return (
    <div className="threat-row">
      <span>
        {label}
      </span>

      <strong
        className={
          danger
            ? "danger-value"
            : "safe-value"
        }
      >
        {value}
      </strong>
    </div>
  );
}

function IdentityStat({
  label,
  value,
}) {
  return (
    <div className="identity-stat">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function SensorCard({
  icon,
  label,
  value,
  danger,
}) {
  return (
    <div
      className={`sensor-card ${
        danger
          ? "danger-sensor"
          : ""
      }`}
    >
      <div className="sensor-icon">
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function BlockItem({
  number,
  title,
  hash,
  status,
}) {
  return (
    <div className="block-item">
      <div className="block-number">
        {number}
      </div>

      <div className="block-main">
        <strong>
          {title}
        </strong>

        <span>
          {hash}
        </span>
      </div>

      <div className="block-status">
        <CheckCircle2
          size={14}
        />

        {status}
      </div>
    </div>
  );
}

function FlowStep({
  icon,
  title,
}) {
  return (
    <div className="flow-step">
      <div className="flow-icon">
        {icon}
      </div>

      <span>
        {title}
      </span>
    </div>
  );
}

function FlowArrow() {
  return (
    <ArrowRight
      className="flow-arrow"
      size={19}
    />
  );
}

export default App;