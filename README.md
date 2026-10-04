# ChronoRx Tech — Clinical Decision Support System (CDSS)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF.svg)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind_CSS-38B2AC.svg)](https://tailwindcss.com)
[![NIH RxNav](https://img.shields.io/badge/Medical_API-NIH_RxNorm-blue.svg)](https://rxnav.nlm.nih.gov)
[![openFDA](https://img.shields.io/badge/Drug_Labels-openFDA-0A85EA.svg)](https://open.fda.gov)
[![ReportLab](https://img.shields.io/badge/PDF_Engine-ReportLab-FF6F00.svg)](https://www.reportlab.com)

**ChronoRx Tech** is an **AI-assisted Clinical Decision Support System (CDSS) prototype** designed to assist healthcare professionals with:
- **Prescription and medical report extraction** via camera scan or document upload.
- **Image preprocessing and OCR text recognition** (Tesseract abstraction with robust clinical fallbacks).
- **Drug identification and normalization** anchored in the official **NIH RxNorm / RxNav REST API**.
- **Evidence-based drug labeling and safety warnings** retrieved directly from the **U.S. FDA Drug Labeling (openFDA) API**.
- **Multi-layer drug interaction surveillance** (high-priority contraindications, moderate interactions, dietary/food factors, and duplicate therapies).
- **Circadian Chronopharmacology medication scheduling** (optimizing dosing times according to circadian biology while maintaining strict clinician sovereignty).
- **Clinician-authorized E-Prescription and Clinical Report generation** using **ReportLab** with legal disclaimers and verification audit trails.

---

## ⚠️ Mandatory Medical Safety Principles & Disclaimer

> **IMPORTANT MEDICAL NOTICE:**
>
> 1. **Non-Autonomous System:** ChronoRx Tech is a clinical decision-support prototype, **NOT** an autonomous prescribing system, medical doctor, or dispensing pharmacist.
> 2. **No Guaranteed Dosing:** The system never claims that AI outputs represent a guaranteed, exact, or 100% correct dose.
> 3. **Mandatory Clinician Sign-off:** No AI-generated recommendation can ever be presented or released as a final prescription without explicit, manual review and formal confirmation by an authorized licensed healthcare professional.
> 4. **Prominent Safety Disclaimers:** Every clinical screen and generated document displays:
>    *`"AI-assisted reference information — verify with an authorized healthcare professional."`*
> 5. **Grounding in Authoritative Data:** Drug normalization is strictly anchored in NIH RxNorm, and labeling warnings in openFDA. The AI acts only as an extraction and linguistics layer—it never invents drug interactions or dosages.
> 6. **No Speculative Guessing:** If a drug cannot be confidently identified with high certainty, the system displays:
>    *`"Unable to confidently identify — manual verification required"`* rather than guessing.
> 7. **Negative Interaction Grounding:** When no interaction is found in verified registries, the system uses:
>    *`"No relevant interaction identified in the checked source"`* instead of falsely declaring an agent unconditionally "Safe".

---

## 🔒 Security & Zero-PII Transmission Architecture

Patient privacy and data minimization are core design pillars:

1. **Pseudo-Anonymization (Module 1):**
   - Direct Patient Identifiers (Full Name, Phone Number, Contact Details) are stored locally in isolated records.
   - The system generates and displays a standardized pseudo-anonymized identifier (e.g. `P-1024` or `DEMO-1001`).
2. **PII Scrubbing:**
   - Before prescription text is evaluated by local AI models or external medical APIs, an automated regex-based de-identification layer redacts any detected patient names, phone numbers, or doctor names.
   - External APIs (openFDA, RxNav) receive only normalized chemical or trade drug names—**never patient demographics**.
3. **Role-Based Access Control (RBAC):**
   - Three pre-configured clinical roles: **Doctor / Clinician**, **Receptionist**, and **Administrator**.
   - Session management backed by JSON Web Tokens (JWT) and bcrypt password hashing.
4. **Immutable Audit Trail:**
   - Every patient access, prescription scan, OCR transcription, interaction evaluation, schedule generation, and PDF export is permanently recorded in the `audit_logs` table with user attribution, timestamp, and IP address.

---

## 📁 Repository Structure

```
chronorx/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI application entrypoint & middleware
│   │   ├── config.py                # Pydantic BaseSettings & environment variables
│   │   ├── database.py              # SQLAlchemy engine (SQLite / PostgreSQL)
│   │   ├── api/                     # REST API Routers
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # Login, registration, JWT session
│   │   │   ├── patients.py          # Registration & pseudo-anonymization (Module 1)
│   │   │   ├── scan.py              # Image upload, preprocessing, OCR & AI (Module 3)
│   │   │   ├── drugs.py             # RxNorm normalization & openFDA references
│   │   │   ├── dose.py              # Posology & DuBois BSA calculation (Module 2)
│   │   │   ├── interactions.py      # Multi-tier drug interaction checker (Module 4)
│   │   │   ├── schedule.py          # Chronopharmacology timetable generator (Module 5)
│   │   │   ├── summary.py           # Structured AI clinical report synthesis (Module 6)
│   │   │   ├── prescription.py      # ReportLab PDF e-Prescription (Module 7)
│   │   │   └── audit.py             # Audit trail & dashboard analytics metrics
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── models.py            # SQLAlchemy models (User, Patient, ScanRecord, etc.)
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py           # Pydantic v2 schemas for all requests/responses
│   │   ├── security/
│   │   │   ├── __init__.py
│   │   │   ├── auth_handler.py      # Passlib bcrypt hashing & JWT token verification
│   │   │   └── anonymizer.py        # PII regex scrubber & audit logger
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── ocr_service.py       # Tesseract OCR engine + Preprocessing + Fallback
│   │       ├── ai_service.py        # Local Ollama AI client + Rule-based Clinical NER
│   │       ├── rxnorm_service.py    # NIH RxNav REST client + Authoritative local cache
│   │       ├── openfda_service.py   # U.S. FDA Drug Labeling API client + Fallback
│   │       ├── dose_service.py      # DuBois BSA posology calculation & clinical rules
│   │       ├── interaction_service.py # Drug-drug, food & duplicate therapy matrix
│   │       ├── schedule_service.py  # Circadian pharmacokinetics timetable engine
│   │       └── pdf_service.py       # ReportLab PDF generation engine
│   ├── requirements.txt             # Python dependencies
│   ├── .env.example                 # Environment configuration template
│   ├── .env                         # Active configuration
│   ├── Dockerfile                   # Backend Docker container specification
│   ├── run.py                       # Single-command backend development runner
│   └── generate_sample_assets.py    # Generates synthetic prescription images for testing
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Top navigation with patient selector & role badge
│   │   │   ├── Sidebar.jsx          # Sidebar menu with patient vitals widget
│   │   │   ├── MedicalDisclaimer.jsx# Mandatory medical safety disclaimer banner
│   │   │   ├── CameraCaptureModal.jsx # Live HTML5 camera viewfinder & capture modal
│   │   │   └── VerificationBadge.jsx# Confidence and verification status badges
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      # Authentication session & token management
│   │   │   └── PatientContext.jsx   # Clinical workflow state & active patient data
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Sign-in page with 1-click demo logins
│   │   │   ├── Dashboard.jsx        # Metrics cards, clinical alerts, activity feed
│   │   │   ├── PatientRegistration.jsx # Patient registration & DuBois BSA calculation
│   │   │   ├── PatientDirectory.jsx # Patient directory with search and cohort table
│   │   │   ├── PatientProfile.jsx   # Individual patient demographic & clinical profile
│   │   │   ├── ScanPrescription.jsx # Dual-mode Camera scan & file upload interface
│   │   │   ├── OCRReview.jsx        # OCR transcription editing & AI entity extraction
│   │   │   ├── MedicationAnalysis.jsx # Dose support, DuBois BSA, & openFDA monographs
│   │   │   ├── InteractionChecker.jsx # Drug-drug & food safety surveillance matrix
│   │   │   ├── ChronoTimetable.jsx  # Circadian daily administration schedule
│   │   │   ├── ClinicalSummary.jsx  # AI clinical summary synthesis report
│   │   │   ├── PDFPrescription.jsx  # PDF prescription preview, viewer, & download
│   │   │   └── SettingsAudit.jsx    # System engine status & compliance audit log
│   │   ├── services/
│   │   │   └── api.js               # Axios HTTP client with Bearer auth interceptors
│   │   ├── App.jsx                  # Main routing and authenticated layout wrapper
│   │   ├── main.jsx                 # React DOM entrypoint
│   │   └── index.css                # Tailwind CSS styling and clinical animations
│   ├── package.json                 # Node dependencies
│   ├── vite.config.js               # Vite configuration with API proxying
│   ├── tailwind.config.js           # Medical teal theme configuration
│   ├── postcss.config.js            # PostCSS configuration
│   ├── index.html                   # HTML entrypoint
│   └── Dockerfile                   # Frontend Docker container specification
│
├── demo_assets/                     # Sample realistic prescription images
├── uploads/                         # Temporary uploaded prescription scans
├── generated_reports/               # Output directory for generated PDF prescriptions
├── docker-compose.yml               # Multi-container orchestration (DB, API, Frontend)
├── start_backend.bat                # 1-Click Windows backend runner
├── start_frontend.bat               # 1-Click Windows frontend runner
├── start_backend.sh                 # 1-Click Unix backend runner
└── start_frontend.sh                # 1-Click Unix frontend runner
```

---

## 🛠️ Prerequisites

- **Python 3.10+** (Tested on Python 3.10, 3.11, 3.12)
- **Node.js 18+** & **npm** (for the React frontend)
- *(Optional)* **Tesseract OCR**: If not installed, ChronoRx Tech gracefully activates its built-in clinical fallback OCR engine so testing never crashes.
- *(Optional)* **Ollama**: If not running locally, ChronoRx Tech utilizes its high-precision rule-based Clinical Named Entity Recognition (NER) engine.

---

## 🚀 Quick Start Guide (Run Locally)

### Option 1: Automatic 1-Click Startup Scripts

#### On Windows:
1. Double-click `start_backend.bat` (or run in cmd/powershell).
2. Double-click `start_frontend.bat` in a second terminal.
3. Open your browser at: **`http://localhost:5173`**

#### On Linux / macOS:
```bash
# Terminal 1: Backend
chmod +x start_backend.sh start_frontend.sh
./start_backend.sh

# Terminal 2: Frontend
./start_frontend.sh
```

---

### Option 2: Step-by-Step Manual Setup

#### Step 1: Start the Backend (FastAPI)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd chronorx/backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Generate sample prescription assets for testing:
   ```bash
   python generate_sample_assets.py
   ```
5. Run the server:
   ```bash
   python run.py
   ```
   *The backend will be running at `http://127.0.0.1:8000`. Interactive API Docs are available at `http://127.0.0.1:8000/docs`.*

#### Step 2: Start the Frontend (React + Vite)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd chronorx/frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the development server:
   ```bash
   npm run dev
   ```
4. Access the web application at **`http://localhost:5173`**.

---

## 👥 Demo Credentials & Out-of-the-Box Demo Data

The database is pre-seeded on first run with default users and test subjects:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Doctor / Clinician** | `doctor` | `doctor123` | Full clinical review, authorization, PDF generation |
| **Receptionist** | `receptionist` | `reception123` | Patient registration, scanning, and intake |
| **Administrator** | `admin` | `admin123` | Compliance logs, audit trail, user administration |

*(On the Login screen, click any of the 1-click preset buttons to instantly authenticate).*

### Pre-loaded Demo Patients:
- **`DEMO-1001`**: 58-year-old male, 82 kg, 178 cm, DuBois BSA: **2.01 m²**, Hypertension, Hyperlipidemia, Allergies: *Penicillin*.
- **`DEMO-1002`**: 46-year-old female, 65 kg, 162 cm, DuBois BSA: **1.69 m²**, Type 2 Diabetes, GERD, Allergies: *Sulfa drugs*.

---

## 🔄 End-to-End Camera & Clinical Workflow

Follow this exact flow to test the system end-to-end:

```
Dashboard
   ↓
Scan Prescription (Camera capture or Document upload)
   ↓
Image Preprocessing (Auto-contrast, median denoise, 90° rotation)
   ↓
OCR Extraction (Visible text transcription)
   ↓
Clinician Review of OCR (Correct abbreviations or typos)
   ↓
AI Structured Extraction (Extracts drugs, strengths, routes, sig codes)
   ↓
RxNorm Drug Normalization (NIH RxNav matching + RxCUI assignment)
   ↓
Medical Source Cross-Check (openFDA boxed warnings & indications)
   ↓
Drug Safety Check (High-priority interactions, food advisories)
   ↓
ChronoRx Timetable (Circadian morning, evening, and bedtime slots)
   ↓
Clinician Confirmation (Mandatory verification checkbox & remarks)
   ↓
Generate E-Prescription / ReportLab PDF (Downloadable clinical PDF)
```

---

## 🔬 Authoritative Medical API Integration Details

### 1. NIH RxNorm / RxNav REST API
- **Base Endpoint:** `https://rxnav.nlm.nih.gov/REST`
- **Drug Approximation:** `/approximateTerm.json?term={query}&maxEntries=4`
- **Preferred Properties:** `/rxcui/{rxcui}/properties.json`
- **Offline/Mirror Layer:** Contains a verified dictionary of standard medications (Atorvastatin, Lisinopril, Metformin, Warfarin, Clopidogrel, Omeprazole, Amoxicillin, etc.) ensuring instant responses even during network disconnection.
- **Safety Fallback:** If confidence is below 60%, the system flags:
  *`"Unable to confidently identify — manual verification required"`*.

### 2. U.S. FDA Drug Product Labeling (openFDA)
- **Base Endpoint:** `https://api.fda.gov/drug/label.json`
- **Queries:** Evaluates `openfda.brand_name` and `openfda.generic_name`.
- **Extracted Monograph Fields:**
  - `indications_and_usage`
  - `dosage_and_administration`
  - `boxed_warning`
  - `warnings_and_precautions`
  - `contraindications`
  - `drug_interactions`
- Displays retrieval timestamp and formal source attribution on every response.

---

## 🦙 Ollama AI & OCR Setup Guide

### 1. Local Ollama Integration
ChronoRx Tech connects to local Ollama out of the box via `http://localhost:11434`.

To install and run a clinical model locally:
1. Download Ollama from [ollama.com](https://ollama.com).
2. Pull a recommended model:
   ```bash
   ollama run llama3
   # or for specialized clinical inference:
   ollama run biomistral
   ```
3. In `backend/.env`, set:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3
   AI_FALLBACK_MODE=true
   ```
*If Ollama is stopped, the backend automatically transitions to its built-in Clinical NER regex engine without throwing errors.*

### 2. Tesseract OCR Setup
ChronoRx Tech utilizes `pytesseract` with image preprocessing (PIL autocontrast, median filter, Otsu thresholding, orientation normalization).

- **Windows:**
  1. Download the Tesseract installer from [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/wiki).
  2. Install to `C:\Program Files\Tesseract-OCR`.
  3. In `backend/.env`, set:
     ```env
     TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
     ```
- **Ubuntu/Debian:**
  ```bash
  sudo apt-get install tesseract-ocr
  ```
- **macOS:**
  ```bash
  brew install tesseract
  ```
*If Tesseract is not installed, ChronoRx Tech provides its heuristic optical character transcription engine so you can test all downstream modules immediately.*

---

## 🧪 Anthropometric Mathematical Formulas

### DuBois & DuBois Body Surface Area (BSA)
Used in Module 1 and Module 2:
$$\text{BSA (m}^2\text{)} = 0.007184 \times \text{Weight (kg)}^{0.425} \times \text{Height (cm)}^{0.725}$$

### Body Mass Index (BMI)
$$\text{BMI (kg/m}^2\text{)} = \frac{\text{Weight (kg)}}{(\text{Height (m)})^2}$$

### Clinical Guardrail on Pediatric Formulas:
Universal historical formulas such as **Young's Rule** or **Clark's Rule** are clinically deprecated. ChronoRx Tech explicitly notes that mathematical approximations must be checked against official pediatric drug monographs, renal function (eGFR), and verified by a licensed clinician.

---

## 📄 License & Medical Research Attribution

This software is developed as an educational and clinical decision-support engineering prototype. All pharmaceutical trademarks and monographs referenced belong to their respective regulatory bodies (U.S. National Library of Medicine, NIH, U.S. Food and Drug Administration).
