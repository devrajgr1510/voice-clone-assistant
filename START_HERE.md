# Start here

1. **Backend** (Terminal 1)
   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   Watch the console — it prints your default admin username/password once.

2. **Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:5173

3. **Admin panel**: click "Admin Panel" in the sidebar (desktop) or go to
   `/admin/login`, sign in with the credentials from step 1, then change
   the password by creating a new super_admin account and disabling the
   default one.

4. Read `README.md` section 1 ("What's real vs. simulated") before you
   demo or deploy this — it explains exactly which parts are genuine
   signal-processing / auth code and which are simulated for demo purposes.

Convenience scripts (`run.sh` for macOS/Linux, `run.bat` for Windows) that
do steps 1-2 for you are in the project root — edit the paths inside if
your Python/Node binaries aren't on PATH.
