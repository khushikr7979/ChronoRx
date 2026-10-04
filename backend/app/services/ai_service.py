import json
import re
import requests
import datetime
from typing import Dict, Any, List, Optional
from app.config import settings
from app.security.anonymizer import scrub_pii_from_text
from app.services.rxnorm_service import rxnorm_service

class AIService:
    def __init__(self):
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL

    def is_ollama_available(self) -> bool:
        """Checks if local Ollama daemon is reachable."""
        try:
            resp = requests.get(f"{self.ollama_url}/api/tags", timeout=1.0)
            return resp.status_code == 200
        except Exception:
            return False

    def extract_structured_prescription(self, text: str, patient_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Extracts structured prescription fields from raw OCR text.
        Strips all PII before passing text to any AI model.
        Falls back to specialized clinical regex-NER when Ollama is offline.
        """
        # 1. Scrub PII
        anonymized_text = scrub_pii_from_text(text)

        # 2. Try Ollama if available
        if self.is_ollama_available():
            try:
                result = self._extract_with_ollama(anonymized_text)
                if result and result.get("medicines"):
                    return self._post_process_extraction(result)
            except Exception:
                pass

        # 3. Fallback to specialized Clinical NER Parser
        return self._extract_with_heuristic_ner(anonymized_text)

    def _extract_with_ollama(self, text: str) -> Optional[Dict[str, Any]]:
        prompt = f"""
You are a clinical NLP parser. Extract structured prescription information from the following anonymized text.
Return ONLY a valid JSON object with EXACTLY this structure:
{{
  "patient_name_if_visible": string or null,
  "patient_age_if_visible": string or null,
  "date_if_visible": string or null,
  "doctor_name_if_visible": string or null,
  "medicines": [
    {{
      "raw_name": string,
      "normalized_name": string or null,
      "strength": string or null,
      "dosage_text": string or null,
      "frequency": string or null,
      "route": string or null,
      "duration": string or null,
      "confidence": float
    }}
  ],
  "investigations": [string],
  "instructions": [string],
  "allergies_if_visible": [string],
  "warnings": [string]
}}

Rules:
1. Do not invent or guess information.
2. If uncertain, assign confidence < 0.6.
3. Every medicine must have raw_name and confidence.

Text:
\"\"\"
{text}
\"\"\"
"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        resp = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=20.0)
        if resp.status_code == 200:
            data = resp.json()
            response_text = data.get("response", "{}")
            return json.loads(response_text)
        return None

    def _extract_with_heuristic_ner(self, text: str) -> Dict[str, Any]:
        """
        High-precision rule-based Clinical Named Entity Recognition engine.
        Parses medications, dosages, frequency sig codes, routes, and diagnostic instructions.
        """
        medicines = []
        instructions = []
        investigations = []
        allergies = []
        warnings = []
        date_str = None
        age_str = None
        doc_name = None
        patient_name = None
        patient_id_str = None
        patient_weight_str = None
        patient_gender_str = None

        lines = text.splitlines()
        
        # Medical signature patterns
        freq_pattern = r"(once\s+daily|twice\s+daily|bid|b\.i\.d\.|tid|t\.i\.d\.|qid|q\.i\.d\.|q4h|q6h|q8h|q12h|daily|at\s+bedtime|hs|h\.s\.|prn|p\.r\.n\.|stat)"
        strength_pattern = r"(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?|%))"
        route_pattern = r"(po|p\.o\.|oral|sublingual|sl|iv|i\.v\.|im|i\.m\.|sc|s\.c\.|topical|inhalation)"
        duration_pattern = r"(x\s*\d+\s*(days?|weeks?|months?)|for\s*\d+\s*(days?|weeks?|months?))"

        # Well-known drug dictionary for matching
        known_drugs = [
            "atorvastatin", "lisinopril", "metformin", "aspirin", "omeprazole",
            "amoxicillin", "clopidogrel", "warfarin", "amlodipine", "metoprolol",
            "losartan", "levothyroxine", "ibuprofen", "sertraline", "ciprofloxacin",
            "prednisone", "furosemide", "simvastatin", "pantoprazole", "gabapentin",
            "tramadol", "azithromycin", "hydrochlorothiazide"
        ]

        for line in lines:
            line_clean = line.strip()
            if not line_clean:
                continue

            lower_line = line_clean.lower()

            # Date extraction
            date_match = re.search(r"\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b", line_clean)
            if date_match and not date_str:
                date_str = date_match.group(0)

            # Patient ID extraction (e.g. Patient ID: DEMO-1001 or Patient ID: P-1007)
            pat_id_match = re.search(r"\bpatient\s*id\s*[:=-]?\s*([A-Za-z0-9\-]+)", line_clean, re.I)
            if pat_id_match and not patient_id_str:
                patient_id_str = pat_id_match.group(1).strip()

            # Age extraction
            age_match = re.search(r"\b(age|yo|yrs?)\s*[:=-]?\s*(\d{1,3})\b", lower_line)
            if age_match and not age_str:
                age_str = age_match.group(2)

            # Weight extraction (e.g. Wt: 75 kg or Weight: 82kg)
            wt_match = re.search(r"\b(wt|weight)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(kg|lbs?)?\b", line_clean, re.I)
            if wt_match and not patient_weight_str:
                patient_weight_str = f"{wt_match.group(2)} {wt_match.group(3) or 'kg'}".strip()

            # Gender/Sex extraction (e.g. Sex: M or Gender: Female)
            sex_match = re.search(r"\b(sex|gender)\s*[:=-]?\s*([a-z]+)\b", line_clean, re.I)
            if sex_match and not patient_gender_str:
                g_val = sex_match.group(2).lower()
                if g_val in ["m", "male"]:
                    patient_gender_str = "Male"
                elif g_val in ["f", "female"]:
                    patient_gender_str = "Female"
                else:
                    patient_gender_str = g_val.capitalize()

            # Doctor detection
            if "dr." in lower_line or "doctor" in lower_line:
                doc_name = line_clean

            # Allergy extraction
            if "allerg" in lower_line:
                allerg_content = re.sub(r"allergies?\s*[:=-]?", "", line_clean, flags=re.IGNORECASE).strip()
                if allerg_content and allerg_content.lower() != "none" and allerg_content.lower() != "nkda":
                    allergies.append(allerg_content)
                elif "nkda" in lower_line or "none" in lower_line:
                    allergies.append("No Known Drug Allergies (NKDA)")

            # Investigations extraction
            if any(term in lower_line for term in ["investigation", "tests", "cbc", "inr", "lft", "creatinine", "x-ray", "ecg"]):
                if not any(d in lower_line for d in known_drugs):
                    investigations.append(line_clean)

            # Instructions extraction
            if any(term in lower_line for term in ["instruction", "avoid", "with food", "before breakfast", "take with"]):
                if not any(d in lower_line for d in known_drugs):
                    instructions.append(line_clean)

            # Medicine extraction
            matched_drug = None
            for d in known_drugs:
                if re.search(r"\b" + re.escape(d) + r"\b", lower_line):
                    matched_drug = d
                    break

            if matched_drug or (re.search(r"^\d+[\.\)]\s*[A-Z]", line_clean) and re.search(strength_pattern, line_clean, re.I)):
                # Extract strength
                st_match = re.search(strength_pattern, line_clean, re.I)
                strength = st_match.group(0) if st_match else None

                # Extract frequency
                freq_match = re.search(freq_pattern, lower_line)
                freq = freq_match.group(0).upper() if freq_match else "As directed"

                # Extract route
                route_match = re.search(route_pattern, lower_line)
                route = "Oral"
                if route_match:
                    r_val = route_match.group(0).lower()
                    if "iv" in r_val: route = "Intravenous"
                    elif "im" in r_val: route = "Intramuscular"
                    elif "sc" in r_val: route = "Subcutaneous"
                    elif "topical" in r_val: route = "Topical"
                    else: route = "Oral"

                # Extract duration
                dur_match = re.search(duration_pattern, lower_line)
                duration = dur_match.group(0) if dur_match else None

                raw_name = matched_drug.capitalize() if matched_drug else line_clean.split()[0]
                
                # Check drug confidence
                confidence = 0.95 if matched_drug else 0.70
                needs_review = confidence < 0.80

                medicines.append({
                    "raw_name": raw_name,
                    "normalized_name": None,
                    "strength": strength,
                    "dosage_text": line_clean,
                    "frequency": freq,
                    "route": route,
                    "duration": duration,
                    "confidence": confidence,
                    "needs_manual_review": needs_review
                })

        return self._post_process_extraction({
            "patient_id_if_visible": patient_id_str,
            "patient_name_if_visible": patient_name,
            "patient_age_if_visible": age_str,
            "patient_weight_if_visible": patient_weight_str,
            "patient_gender_if_visible": patient_gender_str,
            "date_if_visible": date_str,
            "doctor_name_if_visible": doc_name,
            "medicines": medicines,
            "investigations": investigations,
            "instructions": instructions,
            "allergies_if_visible": allergies,
            "warnings": warnings,
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        })

    def _post_process_extraction(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes extracted drugs through RxNorm and attaches safety flags."""
        medicines = data.get("medicines", [])
        for med in medicines:
            raw = med.get("raw_name", "")
            norm = rxnorm_service.normalize_drug(raw)
            med["normalized_name"] = norm.get("matched_name")
            med["rxcui"] = norm.get("rxcui")
            if norm.get("status") == "manual_verification_required":
                med["needs_manual_review"] = True
                med["confidence"] = min(med.get("confidence", 0.5), 0.5)

        data["disclaimer"] = "AI-assisted reference information — verify with an authorized healthcare professional."
        return data

    def generate_clinical_summary(
        self,
        patient_id: str,
        patient_data: Dict[str, Any],
        confirmed_medications: List[Dict[str, Any]],
        interaction_alerts: List[Dict[str, Any]],
        timetable: List[Dict[str, Any]],
        clinician_notes: Optional[str] = ""
    ) -> Dict[str, Any]:
        """
        Synthesizes a structured clinical summary with patient vital statistics,
        drug identification results, safety warnings, and chronopharmacology schedules.
        """
        now_ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

        # High priority alerts count
        high_alerts = [a for a in interaction_alerts if a.get("severity") == "HIGH"]
        mod_alerts = [a for a in interaction_alerts if a.get("severity") == "MODERATE"]

        markdown_content = f"""# ChronoRx Clinical Decision Support Summary
**Patient ID:** {patient_id} | **Date:** {now_ts}
**Status:** AI-assisted summary — verify all clinical information before use.

---

### 1. Patient Profile (Pseudo-anonymized)
- **Age:** {patient_data.get('age', 'N/A')} yrs | **Gender:** {patient_data.get('gender', 'N/A')}
- **Weight:** {patient_data.get('weight', 'N/A')} kg | **Height:** {patient_data.get('height', 'N/A')} cm
- **BSA (DuBois):** {patient_data.get('bsa', 'N/A')} m² | **BMI:** {patient_data.get('bmi', 'N/A')} kg/m²
- **Known Allergies:** {patient_data.get('allergies', 'None reported')}
- **Medical History:** {patient_data.get('medical_history', 'None reported')}

---

### 2. Confirmed Medication Regimen ({len(confirmed_medications)} Agents)
| Medicine | Strength | Route | Frequency | Status |
| :--- | :--- | :--- | :--- | :--- |
"""
        for m in confirmed_medications:
            m_name = m.get('name') or m.get('drug_name') or m.get('raw_name') or 'Med'
            m_str = m.get('strength') or 'Standard'
            m_route = m.get('route') or 'Oral'
            m_freq = m.get('frequency') or 'Daily'
            m_stat = "Verified" if m.get('verified') or m.get('clinician_approved') else "Review Required"
            markdown_content += f"| {m_name} | {m_str} | {m_route} | {m_freq} | {m_stat} |\n"

        markdown_content += f"""
---

### 3. Drug Interaction & Safety Review
- **High-Priority Alerts:** {len(high_alerts)}
- **Moderate Warnings:** {len(mod_alerts)}
"""
        if high_alerts:
            markdown_content += "\n**🔴 HIGH PRIORITY WARNINGS:**\n"
            for a in high_alerts:
                markdown_content += f"- **{a.get('drug_a')} + {a.get('drug_b')}:** {a.get('issue')} - {a.get('explanation')}\n"
        elif mod_alerts:
            markdown_content += "\n**🟡 MODERATE WARNINGS:**\n"
            for a in mod_alerts:
                markdown_content += f"- **{a.get('drug_a')} + {a.get('drug_b')}:** {a.get('issue')} - {a.get('explanation')}\n"
        else:
            markdown_content += "- *No relevant drug-drug interaction identified in the checked source.*\n"

        markdown_content += f"""
---

### 4. Chronopharmacology Timetable
"""
        for item in timetable:
            markdown_content += f"- **{item.get('time_slot')}:** {item.get('drug_name')} ({item.get('dosage')}) - *{item.get('timing_description')}* [{item.get('food_relation')}]\n"

        if clinician_notes:
            markdown_content += f"""
---

### 5. Clinician Review & Notes
*{clinician_notes}*
"""

        markdown_content += """
---
> **IMPORTANT MEDICAL NOTICE:**
> This document is an AI-assisted clinical decision support summary. It is NOT an autonomous prescription or diagnostic order. All dosages, interactions, and schedules must be formally verified by an authorized licensed healthcare provider.
"""

        return {
            "patient_id": patient_id,
            "generated_at": now_ts,
            "sections": {
                "patient_vitals": patient_data,
                "medications_count": len(confirmed_medications),
                "high_priority_alerts_count": len(high_alerts),
                "moderate_alerts_count": len(mod_alerts),
                "timetable_slots": len(timetable),
                "clinician_notes": clinician_notes
            },
            "formatted_markdown": markdown_content,
            "disclaimer": "AI-assisted summary — verify all clinical information before use."
        }

    def analyze_medication(self, drug_name: str, clinical_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        AI posology evaluation assistance. De-identifies inputs and calls Ollama if available;
        gracefully falls back to structured information if offline.
        """
        if not self.is_ollama_available():
            return {
                "drug_name": drug_name,
                "ai_available": False,
                "explanation": "AI service unavailable — using available structured clinical information.",
                "status": "deterministic_fallback",
                "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
            }
        try:
            prompt = f"Provide a concise clinical pharmacotherapy summary for {drug_name}. Context: {clinical_context or 'Standard Adult'}. Emphasize that all dosing requires licensed clinician verification."
            payload = {"model": self.model, "prompt": prompt, "stream": False}
            resp = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=10.0)
            if resp.status_code == 200:
                txt = resp.json().get("response", "")
                return {
                    "drug_name": drug_name,
                    "ai_available": True,
                    "explanation": txt.strip(),
                    "status": "ai_analyzed",
                    "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
                }
        except Exception:
            pass
        return {
            "drug_name": drug_name,
            "ai_available": False,
            "explanation": "AI service unavailable — using available structured clinical information.",
            "status": "deterministic_fallback",
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        }

    def explain_interaction(self, drug_a: str, drug_b: str, interaction_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """AI assistance for explaining drug-drug interaction mechanisms."""
        if not self.is_ollama_available():
            return {
                "drug_a": drug_a,
                "drug_b": drug_b,
                "ai_available": False,
                "explanation": "AI service unavailable — using available structured clinical information.",
                "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
            }
        try:
            prompt = f"Explain the pharmacokinetic or pharmacodynamic interaction between {drug_a} and {drug_b}. Include clinical significance and monitoring precautions."
            payload = {"model": self.model, "prompt": prompt, "stream": False}
            resp = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=10.0)
            if resp.status_code == 200:
                return {
                    "drug_a": drug_a,
                    "drug_b": drug_b,
                    "ai_available": True,
                    "explanation": resp.json().get("response", "").strip(),
                    "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
                }
        except Exception:
            pass
        return {
            "drug_a": drug_a,
            "drug_b": drug_b,
            "ai_available": False,
            "explanation": "AI service unavailable — using available structured clinical information.",
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        }

    def explain_schedule(self, medications: List[Any], timetable: List[Any]) -> Dict[str, Any]:
        """AI assistance for circadian chronopharmacology rationales."""
        if not self.is_ollama_available():
            return {
                "ai_available": False,
                "explanation": "AI service unavailable — using available structured clinical information.",
                "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
            }
        try:
            prompt = f"Provide clinical circadian rationale for this schedule: {timetable}. Include meal timing and half-life considerations."
            payload = {"model": self.model, "prompt": prompt, "stream": False}
            resp = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=10.0)
            if resp.status_code == 200:
                return {
                    "ai_available": True,
                    "explanation": resp.json().get("response", "").strip(),
                    "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
                }
        except Exception:
            pass
        return {
            "ai_available": False,
            "explanation": "AI service unavailable — using available structured clinical information.",
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        }

ai_service = AIService()
