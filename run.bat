@echo off
cd /d "%~dp0"

start "VAANEE SHIELD backend" cmd /k "cd backend && (if not exist .venv python -m venv .venv) && call .venv\Scripts\activate && pip install -q -r requirements.txt && uvicorn app.main:app --reload --port 8000"
start "VAANEE SHIELD frontend" cmd /k "cd frontend && (if not exist node_modules npm install) && npm run dev"
