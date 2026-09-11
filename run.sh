#!/usr/bin/env bash
# Starts backend (port 8000) and frontend (port 5173) together.
set -e
cd "$(dirname "$0")"

( cd backend && \
  [ -d .venv ] || python3 -m venv .venv; \
  source .venv/bin/activate && \
  pip install -q -r requirements.txt && \
  uvicorn app.main:app --reload --port 8000 ) &
BACKEND_PID=$!

( cd frontend && \
  [ -d node_modules ] || npm install; \
  npm run dev ) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
