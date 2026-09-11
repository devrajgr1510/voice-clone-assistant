"""
Telephony integration layer — the single seam where VAANEE SHIELD talks to a
real phone network.

Out of the box (no provider credentials configured) this runs in
SIMULATION MODE: outbound calls are modeled locally through the normal
dialing -> ringing -> in_progress -> ended lifecycle, so the Dialer UI, the
WebSocket risk feed, and the database all work end-to-end — nothing actually
rings on a real phone.

To place REAL calls to real mobile numbers:

1. Create an account with a telephony/CPaaS provider (Twilio is the
   reference implementation below; Vonage/Plivo are similar).
2. Buy or verify a caller-ID phone number with that provider.
3. `pip install twilio` in backend/requirements.txt.
4. Set these environment variables before starting the backend:
     VAANEE_TELEPHONY_PROVIDER=twilio
     TWILIO_ACCOUNT_SID=...
     TWILIO_AUTH_TOKEN=...
     TWILIO_FROM_NUMBER=+1...              # a number you own on Twilio
     VAANEE_TWIML_URL=https://<your-public-backend>/twiml/connect
   (The TwiML URL must be publicly reachable by Twilio — use a tunnel like
   ngrok in development.)
5. Nothing else changes: routers/dialer.py calls `place_call()` /
   `end_call()` below regardless of mode, and the API/DB contract the
   frontend relies on is identical either way.
"""
import os
from typing import Optional, TypedDict


class CallResult(TypedDict):
    provider: str
    provider_call_sid: Optional[str]
    state: str  # "ringing" | "failed"
    message: str


PROVIDER = os.environ.get("VAANEE_TELEPHONY_PROVIDER", "").strip().lower()  # "" | "twilio"
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
TWIML_URL = os.environ.get("VAANEE_TWIML_URL")


def is_live_configured() -> bool:
    """True only once a real provider's credentials are fully set."""
    return PROVIDER == "twilio" and bool(
        TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER and TWIML_URL
    )


def place_call(to_number: str, from_number: Optional[str] = None) -> CallResult:
    """Places a real outbound call if a provider is configured; otherwise
    returns a simulated call session so the rest of the app still works."""
    if is_live_configured():
        return _place_call_twilio(to_number, from_number or TWILIO_FROM_NUMBER)
    return {
        "provider": "simulated",
        "provider_call_sid": None,
        "state": "ringing",
        "message": (
            "No telephony provider configured — running in simulation mode. "
            "See backend/app/services/telephony.py for how to enable real calls."
        ),
    }


def _place_call_twilio(to_number: str, from_number: str) -> CallResult:
    try:
        from twilio.rest import Client  # optional dependency, not in requirements.txt by default
    except ImportError:
        return {
            "provider": "twilio",
            "provider_call_sid": None,
            "state": "failed",
            "message": "The 'twilio' package isn't installed. Run: pip install twilio",
        }
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        call = client.calls.create(to=to_number, from_=from_number, url=TWIML_URL)
        return {
            "provider": "twilio",
            "provider_call_sid": call.sid,
            "state": "ringing",
            "message": "Live call initiated via Twilio.",
        }
    except Exception as exc:  # noqa: BLE001 — surface any provider error to the caller
        return {
            "provider": "twilio",
            "provider_call_sid": None,
            "state": "failed",
            "message": f"Twilio error: {exc}",
        }


def end_call(provider_call_sid: Optional[str]) -> None:
    """Hangs up the real call leg if one exists."""
    if not (provider_call_sid and is_live_configured()):
        return
    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.calls(provider_call_sid).update(status="completed")
    except Exception:
        pass  # best-effort hangup; call is already marked ended locally
