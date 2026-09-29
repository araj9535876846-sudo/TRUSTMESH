from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import serial
import threading
import time
import hashlib
import json

from datetime import datetime, timezone


# ============================================================
# TRUSTMESH CONFIGURATION
# ============================================================

APP_NAME = "TRUSTMESH API"

DEVICE_ID = "NEURICK-001"

SERIAL_PORT = "COM7"
BAUD_RATE = 115200

SERIAL_RETRY_SECONDS = 3


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title=APP_NAME,
    description="Autonomous Trust & Machine-to-Machine IoT Network",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# MODE
# ============================================================

# False = real NEURICK controls the dashboard
# True  = simulator controls the dashboard

demo_mode = False

# Real NEURICK serial connection state.
serial_connected = False
serial_last_seen_at = None


# ============================================================
# THREAD LOCK
# ============================================================

# Protects shared data because:
#
# ESP32 serial reader
# and
# FastAPI requests
#
# can access the same data at the same time.

data_lock = threading.RLock()


# ============================================================
# LIVE SENSOR EVENT
# ============================================================

latest_event = {

    "event": "WAITING",

    "trust": 0,

    "anomaly": 0,

    "decision": "WAITING",

    "action": "WAITING",

    "action_verified": 0,

    "temperature": 0.0,

    "humidity": 0.0,

    "distance": 0.0,

    "mq": 0,

    "pir": 0,

    "battery": 0.0,

    "device_id": DEVICE_ID,

    "received_at": None,

    "source": "SYSTEM"
}


# ============================================================
# BLOCKCHAIN
# ============================================================

blockchain = []

event_counter = 0

# Last meaningful machine state.
#
# Sensor telemetry values are deliberately excluded.
#
# Example:
#
# Temperature:
# 28.5 -> 28.6
#
# does NOT create a new block.
#
# But:
#
# MOTION_DETECTED
# ->
# GAS_ALERT
#
# DOES create a new block.


last_state = None


# ============================================================
# AUTONOMOUS MACHINE REPUTATION
# ============================================================
# Reputation = long-term behavioural history.
# Trust remains the immediate authorization score from the
# current machine state.
#
# Baseline follows the TRUSTMESH demo model:
# NORMAL      +3
# MOTION      +2
# GAS         +1
# UNTRUSTED  -10
#
# Score is always clamped to 0..100.

reputation_score = 96
reputation_previous_score = 96
reputation_last_delta = 0
reputation_last_event = "SYSTEM_INIT"
reputation_recovery = False
reputation_audit = []

REPUTATION_RULES = {
    "NORMAL": 3,
    "MOTION_DETECTED": 2,
    "GAS_ALERT": 1,
    "SENSOR_ANOMALY": -10,
    "UNTRUSTED_MACHINE": -10,
}

REPUTATION_STATES = {
    "EXCELLENT": (90, 100),
    "STABLE": (75, 89),
    "DEGRADED": (60, 74),
    "AT RISK": (0, 59),
}


def reputation_state(score=None):
    value = reputation_score if score is None else max(
        0, min(100, int(score))
    )

    if value >= 90:
        return "EXCELLENT"

    if value >= 75:
        return "STABLE"

    if value >= 60:
        return "DEGRADED"

    return "AT RISK"


def reputation_delta_for_event(event):
    name = str(event.get("event", "NORMAL")).upper()

    if name in REPUTATION_RULES:
        return REPUTATION_RULES[name]

    if name == "UNTRUSTED":
        return -10

    # A verified autonomous action is positive behaviour.
    if int(event.get("action_verified", 0)) == 1:
        if event.get("decision") == "ALLOW":
            return 1

    return 0


