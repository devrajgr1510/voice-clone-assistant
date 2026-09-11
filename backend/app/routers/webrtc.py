"""
WebRTC signaling relay for real, live, two-way voice calls between two
browsers — a "caller" and a "responder" — inside VAANEE SHIELD.

This endpoint never touches audio itself. It only relays small JSON
signaling messages (SDP offers/answers, ICE candidates) between the two
peers of a room so their browsers can negotiate a direct WebRTC connection
(using a public STUN server, configured on the frontend). Once negotiated,
audio flows peer-to-peer — not through this server.

Rooms are kept in an in-memory dict, which is fine for a single-process
dev/demo deployment. For a multi-worker/production deployment, back this
with Redis pub/sub, or swap in a hosted SFU provider (LiveKit, Daily, Twilio
Video) behind the same two-message contract the frontend already uses
(peer-joined / offer / answer / ice-candidate / peer-left).
"""
import asyncio
from typing import Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

ROLES = ("caller", "responder")


class Room:
    """Holds at most one 'caller' and one 'responder' socket."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.peers: Dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()

    async def add(self, role: str, ws: WebSocket) -> Optional[str]:
        async with self.lock:
            if role in self.peers:
                return f"A {role} is already connected to this call."
            self.peers[role] = ws
            return None

    async def remove(self, role: str) -> None:
        async with self.lock:
            self.peers.pop(role, None)

    async def other(self, role: str) -> Optional[WebSocket]:
        other_role = "responder" if role == "caller" else "caller"
        async with self.lock:
            return self.peers.get(other_role)

    async def is_empty(self) -> bool:
        async with self.lock:
            return not self.peers


_rooms: Dict[str, Room] = {}
_rooms_lock = asyncio.Lock()


async def _get_or_create_room(room_id: str) -> Room:
    async with _rooms_lock:
        room = _rooms.get(room_id)
        if room is None:
            room = Room(room_id)
            _rooms[room_id] = room
        return room


async def _drop_room_if_empty(room_id: str) -> None:
    room = _rooms.get(room_id)
    if room is not None and await room.is_empty():
        async with _rooms_lock:
            # Re-check under the lock in case someone joined in between.
            room = _rooms.get(room_id)
            if room is not None and not room.peers:
                _rooms.pop(room_id, None)


@router.websocket("/ws/webrtc/{room_id}")
async def webrtc_signaling(websocket: WebSocket, room_id: str, role: str = "caller"):
    role = role if role in ROLES else "caller"
    await websocket.accept()

    room = await _get_or_create_room(room_id)
    error = await room.add(role, websocket)
    if error:
        await websocket.send_json({"type": "room-full", "message": error})
        await websocket.close()
        return

    # If the other side is already here, tell both sides it's time to
    # negotiate (the caller side initiates the SDP offer).
    other_ws = await room.other(role)
    if other_ws is not None:
        await websocket.send_json({"type": "peer-joined"})
        try:
            await other_ws.send_json({"type": "peer-joined"})
        except Exception:
            pass

    try:
        while True:
            msg = await websocket.receive_json()
            target = await room.other(role)
            if target is None:
                continue
            msg["from"] = role
            try:
                await target.send_json(msg)
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await room.remove(role)
        remaining = await room.other(role)
        if remaining is not None:
            try:
                await remaining.send_json({"type": "peer-left"})
            except Exception:
                pass
        await _drop_room_if_empty(room_id)
