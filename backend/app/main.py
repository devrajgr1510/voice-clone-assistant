from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.seed import seed
from app.routers import (
    calls, alerts, speakers, analytics, settings, live, dialer, recordings, webrtc,
    auth, admin, analyze, helpdesk,
)

Base.metadata.create_all(bind=engine)
seed()

app = FastAPI(
    title="VAANEE SHIELD API",
    description="AI-powered real-time voice cloning & impersonation detection platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production to the frontend's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls.router)
app.include_router(alerts.router)
app.include_router(speakers.router)
app.include_router(analytics.router)
app.include_router(settings.router)
app.include_router(live.router)
app.include_router(dialer.router)
app.include_router(recordings.router)
app.include_router(webrtc.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(analyze.router)
app.include_router(helpdesk.router)


@app.get("/api/health")
def health():
    return {"status": "online", "service": "vaanee-shield-api"}