def record_reputation_event(event):
    global reputation_score
    global reputation_previous_score
    global reputation_last_delta
    global reputation_last_event
    global reputation_recovery

    delta = reputation_delta_for_event(event)

    with data_lock:
        reputation_previous_score = reputation_score
        reputation_last_delta = delta
        reputation_last_event = event.get("event", "UNKNOWN")

        reputation_score = max(
            0,
            min(100, reputation_score + delta)
        )

        # Recovery is specifically visible after a degraded event.
        reputation_recovery = (
            delta > 0
            and reputation_score < 100
            and (
                reputation_previous_score < reputation_score
                or event.get("event") == "NORMAL"
            )
        )

        audit = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event.get("event", "UNKNOWN"),
            "impact": delta,
            "score_before": reputation_previous_score,
            "score_after": reputation_score,
            "state": reputation_state(reputation_score),
            "trust": int(event.get("trust", 0)),
            "anomaly": int(event.get("anomaly", 0)),
            "decision": event.get("decision", "UNKNOWN"),
            "action": event.get("action", "UNKNOWN"),
            "action_verified": int(
                event.get("action_verified", 0)
            ),
        }

        reputation_audit.append(audit)

        # Keep the API lightweight even after long LIVE sessions.
        if len(reputation_audit) > 100:
            del reputation_audit[:-100]

    return audit


