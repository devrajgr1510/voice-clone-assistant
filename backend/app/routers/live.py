"""
WebSocket endpoint that streams a simulated 'live call analysis' — a rising
sequence of risk sub-scores — so the frontend's Live Call Protection screen
can animate as if it were reading a real-time audio pipeline.
"""
import asyncio
import random

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import risk_engine

router = APIRouter()


@router.websocket("/ws/live-call")
async def live_call_feed(websocket: WebSocket):
    await websocket.accept()
    try:
        final_scores = risk_engine.score_call()
        t = 0
        while True:
            progress = min(1.0, t / 24)
            live_scores = {
                k: max(0, round(v * progress + random.uniform(-3, 3)))
                for k, v in final_scores.items()
            }
            await websocket.send_json({
                "t": t,
                "scores": live_scores,
                "waveform": [round(random.uniform(0.1, 1.0), 2) for _ in range(40)],
            })
            t += 1
            if t > 24:
                # start a new simulated call
                final_scores = risk_engine.score_call()
                t = 0
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
