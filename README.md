# AI-AIRCRAFT-MAINTENANCE-WEBSITE PROJECT!!!

Hey! Iam Vishnu and ive working on AI Aircraft Maintenance Website Project!!!
AI-AIRCRAFT-MAINTENANCE is an advanced, aerospace-grade post-landing telemetry and predictive maintenance website.
It automates the intake of aircraft recorder data (ACARS / FDR / QAR) and cross-references sensor signals against
official Aircraft Maintenance Manual (AMM).

# LIVE DEMO URL
https://ai-aircraft-maintenance-website.onrender.com

# THE CORE PROBLEM IT SOLVES.

Every Modern aircraft generate millions of telemetry data points across every flight cycles.
The Maintenance crews must manually inspect flight logs, calculate trend shifts, and cross-reference multiple data of dense Aircraft Maintenance Manuals (Such as the AeroTech ATX200 standard) to verify if an aircraft is healthy or requires maintenance.

AEROCARE INTELLIGENCE SOLVES THIS BY.

* Take flight telemetry datasets (.xlsx, .xls) or AI-certified Aircraft status reports(.pdf, .xlsx).
* Performing trend slope and anomaly analysis across 14 primary propulsion,
thermal, and hydraulic sensors and systems
* Deterministically comparing observed telemetry against manufacturer allowable limits.

# KEY FEATURE & CAPABILITIES.

1. Multi-fleet tactical Radar HUD.
* Real-time fleet squadron selector supporting active aircraft (e.g., AIR-001 , AIR-002 through AIR-005, N5142B Cessna 172S).
* Live aerospace UTC Zulu and local airport clocks.

2. Dual Ingestion Pipeline (Excel + PDF).
* Flight Telemetry Intake: Dropzone for ACARS / FDR flight cycle data exports.
* Smart Validation and Guidance: Automatic smooth scrolling to result or error advisories with inline alerts.

3. Real-Time Hydraulic Diagnostics.
* 8 Radial Avionics Engine Gauge: Visual circular meters with real-time color-coded risk bands for EGT, vibration peak, fuel flow, hydraulic bus, and oil metrics.

* 14 Channel Telemetry Stream: Interactive tabs featuring historical baselines, latest reading, percentage and trend badges(↑ INCREASING, ↓ DECREASING, → STABLE)

4. Deterministic Manual Threshold Compliance.
* Benchmarks against hard engineering thresholds (e.g.. EGT > 650℃, Vibration > 2.5 mm/s. Hydraulic Bus < 2,900 PSI).

5. Ai Maintenance Decision and ATA Task Checklist.
* clear Flight Release Badge: Instant High-visibility healthy status (Cleared to Fly, Maintenance Required, Aircraft Grounded).
* AI Diagnostic Explainability: Detailed technical report explaining the mechanical root cause for line maintenance engineers.

# TECHNOLOGY HIGHLIGHTS:

* Frontend:
- React 18,
- Vite,
- Custom Aerospace Glassmorphism CSS,
- Responsive Grid,
- SVG Flight Vector Radar.

* Backend:
- Python 3.13,
- FastAPI,
- Uvicorn,
- Pandas,
- OpenPyXL PyPDF / PDFPlumber.

*Diagnostics: Custom statistical trend analysis (cycle-over-cycle slope, standard deviations, and threshold breach detection).

## HOW TO RUN THE PROJECT

## Option 1: One-Click Quick Start (windows)
Double-click `start.bat` in the root folder, or run in terminal:
```cmd
start.bat
```
*(This automatically launches both backend and frontend servers in separate windows and opens your browser to http://localhost:3000)*

Option 2: Manual Step-By-Step Run

1. Prerequisites:

* Python: 3.10 or higher
* Node.js: v18 or higher (with npm)

2. Start Backend Server (FastAPI):
Open a terminal in the project root:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
Backend runs at: http://localhost:8000
Interactive Swagger API Docs: http://localhost:8000/docs

3. Start Frontend Dashboard (React + Vite):
Open a second terminal in the project root:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:3000

## DEMO REPORT PDF AND EXCEL

To get Demo reports available in repo you can get it.
* https://github.com/VISHNUKUMARA2010/AI-AIRCRAFT-MAINTENANCE-WEBSITE/blob/main/AeroTech_ATX200_Maintenance_Manual.pdf
* https://github.com/VISHNUKUMARA2010/AI-AIRCRAFT-MAINTENANCE-WEBSITE/blob/main/Cessna_172S_N5142B_Maintenance_Report.pdf
* https://github.com/VISHNUKUMARA2010/AI-AIRCRAFT-MAINTENANCE-WEBSITE/blob/main/Cessna_172S_N5142B_Maintenance_Report.xlsx
* https://github.com/VISHNUKUMARA2010/AI-AIRCRAFT-MAINTENANCE-WEBSITE/blob/main/aircraft_maintenance_intelligence_dataset.xlsx