def predictive_trust_analysis():
    with data_lock:
        current_trust = int(latest_event.get("trust", 0))
        current_anomaly = int(latest_event.get("anomaly", 0))
        score = int(reputation_score)
        history = list(reputation_audit[-8:])

    if not history:
        return {
            "risk": 0,
            "state": "STABLE",
            "label": "STABLE",
            "forecast": "Insufficient history for degradation forecast.",
            "signals": {
                "trust": current_trust,
                "anomaly": current_anomaly,
                "reputation": score,
                "recent_delta": 0,
            },
        }

    recent_delta = sum(
        int(item.get("impact", 0))
        for item in history[-4:]
    )

    negative_events = sum(
        1
        for item in history[-5:]
        if int(item.get("impact", 0)) < 0
    )

    risk = 0

    if current_trust < 80:
        risk += min(30, (80 - current_trust))

    risk += min(35, int(current_anomaly * 0.35))

    if score < 75:
        risk += min(20, (75 - score) // 2)

    if recent_delta < 0:
        risk += min(15, abs(recent_delta))

    if negative_events >= 2:
        risk += 10

    risk = max(0, min(100, risk))

    if current_trust < 40 or current_anomaly >= 75 or risk >= 75:
        state = "CRITICAL"
        label = "CRITICAL"
        forecast = (
            "Immediate trust deterioration detected. "
            "Authorization should remain restricted until verified recovery."
        )
    elif risk >= 45:
        state = "WATCH"
        label = "WATCH"
        forecast = (
            "Behaviour is trending toward higher risk. "
            "Additional verified events are required before trust improves."
        )
    elif recent_delta > 0 and score < 100:
        state = "RECOVERING"
        label = "RECOVERING"
        forecast = (
            "Verified behaviour is improving the machine's reputation."
        )
    else:
        state = "STABLE"
        label = "STABLE"
        forecast = (
            "No strong degradation signal is present in the recent trust history."
        )

    return {
        "risk": risk,
        "state": state,
        "label": label,
        "forecast": forecast,
        "signals": {
            "trust": current_trust,
            "anomaly": current_anomaly,
            "reputation": score,
            "recent_delta": recent_delta,
            "negative_events": negative_events,
        },
    }


# ============================================================
# M2M REPUTATION-BASED SERVICE PRICING
# ============================================================

M2M_SERVICES = {
    "environmental-scan": {
        "name": "Environmental Scan",
        "provider": "TRUST-NODE-02",
        "category": "SENSING",
        "base_price": 0.08,
    },
    "obstacle-detection": {
        "name": "Obstacle Detection",
        "provider": DEVICE_ID,
        "category": "ROBOTICS",
        "base_price": 0.12,
    },
    "security-response": {
        "name": "Security Response",
        "provider": "TRUST-NODE-03",
        "category": "SECURITY",
        "base_price": 0.18,
    },
    "emergency-gas-analysis": {
        "name": "Emergency Gas Analysis",
        "provider": "EDGE-NODE-04",
        "category": "SAFETY",
        "base_price": 0.25,
    },
}


def calculate_service_pricing(service_id, score=None):
    service = M2M_SERVICES.get(
        str(service_id).lower()
    )

    if service is None:
        return None

    reputation = (
        reputation_score
        if score is None
        else max(0, min(100, int(score)))
    )

    base = float(service["base_price"])

    if reputation >= 90:
        multiplier = 0.85
        adjustment = "15% TRUST DISCOUNT"
        access = True
    elif reputation >= 75:
        multiplier = 1.00
        adjustment = "BASE PRICE"
        access = True
    elif reputation >= 60:
        multiplier = 1.20
        adjustment = "20% RISK PREMIUM"
        access = True
    else:
        multiplier = 0.00
        adjustment = "SERVICE BLOCKED"
        access = False

    return {
        "service_id": service_id,
        "service": service["name"],
        "provider": service["provider"],
        "category": service["category"],
        "reputation": reputation,
        "reputation_state": reputation_state(reputation),
        "base_price": round(base, 4),
        "multiplier": multiplier,
        "price": round(base * multiplier, 4),
        "adjustment": adjustment,
        "access_allowed": access,
        "currency": "credits",
        "pricing_model": "REPUTATION_ADJUSTED",
    }


# ============================================================
# MACHINE REPUTATION PASSPORT
# ============================================================

def build_reputation_passport():
    with data_lock:
        event = dict(latest_event)
        audit = list(reputation_audit)
        score = int(reputation_score)
        blocks = len(blockchain)

    verified_behaviours = sum(
        1
        for item in audit
        if int(item.get("action_verified", 0)) == 1
    )

    positive_behaviours = sum(
        1
        for item in audit
        if int(item.get("impact", 0)) > 0
    )

    negative_behaviours = sum(
        1
        for item in audit
        if int(item.get("impact", 0)) < 0
    )

    passport_seed = {
        "machine_id": DEVICE_ID,
        "trust": int(event.get("trust", 0)),
        "reputation": score,
        "reputation_state": reputation_state(score),
        "verified_behaviours": verified_behaviours,
        "positive_behaviours": positive_behaviours,
        "negative_behaviours": negative_behaviours,
        "blockchain_blocks": blocks,
    }

    certificate_id = (
        "TM-PASS-"
        + hashlib.sha256(
            json.dumps(
                passport_seed,
                sort_keys=True,
                separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()[:16].upper()
    )

    prediction = predictive_trust_analysis()

    return {
        "passport_version": "1.0",
        "machine_id": DEVICE_ID,
        "device_type": "Autonomous Sensor Node",
        "network_status": (
            "DEMO" if demo_mode else "LIVE"
        ),
        "trust": int(event.get("trust", 0)),
        "reputation": score,
        "reputation_state": reputation_state(score),
        "predictive_trust": prediction,
        "verified_behaviours": verified_behaviours,
        "positive_behaviours": positive_behaviours,
        "negative_behaviours": negative_behaviours,
        "action_proofs": verified_behaviours,
        "m2m_transactions": max(0, blocks - 1),
        "certificate_id": certificate_id,
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "blockchain_anchor": (
            blockchain[-1]["hash"]
            if blockchain
            else None
        ),
    }


# ============================================================
# HASH FUNCTION
# ============================================================

def calculate_hash(block):

    block_data = json.dumps(
        block,
        sort_keys=True,
        separators=(",", ":")
    )

    return hashlib.sha256(
        block_data.encode("utf-8")
    ).hexdigest()


# ============================================================
# GENESIS BLOCK
# ============================================================

def create_genesis_block():

    block = {

        "index": 0,

        "event_id": "GENESIS",

        "timestamp":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "device_id":
            DEVICE_ID,

        "event":
            "GENESIS",

        "trust":
            100,

        "anomaly":
            0,

        "decision":
            "SYSTEM_INIT",

        "action":
            "LEDGER_INITIALIZED",

        "action_verified":
            1,

        "previous_hash":
            "0"
    }

    block["hash"] = calculate_hash(
        block
    )

    return block


blockchain.append(
    create_genesis_block()
)


# ============================================================
# CREATE MEANINGFUL STATE
# ============================================================

def create_state(event):

    return (

        event["event"],

        event["trust"],

        event["anomaly"],

        event["decision"],

        event["action"],

        event["action_verified"]

    )


# ============================================================
# ADD BLOCK
# ============================================================

def add_block(event):

    global event_counter

    with data_lock:

        previous_block = blockchain[-1]

        event_counter += 1

        block = {

            "index":
                len(blockchain),

            "event_id":
                f"TM-{event_counter:06d}",

            "timestamp":
                datetime.now(
                    timezone.utc
                ).isoformat(),

            "device_id":
                DEVICE_ID,

            "event":
                event["event"],

            "trust":
                event["trust"],

            "anomaly":
                event["anomaly"],

            "decision":
                event["decision"],

            "action":
                event["action"],

            "action_verified":
                event["action_verified"],

            "previous_hash":
                previous_block["hash"]
        }

        block["hash"] = calculate_hash(
            block
        )

        blockchain.append(
            block
        )


    # --------------------------------------------------------
    # Terminal output
    # --------------------------------------------------------

    print()

    print("=" * 64)

    print(
        "        TRUSTMESH BLOCKCHAIN TRANSACTION"
    )

    print("=" * 64)

    print(
        "Block          :",
        block["index"]
    )

    print(
        "Event ID       :",
        block["event_id"]
    )

    print(
        "Device         :",
        block["device_id"]
    )

    print(
        "Event          :",
        block["event"]
    )

    print(
        "Trust          :",
        block["trust"]
    )

    print(
        "Anomaly        :",
        block["anomaly"]
    )

    print(
        "Decision       :",
        block["decision"]
    )

    print(
        "Action         :",
        block["action"]
    )

    print(
        "Action Verified:",
        block["action_verified"]
    )

    print(
        "Previous Hash  :",
        block["previous_hash"]
    )

    print(
        "Current Hash   :",
        block["hash"]
    )

    print("=" * 64)

    print()


    return block


# ============================================================
# PROCESS REAL ESP32 EVENT
# ============================================================

def process_real_event(event):

    global latest_event
    global last_state

    # --------------------------------------------------------
    # If DEMO MODE is active:
    #
    # ESP32 packets are received but cannot overwrite
    # the dashboard or create demo blockchain transactions.
    # --------------------------------------------------------

    if demo_mode:

        print(
            "DEMO MODE - "
            "real ESP32 event ignored by dashboard."
        )

        return


    # --------------------------------------------------------
    # Add metadata
    # --------------------------------------------------------

    event["device_id"] = DEVICE_ID

    event["received_at"] = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    event["source"] = "NEURICK"


    # --------------------------------------------------------
    # Update live dashboard
    # --------------------------------------------------------

    with data_lock:

        latest_event = event


    # --------------------------------------------------------
    # Determine meaningful state
    # --------------------------------------------------------

    current_state = create_state(
        event
    )


    # --------------------------------------------------------
    # First event
    # --------------------------------------------------------

    if last_state is None:

        last_state = current_state

        audit = record_reputation_event(event)

        block = add_block(
            event
        )

        print(
            "REPUTATION:",
            audit["score_before"],
            "->",
            audit["score_after"],
            f"({audit['impact']:+d})"
        )

        print(
            "NEW TRUSTMESH EVENT:",
            block["event_id"]
        )

        return


    # --------------------------------------------------------
    # Same state
    # --------------------------------------------------------

    if current_state == last_state:

        print(
            "LIVE UPDATE - "
            "no blockchain transaction."
        )

        return


    # --------------------------------------------------------
    # State changed
    # --------------------------------------------------------

    previous_state = last_state

    last_state = current_state


    print()

    print(
        "***** TRUST STATE CHANGED *****"
    )

    print(
        "Previous:",
        previous_state
    )

    print(
        "Current :",
        current_state
    )

    print(
        "Creating blockchain transaction..."
    )


    audit = record_reputation_event(event)

    block = add_block(
        event
    )

    print(
        "REPUTATION:",
        audit["score_before"],
        "->",
        audit["score_after"],
        f"({audit['impact']:+d})"
    )

    print(
        "NEW TRUSTMESH EVENT:",
        block["event_id"]
    )


# ============================================================
# PARSE ESP32 TM_PROOF
# ============================================================

def parse_proof(line):

    global serial_last_seen_at

    if not line.startswith(
        "TM_PROOF|"
    ):

        return


    # --------------------------------------------------------
    # Split incoming proof
    # --------------------------------------------------------

    parts = line.strip().split("|")

    data = {}


    for part in parts[1:]:

        if "=" not in part:

            continue


        key, value = part.split(
            "=",
            1
        )


        data[key] = value


    # --------------------------------------------------------
    # Convert data
    # --------------------------------------------------------

    try:

        event = {

            "event":
                data.get(
                    "EVENT",
                    "UNKNOWN"
                ),

            "trust":
                int(
                    data.get(
                        "TRUST",
                        0
                    )
                ),

            "anomaly":
                int(
                    data.get(
                        "ANOMALY",
                        0
                    )
                ),

            "decision":
                data.get(
                    "DECISION",
                    "UNKNOWN"
                ),

            "action":
                data.get(
                    "ACTION",
                    "UNKNOWN"
                ),

            "action_verified":
                int(
                    data.get(
                        "ACTION_VERIFIED",
                        0
                    )
                ),

            "temperature":
                float(
                    data.get(
                        "TEMP",
                        0
                    )
                ),

            "humidity":
                float(
                    data.get(
                        "HUM",
                        0
                    )
                ),

            "distance":
                float(
                    data.get(
                        "DIST",
                        0
                    )
                ),

            "mq":
                int(
                    data.get(
                        "MQ",
                        0
                    )
                ),

            "pir":
                int(
                    data.get(
                        "PIR",
                        0
                    )
                ),

            "battery":
                float(
                    data.get(
                        "BAT",
                        0
                    )
                )
        }


    except (
        ValueError,
        TypeError
    ) as error:

        print(
            "Invalid TM_PROOF:",
            error
        )

        return


    # --------------------------------------------------------
    # Mark the real serial packet as received
    # --------------------------------------------------------

    serial_last_seen_at = datetime.now(timezone.utc).isoformat()

    # --------------------------------------------------------
    # Process real event
    # --------------------------------------------------------

    process_real_event(
        event
    )


# ============================================================
# SERIAL READER
# ============================================================

def serial_reader():

    global serial_connected

    while True:

        ser = None


        try:

            print(
                f"Connecting to {SERIAL_PORT}..."
            )


            ser = serial.Serial(

                port=SERIAL_PORT,

                baudrate=BAUD_RATE,

                timeout=1

            )


            serial_connected = True

            print(
                "Connected to NEURICK!"
            )


            # ------------------------------------------------
            # Read serial continuously
            # ------------------------------------------------

            while True:

                raw_line = ser.readline()


                if not raw_line:

                    continue


                line = raw_line.decode(
                    "utf-8",
                    errors="ignore"
                ).strip()


                if not line:

                    continue


                # ------------------------------------------------
                # Print proof lines
                # ------------------------------------------------

                if line.startswith(
                    "TM_PROOF|"
                ):

                    print(
                        "SERIAL:",
                        line
                    )


                # ------------------------------------------------
                # Process proof
                # ------------------------------------------------

                try:

                    parse_proof(
                        line
                    )


                except Exception as error:

                    print(
                        "Event processing error:",
                        error
                    )


        except serial.SerialException as error:

            print(
                "Serial connection error:",
                error
            )


        except Exception as error:

            print(
                "Unexpected serial error:",
                error
            )


        finally:

            serial_connected = False

            if ser is not None:

                try:

                    ser.close()

                except Exception:

                    pass


        print(
            f"Retrying COM7 in "
            f"{SERIAL_RETRY_SECONDS} seconds..."
        )


        time.sleep(
            SERIAL_RETRY_SECONDS
        )


# ============================================================
# START SERIAL THREAD
# ============================================================

serial_thread = threading.Thread(

    target=serial_reader,

    daemon=True

)

serial_thread.start()


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {

        "system":
            "TRUSTMESH",

        "status":
            "ONLINE",

        "device":
            DEVICE_ID,

        "mode":
            "DEMO" if demo_mode else "LIVE",

        "blockchain_blocks":
            len(blockchain)
    }


# ============================================================
# LIVE EVENT
# ============================================================

@app.get("/api/event")
def get_event():

    with data_lock:

        return latest_event


# ============================================================
# BLOCKCHAIN
# ============================================================

@app.get("/api/blockchain")
def get_blockchain():

    with data_lock:

        return {

            "chain_length":
                len(blockchain),

            "chain":
                blockchain
        }


# ============================================================
# LATEST BLOCK
# ============================================================

@app.get("/api/blockchain/latest")
def get_latest_block():

    with data_lock:

        return blockchain[-1]


# ============================================================
# BLOCKCHAIN VERIFICATION
# ============================================================

@app.get("/api/blockchain/verify")
def verify_blockchain():

    with data_lock:

        chain_copy = list(
            blockchain
        )


    # --------------------------------------------------------
    # Verify every block
    # --------------------------------------------------------

    for index in range(

        1,

        len(chain_copy)

    ):

        current = chain_copy[index]

        previous = chain_copy[index - 1]


        # ----------------------------------------------------
        # Previous hash verification
        # ----------------------------------------------------

        if (

            current["previous_hash"]

            !=

            previous["hash"]

        ):

            return {

                "valid":
                    False,

                "error":
                    "Previous hash mismatch",

                "block":
                    index
            }


        # ----------------------------------------------------
        # Current hash verification
        # ----------------------------------------------------

        stored_hash = current["hash"]


        block_copy = current.copy()


        del block_copy["hash"]


        recalculated_hash = (
            calculate_hash(
                block_copy
            )
        )


        if (

            stored_hash

            !=

            recalculated_hash

        ):

            return {

                "valid":
                    False,

                "error":
                    "Block hash mismatch",

                "block":
                    index
            }


    # --------------------------------------------------------
    # Everything valid
    # --------------------------------------------------------

    return {

        "valid":
            True,

        "blocks_verified":
            len(chain_copy),

        "message":
            "TRUSTMESH blockchain integrity verified"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    with data_lock:

        return {

            "status":
                "healthy",

            "system":
                "TRUSTMESH",

            "device":
                DEVICE_ID,

            "serial_port":
                SERIAL_PORT,

            "mode":
                "DEMO" if demo_mode else "LIVE",

            "demo_mode":
                demo_mode,

            "serial_connected":
                serial_connected,

            "serial_last_seen_at":
                serial_last_seen_at,

            "blockchain_blocks":
                len(blockchain),

            "latest_event":
                latest_event["event"]
        }


# ============================================================
# DASHBOARD STATUS
# ============================================================

@app.get("/api/status")
def status():

    with data_lock:

        return {

            "device":
                DEVICE_ID,

            "mode":
                "DEMO" if demo_mode else "LIVE",

            "demo_mode":
                demo_mode,

            "serial_connected":
                serial_connected,

            "serial_last_seen_at":
                serial_last_seen_at,

            "event":
                latest_event["event"],

            "trust":
                latest_event["trust"],

            "anomaly":
                latest_event["anomaly"],

            "decision":
                latest_event["decision"],

            "action":
                latest_event["action"],

            "action_verified":
                latest_event[
                    "action_verified"
                ],

            "temperature":
                latest_event[
                    "temperature"
                ],

            "humidity":
                latest_event[
                    "humidity"
                ],

            "distance":
                latest_event[
                    "distance"
                ],

            "mq":
                latest_event[
                    "mq"
                ],

            "pir":
                latest_event[
                    "pir"
                ],

            "battery":
                latest_event[
                    "battery"
                ],

            "source":
                latest_event[
                    "source"
                ],

            "blockchain_blocks":
                len(blockchain),

            "reputation":
                reputation_score,

            "reputation_state":
                reputation_state(),

            "reputation_delta":
                reputation_last_delta,

            "reputation_event":
                reputation_last_event,

            "reputation_recovery":
                reputation_recovery,

            "predictive_trust":
                predictive_trust_analysis()
        }


# ============================================================
# ENABLE DEMO MODE
# ============================================================

@app.post("/api/demo/on")
def enable_demo_mode():

    global demo_mode

    demo_mode = True

    print()
    print("=" * 64)
    print("TRUSTMESH DEMO MODE ENABLED")
    print("ESP32 events will not overwrite demo state.")
    print("=" * 64)
    print()

    return {

        "success":
            True,

        "mode":
            "DEMO",

        "message":
            "Demo mode enabled. Simulator controls dashboard."
    }


# ============================================================
# DISABLE DEMO MODE
# ============================================================

@app.post("/api/demo/off")
def disable_demo_mode():

    global demo_mode
    global last_state

    demo_mode = False

    # Reset state so the next real ESP32 event
    # becomes a new trusted state.

    last_state = None

    print()
    print("=" * 64)
    print("TRUSTMESH LIVE MODE ENABLED")
    print("NEURICK now controls dashboard.")
    print("=" * 64)
    print()

    return {

        "success":
            True,

        "mode":
            "LIVE",

        "message":
            "Live mode enabled. NEURICK controls dashboard."
    }


# ============================================================
# DEMO SIMULATION
# ============================================================

@app.post("/api/simulate/{scenario}")
def simulate_event(
    scenario: str
):

    global latest_event
    global last_state


    # --------------------------------------------------------
    # Normalize
    # --------------------------------------------------------

    scenario = scenario.upper()


    # --------------------------------------------------------
    # Only allow simulation in DEMO MODE
    # --------------------------------------------------------

    if not demo_mode:

        return {

            "success":
                False,

            "transaction_created":
                False,

            "error":
                "Demo mode is OFF",

            "message":
                "Enable DEMO MODE first using POST /api/demo/on"
        }


    # --------------------------------------------------------
    # Demo scenarios
    # --------------------------------------------------------

    scenarios = {

        "NORMAL": {

            "event":
                "NORMAL",

            "trust":
                100,

            "anomaly":
                0,

            "decision":
                "ALLOW",

            "action":
                "MONITOR",

            "action_verified":
                1,

            "temperature":
                27.5,

            "humidity":
                60.0,

            "distance":
                150.0,

            "mq":
                1,

            "pir":
                0,

            "battery":
                11.1
        },


        "MOTION": {

            "event":
                "MOTION_DETECTED",

            "trust":
                100,

            "anomaly":
                0,

            "decision":
                "ALLOW",

            "action":
                "SECURITY_RESPONSE",

            "action_verified":
                1,

            "temperature":
                28.5,

            "humidity":
                74.0,

            "distance":
                176.0,

            "mq":
                1,

            "pir":
                1,

            "battery":
                11.0
        },


        "GAS": {

            "event":
                "GAS_ALERT",

            "trust":
                95,

            "anomaly":
                35,

            "decision":
                "ALLOW",

            "action":
                "EMERGENCY_RESPONSE",

            "action_verified":
                1,

            "temperature":
                29.0,

            "humidity":
                72.0,

            "distance":
                120.0,

            "mq":
                0,

            "pir":
                0,

            "battery":
                10.9
        },


        "UNTRUSTED": {

            "event":
                "SENSOR_ANOMALY",

            "trust":
                35,

            "anomaly":
                80,

            "decision":
                "REJECT",

            "action":
                "SAFE_HOLD",

            "action_verified":
                1,

            "temperature":
                35.0,

            "humidity":
                95.0,

            "distance":
                1.2,

            "mq":
                0,

            "pir":
                1,

            "battery":
                10.5
        }

    }


    # --------------------------------------------------------
    # Invalid scenario
    # --------------------------------------------------------

    if scenario not in scenarios:

        return {

            "success":
                False,

            "transaction_created":
                False,

            "error":
                "Unknown scenario",

            "available":
                list(
                    scenarios.keys()
                )
        }


    # --------------------------------------------------------
    # Create event
    # --------------------------------------------------------

    event = scenarios[
        scenario
    ].copy()


    event["device_id"] = (
        DEVICE_ID
    )

    event["received_at"] = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    event["source"] = "SIMULATOR"


    # --------------------------------------------------------
    # Update dashboard
    # --------------------------------------------------------

    with data_lock:

        latest_event = event


    # --------------------------------------------------------
    # Determine state
    # --------------------------------------------------------

    current_state = create_state(
        event
    )


    # --------------------------------------------------------
    # Same state
    # --------------------------------------------------------

    if current_state == last_state:

        return {

            "success":
                True,

            "transaction_created":
                False,

            "message":
                "Same state - no new blockchain block",

            "event":
                event
        }


    # --------------------------------------------------------
    # New state
    # --------------------------------------------------------

    last_state = current_state


    # --------------------------------------------------------
    # Reputation transaction
    # --------------------------------------------------------

    audit = record_reputation_event(event)


    # --------------------------------------------------------
    # Blockchain transaction
    # --------------------------------------------------------

    block = add_block(
        event
    )


    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return {

        "success":
            True,

        "transaction_created":
            True,

        "event":
            event,

        "block":
            block
    }

# ============================================================
# ADVANCED TRUSTMESH FEATURES
# ============================================================

@app.get("/api/trustmesh/features")
def advanced_features():
    """
    Feature capability/health endpoint for the dashboard.
    """
    prediction = predictive_trust_analysis()

    return {
        "success": True,
        "backend_ready": True,
        "device": DEVICE_ID,
        "features": {
            "reputation_pricing": True,
            "reputation_passport": True,
            "predictive_trust": True,
        },
        "reputation": {
            "score": reputation_score,
            "state": reputation_state(),
            "delta": reputation_last_delta,
            "event": reputation_last_event,
            "recovery": reputation_recovery,
        },
        "prediction": prediction,
    }


@app.get("/api/trustmesh/pricing/{service_id}")
def trustmesh_service_pricing(service_id: str):
    """
    Reputation-aware M2M service price.
    """
    pricing = calculate_service_pricing(service_id)

    if pricing is None:
        return {
            "success": False,
            "error": "Unknown service",
            "available": list(M2M_SERVICES.keys()),
        }

    return {
        "success": True,
        "pricing": pricing,
    }


@app.get("/api/trustmesh/passport/{machine_id}")
def trustmesh_reputation_passport(machine_id: str):
    """
    Portable machine reputation passport.
    """
    if machine_id.upper() != DEVICE_ID:
        return {
            "success": False,
            "error": "Unknown machine",
            "available": [DEVICE_ID],
        }

    return {
        "success": True,
        "passport": build_reputation_passport(),
    }


@app.get("/api/trustmesh/predict/{machine_id}")
def trustmesh_predict(machine_id: str):
    """
    Predictive trust-degradation signal.
    """
    if machine_id.upper() != DEVICE_ID:
        return {
            "success": False,
            "error": "Unknown machine",
            "available": [DEVICE_ID],
        }

    return {
        "success": True,
        "machine_id": DEVICE_ID,
        "prediction": predictive_trust_analysis(),
    }


@app.get("/api/trustmesh/reputation")
def trustmesh_reputation():
    """
    Live reputation and audit trail.
    """
    with data_lock:
        audit = list(reputation_audit)

    return {
        "success": True,
        "machine_id": DEVICE_ID,
        "score": reputation_score,
        "state": reputation_state(),
        "delta": reputation_last_delta,
        "event": reputation_last_event,
        "recovery": reputation_recovery,
        "audit": audit,
        "rules": REPUTATION_RULES,
        "bounds": {
            "minimum": 0,
            "maximum": 100,
        },
    }


@app.post("/api/trustmesh/event")
def trustmesh_ingest_event(event: dict):
    """
    Optional software/API ingestion path.

    LIVE hardware remains authoritative through COM7.
    This endpoint is intended for trusted backend integrations
    and does not bypass the existing serial architecture.
    """
    required = [
        "event",
        "trust",
        "anomaly",
        "decision",
        "action",
        "action_verified",
    ]

    missing = [
        key for key in required
        if key not in event
    ]

    if missing:
        return {
            "success": False,
            "error": "Missing required fields",
            "missing": missing,
        }

    normalized = {
        "event": str(event["event"]).upper(),
        "trust": max(
            0,
            min(100, int(event["trust"]))
        ),
        "anomaly": max(
            0,
            min(100, int(event["anomaly"]))
        ),
        "decision": str(
            event["decision"]
        ).upper(),
        "action": str(
            event["action"]
        ).upper(),
        "action_verified": int(
            bool(event["action_verified"])
        ),
        "temperature": float(
            event.get("temperature", 0)
        ),
        "humidity": float(
            event.get("humidity", 0)
        ),
        "distance": float(
            event.get("distance", 0)
        ),
        "mq": int(event.get("mq", 0)),
        "pir": int(event.get("pir", 0)),
        "battery": float(
            event.get("battery", 0)
        ),
        "device_id": DEVICE_ID,
        "received_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "source": "API",
    }

    global latest_event
    global last_state

    with data_lock:
        latest_event = normalized

    current_state = create_state(normalized)

    if current_state == last_state:
        return {
            "success": True,
            "transaction_created": False,
            "message": "Same state - no new blockchain block",
            "event": normalized,
            "reputation": {
                "score": reputation_score,
                "state": reputation_state(),
            },
        }

    last_state = current_state

    audit = record_reputation_event(normalized)
    block = add_block(normalized)

    return {
        "success": True,
        "transaction_created": True,
        "event": normalized,
        "reputation": audit,
        "block": block,
        "prediction": predictive_trust_analysis(),
    }
