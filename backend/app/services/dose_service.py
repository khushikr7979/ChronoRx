import math
from typing import Dict, Any, List, Optional
from app.services.rxnorm_service import rxnorm_service
from app.services.openfda_service import openfda_service

def calculate_dubois_bsa(weight_kg: float, height_cm: float) -> float:
    """
    DuBois & DuBois Body Surface Area Formula:
    BSA (m^2) = 0.007184 * (Weight_kg ^ 0.425) * (Height_cm ^ 0.725)
    """
    if weight_kg <= 0 or height_cm <= 0:
        return 0.0
    bsa = 0.007184 * math.pow(weight_kg, 0.425) * math.pow(height_cm, 0.725)
    return round(bsa, 2)

def calculate_mosteller_bsa(weight_kg: float, height_cm: float) -> float:
    """
    Mosteller Body Surface Area Formula:
    BSA (m^2) = sqrt((Height_cm * Weight_kg) / 3600)
    """
    if weight_kg <= 0 or height_cm <= 0:
        return 0.0
    bsa = math.sqrt((height_cm * weight_kg) / 3600.0)
    return round(bsa, 2)

def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    """Calculates Body Mass Index (kg/m^2)."""
    if weight_kg <= 0 or height_cm <= 0:
        return 0.0
    height_m = height_cm / 100.0
    return round(weight_kg / (height_m * height_m), 1)

class DoseService:
    def analyze_posology(
        self,
        drug_name: str,
        age: int,
        weight: float,
        height: float,
        strength: Optional[str] = None,
        route: Optional[str] = "Oral",
        frequency: Optional[str] = "Once daily",
        clinical_parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyzes medication dosing based on patient anthropometrics,
        normalized RxNorm identification, and official openFDA labeling.
        Refrains from unvalidated pediatric rules (e.g. Young's/Clark's rules)
        and explicitly labels results as mathematical calculations requiring clinician sign-off.
        """
        # 1. Calculate DuBois BSA and BMI
        dubois_bsa = calculate_dubois_bsa(weight, height)
        mosteller_bsa = calculate_mosteller_bsa(weight, height)
        bmi = calculate_bmi(weight, height)

        # 2. Drug Normalization
        norm_result = rxnorm_service.normalize_drug(drug_name)
        matched_name = norm_result["matched_name"]
        rxcui = norm_result.get("rxcui")

        # 3. Authoritative FDA Labeling Retrieval
        fda_info = openfda_service.get_drug_labeling(matched_name if norm_result["status"] == "identified" else drug_name)
        
        # 4. Clinical Warnings & Rule Evaluation
        warnings = []
        
        # Pediatric considerations
        if age < 18:
            warnings.append(
                f"Pediatric Alert (Age: {age} yrs): Universal formulas (Young's/Clark's Rule) are NOT valid substitutes for evidence-based pediatric dosing. Dosing must follow mg/kg or BSA-adjusted guidelines from official pediatric labeling."
            )
        elif age >= 65:
            warnings.append(
                f"Geriatric Alert (Age: {age} yrs): Evaluate renal clearance (Cockcroft-Gault CrCl) and start at the lower end of the recommended dosing range."
            )

        # Weight extremes
        if bmi > 30.0:
            warnings.append(f"Patient BMI ({bmi} kg/m² indicates Obesity): Consider whether ideal body weight (IBW) or adjusted body weight should be utilized for hydrophilic agents.")
        elif bmi < 18.5 and age >= 18:
            warnings.append(f"Patient BMI ({bmi} kg/m² indicates Underweight): Monitor for heightened sensitivity and potential drug accumulation.")

        # Specific drug warnings
        drug_lower = drug_name.lower()
        if "warfarin" in drug_lower:
            warnings.append("Narrow Therapeutic Index: Dosage must be titrated strictly against serial INR values. Avoid empirical dose increases.")
        elif "metformin" in drug_lower:
            warnings.append("Renal Clearance Warning: Contraindicated if eGFR < 30 mL/min/1.73 m²; dose reduction recommended if eGFR 30-44 mL/min/1.73 m².")
        elif "lisinopril" in drug_lower:
            warnings.append("Renal & Potassium Monitoring: Check serum potassium and creatinine within 1-2 weeks of initiation or dose escalation.")
        elif "atorvastatin" in drug_lower:
            warnings.append("Hepatic & Muscular Safety: Review baseline liver enzymes; instruct patient to immediately report unexplained muscle pain or brown urine.")

        calculation_details = (
            f"DuBois BSA: {dubois_bsa} m² (Formula: 0.007184 * Wt^0.425 * Ht^0.725) | "
            f"Mosteller BSA: {mosteller_bsa} m² | BMI: {bmi} kg/m²\n"
            f"Patient Weight: {weight} kg | Height: {height} cm | Age: {age} yrs\n"
            f"Note: Calculations are mathematical reference estimates. Universal pediatric formulas (Young's / Clark's rule) are clinically deprecated. Dosing must adhere to validated monograph specifications."
        )

        return {
            "drug": drug_name,
            "normalized_name": matched_name,
            "rxcui": rxcui,
            "available_strength": strength or "Standard Monograph Strength",
            "calculated_bsa": dubois_bsa,
            "bsa_formula": "DuBois & DuBois (1916)",
            "calculated_bmi": bmi,
            "reference_dosing_info": fda_info.get("dosage_and_administration", "Consult official clinical pharmacopeia."),
            "calculation_details": calculation_details,
            "warnings": warnings,
            "source": f"{norm_result.get('source')} + {fda_info.get('source')}",
            "verification_status": "Pending Clinician Review",
            "clinician_reviewed": False,
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        }

dose_service = DoseService()
