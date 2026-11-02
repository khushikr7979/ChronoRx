"""
ChronoRx Hospital Departments Service
Provides the canonical reference list of all 29 hospital departments
across 5 official clinical categories, with normalization, validation,
and case-insensitive multi-attribute search.
"""
from typing import List, Dict, Any, Optional, Tuple

HOSPITAL_DEPARTMENTS: List[Dict[str, Any]] = [
    # -------------------------------------------------------------------------
    # A. Primary & General Care (3 Departments)
    # -------------------------------------------------------------------------
    {
        "id": "general_medicine",
        "name": "General Medicine (Internal Medicine)",
        "category": "Primary & General Care",
        "category_id": "primary_general",
        "description": "Comprehensive primary care, chronic condition management, and diagnostic evaluation.",
        "keywords": ["general", "medicine", "internal", "physician", "primary", "fever", "hypertension", "diabetes", "adult care"],
    },
    {
        "id": "general_surgery",
        "name": "General Surgery",
        "category": "Primary & General Care",
        "category_id": "primary_general",
        "description": "Surgical procedures, abdominal surgery, wound management, and pre/post-operative care.",
        "keywords": ["surgery", "surgical", "operation", "appendix", "hernia", "gallbladder", "wound", "trauma repair"],
    },
    {
        "id": "family_medicine",
        "name": "Family Medicine",
        "category": "Primary & General Care",
        "category_id": "primary_general",
        "description": "Continuous, comprehensive healthcare for individuals and families across all ages.",
        "keywords": ["family", "community", "general practice", "gp", "holistic", "preventive", "all ages", "checkup"],
    },

    # -------------------------------------------------------------------------
    # B. Core Specialties (10 Departments)
    # -------------------------------------------------------------------------
    {
        "id": "pediatrics",
        "name": "Pediatrics (Child Care)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Medical care for infants, children, and adolescents, including immunization and growth monitoring.",
        "keywords": ["pediatrics", "pediatric", "child", "children", "baby", "infant", "newborn", "adolescent", "vaccination", "growth"],
    },
    {
        "id": "obstetrics_gynecology",
        "name": "Obstetrics & Gynecology (OB/GYN)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Pregnancy, childbirth, maternal-fetal medicine, and female reproductive health.",
        "keywords": ["obstetrics", "gynecology", "obgyn", "pregnancy", "maternity", "prenatal", "childbirth", "women", "fertility", "uterus"],
    },
    {
        "id": "orthopedics",
        "name": "Orthopedics (Bones & Joints)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Musculoskeletal conditions, bone fractures, joint replacements, and sports injuries.",
        "keywords": ["orthopedics", "orthopedic", "bones", "bone", "joints", "joint", "fracture", "spine", "arthritis", "ligament", "knee", "hip"],
    },
    {
        "id": "cardiology",
        "name": "Cardiology (Heart)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Disorders of the heart and blood vessels, coronary care, and chronotherapeutic cardiovascular management.",
        "keywords": ["cardiology", "cardiac", "heart", "cardiovascular", "hypertension", "bp", "ecg", "angina", "coronary", "arrhythmia", "chest pain"],
    },
    {
        "id": "neurology",
        "name": "Neurology (Brain & Nervous System)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Disorders of the central and peripheral nervous system, brain, spinal cord, and sleep cycles.",
        "keywords": ["neurology", "neurologist", "brain", "nervous system", "nerves", "stroke", "epilepsy", "seizure", "migraine", "headache", "parkinson"],
    },
    {
        "id": "oncology",
        "name": "Oncology (Cancer Care)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Diagnosis, staging, chemotherapy, and systemic therapies for benign and malignant neoplasms.",
        "keywords": ["oncology", "cancer", "tumor", "chemotherapy", "radiation", "malignant", "biopsy", "neoplasm", "carcinoma"],
    },
    {
        "id": "ophthalmology",
        "name": "Ophthalmology (Eye Care)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Comprehensive vision care, ocular surgery, cataracts, glaucoma, and retinal disorders.",
        "keywords": ["ophthalmology", "eye", "eyes", "vision", "cataract", "glaucoma", "retina", "cornea", "optometry", "sight"],
    },
    {
        "id": "ent",
        "name": "ENT (Otorhinolaryngology)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Conditions of the ear, nose, throat, sinuses, larynx, and related head and neck structures.",
        "keywords": ["ent", "ear", "nose", "throat", "otorhinolaryngology", "hearing", "tonsil", "sinus", "vertigo", "larynx", "tinnitus"],
    },
    {
        "id": "dermatology",
        "name": "Dermatology (Skin & Hair)",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Disorders of the skin, hair, nails, and mucous membranes, eczema, psoriasis, and cosmetic dermatology.",
        "keywords": ["dermatology", "skin", "hair", "nails", "rash", "eczema", "psoriasis", "acne", "allergy", "melanoma"],
    },
    {
        "id": "psychiatry_psychology",
        "name": "Psychiatry & Psychology",
        "category": "Core Specialties",
        "category_id": "core_specialties",
        "description": "Mental health, behavioral disorders, psychotherapy, cognitive evaluations, and psychopharmacology.",
        "keywords": ["psychiatry", "psychology", "mental health", "depression", "anxiety", "behavioral", "counseling", "stress", "bipolar", "therapy"],
    },

    # -------------------------------------------------------------------------
    # C. Super Specialties (7 Departments)
    # -------------------------------------------------------------------------
    {
        "id": "endocrinology",
        "name": "Endocrinology (Diabetes & Hormones)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Endocrine system disorders, diabetes mellitus, thyroid, pituitary, and metabolic regulation.",
        "keywords": ["endocrinology", "endocrine", "diabetes", "hormones", "hormone", "thyroid", "insulin", "metabolic", "adrenal", "pcos"],
    },
    {
        "id": "gastroenterology",
        "name": "Gastroenterology (Digestive System)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Diseases of the digestive tract, esophagus, stomach, intestines, liver, pancreas, and biliary system.",
        "keywords": ["gastroenterology", "gastro", "digestive", "stomach", "liver", "intestine", "gut", "colon", "endoscopy", "acid reflux", "gerd"],
    },
    {
        "id": "nephrology",
        "name": "Nephrology (Kidneys)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Renal physiology, acute kidney injury, chronic kidney disease (CKD), and hemodialysis management.",
        "keywords": ["nephrology", "kidney", "kidneys", "renal", "dialysis", "creatinine", "ckd", "filtration", "proteinuria"],
    },
    {
        "id": "urology",
        "name": "Urology (Urinary Tract)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Surgical and medical disorders of male and female urinary tract and male reproductive organs.",
        "keywords": ["urology", "urinary", "bladder", "prostate", "urine", "uti", "kidney stone", "calculus", "urethra"],
    },
    {
        "id": "pulmonology",
        "name": "Pulmonology (Lungs & Respiratory)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Diseases of the respiratory tract, lungs, asthma, COPD, pulmonary infections, and sleep apnea.",
        "keywords": ["pulmonology", "pulmonary", "lungs", "lung", "respiratory", "asthma", "copd", "breathing", "bronchitis", "pneumonia", "cough"],
    },
    {
        "id": "rheumatology",
        "name": "Rheumatology (Autoimmune & Joints)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Autoimmune and systemic inflammatory disorders, rheumatoid arthritis, lupus, and vasculitis.",
        "keywords": ["rheumatology", "rheumatic", "autoimmune", "joints", "rheumatoid", "arthritis", "lupus", "gout", "inflammation"],
    },
    {
        "id": "hematology",
        "name": "Hematology (Blood Disorders)",
        "category": "Super Specialties",
        "category_id": "super_specialties",
        "description": "Disorders of blood, bone marrow, coagulation cascade, anemia, leukemia, and lymphomas.",
        "keywords": ["hematology", "blood", "anemia", "platelets", "hemoglobin", "leukemia", "bleeding", "coagulation", "marrow"],
    },

    # -------------------------------------------------------------------------
    # D. Emergency & Critical Care (3 Departments)
    # -------------------------------------------------------------------------
    {
        "id": "emergency_medicine",
        "name": "Emergency Medicine (Casualty & Trauma)",
        "category": "Emergency & Critical Care",
        "category_id": "emergency_critical",
        "description": "Immediate acute resuscitation, trauma stabilization, casualty triage, and urgent interventions.",
        "keywords": ["emergency", "casualty", "trauma", "urgent", "er", "ambulance", "acute", "triage", "accident", "first aid"],
    },
    {
        "id": "icu_critical_care",
        "name": "ICU / Critical Care",
        "category": "Emergency & Critical Care",
        "category_id": "emergency_critical",
        "description": "Intensive monitoring and organ support for critically ill patients requiring continuous life support.",
        "keywords": ["icu", "critical care", "intensive care", "ventilator", "life support", "sepsis", "monitoring", "ccu"],
    },
    {
        "id": "anesthesiology",
        "name": "Anesthesiology",
        "category": "Emergency & Critical Care",
        "category_id": "emergency_critical",
        "description": "Perioperative surgical anesthesia, sedation, pain management, and acute post-op recovery.",
        "keywords": ["anesthesiology", "anesthesia", "sedation", "pain management", "perioperative", "epidural", "narcotic", "local anaesthesia"],
    },

    # -------------------------------------------------------------------------
    # E. Allied & Diagnostic Departments (6 Departments)
    # -------------------------------------------------------------------------
    {
        "id": "radiology_imaging",
        "name": "Radiology & Imaging (X-Ray, MRI, CT Scan)",
        "category": "Allied & Diagnostic Departments",
        "category_id": "allied_diagnostic",
        "description": "Diagnostic medical imaging, digital radiography, computed tomography, magnetic resonance, and ultrasound.",
        "keywords": ["radiology", "imaging", "x-ray", "mri", "ct scan", "ultrasound", "scan", "radiography", "sonography", "mammography"],
    },
    {
        "id": "pathology_laboratory",
        "name": "Pathology & Laboratory (Blood Tests)",
        "category": "Allied & Diagnostic Departments",
        "category_id": "allied_diagnostic",
        "description": "Clinical biochemistry, hematological testing, microbiology culture, histopathology, and cytology.",
        "keywords": ["pathology", "laboratory", "lab", "blood tests", "blood test", "biopsy", "microbiology", "specimen", "serology"],
    },
    {
        "id": "clinical_pharmacy",
        "name": "Clinical Pharmacy",
        "category": "Allied & Diagnostic Departments",
        "category_id": "allied_diagnostic",
        "description": "Pharmacotherapeutic optimization, drug interaction screening, chronopharmacology, and dispensing.",
        "keywords": ["pharmacy", "pharmacist", "clinical pharmacy", "medication", "dispensing", "posology", "drug interaction", "formulation"],
    },
    {
        "id": "physiotherapy_rehab",
        "name": "Physiotherapy & Rehabilitation",
        "category": "Allied & Diagnostic Departments",
        "category_id": "allied_diagnostic",
        "description": "Physical therapy, functional restoration, post-injury mobilization, and rehabilitation.",
        "keywords": ["physiotherapy", "rehabilitation", "physical therapy", "exercise", "rehab", "mobility", "posture", "injury recovery"],
    },
    {
        "id": "dentistry_dental_surgery",
        "name": "Dentistry / Dental Surgery",
        "category": "Allied & Diagnostic Departments",
        "category_id": "allied_diagnostic",
        "description": "Oral health, dental surgery, maxillofacial evaluations, restorative dentistry, and periodontal care.",
        "keywords": ["dentistry", "dental", "teeth", "tooth", "oral", "dentist", "caries", "extraction", "root canal", "gums"],
    },
    {
        "id": "dietetics_nutrition",
        "name": "Dietetics & Nutrition",
        "category": "Allied & Diagnostic Departments",
        "category_id": "allied_diagnostic",
        "description": "Clinical dietary counseling, medical nutrition therapy, caloric planning, and metabolic support.",
        "keywords": ["dietetics", "nutrition", "diet", "nutritionist", "dietitian", "calories", "metabolism", "weight management", "meal plan"],
    },
]

# Quick lookup indexes
_DEPT_BY_ID: Dict[str, Dict[str, Any]] = {d["id"]: d for d in HOSPITAL_DEPARTMENTS}
_DEPT_BY_NAME: Dict[str, Dict[str, Any]] = {d["name"].lower(): d for d in HOSPITAL_DEPARTMENTS}

# Legacy names mapping to canonical names
_LEGACY_MAPPING: Dict[str, str] = {
    "internal medicine & chronopharmacology": "General Medicine (Internal Medicine)",
    "cardiology & chronotherapy": "Cardiology (Heart)",
    "neurology & sleep medicine": "Neurology (Brain & Nervous System)",
    "clinical oncology": "Oncology (Cancer Care)",
    "general medicine": "General Medicine (Internal Medicine)",
    "internal medicine": "General Medicine (Internal Medicine)",
    "pediatrics": "Pediatrics (Child Care)",
    "obstetrics & gynecology": "Obstetrics & Gynecology (OB/GYN)",
    "ob/gyn": "Obstetrics & Gynecology (OB/GYN)",
    "orthopedics": "Orthopedics (Bones & Joints)",
    "cardiology": "Cardiology (Heart)",
    "neurology": "Neurology (Brain & Nervous System)",
    "oncology": "Oncology (Cancer Care)",
    "ophthalmology": "Ophthalmology (Eye Care)",
    "ent": "ENT (Otorhinolaryngology)",
    "dermatology": "Dermatology (Skin & Hair)",
    "psychiatry": "Psychiatry & Psychology",
    "endocrinology": "Endocrinology (Diabetes & Hormones)",
    "gastroenterology": "Gastroenterology (Digestive System)",
    "nephrology": "Nephrology (Kidneys)",
    "urology": "Urology (Urinary Tract)",
    "pulmonology": "Pulmonology (Lungs & Respiratory)",
    "rheumatology": "Rheumatology (Autoimmune & Joints)",
    "hematology": "Hematology (Blood Disorders)",
    "emergency medicine": "Emergency Medicine (Casualty & Trauma)",
    "icu": "ICU / Critical Care",
    "critical care": "ICU / Critical Care",
    "anesthesiology": "Anesthesiology",
    "radiology": "Radiology & Imaging (X-Ray, MRI, CT Scan)",
    "pathology": "Pathology & Laboratory (Blood Tests)",
    "pharmacy": "Clinical Pharmacy",
    "physiotherapy": "Physiotherapy & Rehabilitation",
    "dentistry": "Dentistry / Dental Surgery",
    "dietetics": "Dietetics & Nutrition",
}

DEPARTMENT_CATEGORIES: List[str] = [
    "Primary & General Care",
    "Core Specialties",
    "Super Specialties",
    "Emergency & Critical Care",
    "Allied & Diagnostic Departments",
]


def get_all_departments() -> List[Dict[str, Any]]:
    """Returns all 29 official hospital departments."""
    return HOSPITAL_DEPARTMENTS


def get_department_by_id(dept_id: str) -> Optional[Dict[str, Any]]:
    """Looks up department by its stable ID."""
    if not dept_id:
        return None
    return _DEPT_BY_ID.get(dept_id.strip().lower())


def get_department_categories() -> List[Dict[str, Any]]:
    """Returns the 5 department categories with counts."""
    grouped = {}
    for cat in DEPARTMENT_CATEGORIES:
        grouped[cat] = []
    for d in HOSPITAL_DEPARTMENTS:
        cat = d["category"]
        grouped.setdefault(cat, []).append(d)
    return [
        {
            "category": cat,
            "count": len(grouped[cat]),
            "departments": grouped[cat]
        }
        for cat in DEPARTMENT_CATEGORIES
    ]


def normalize_department(dept_input: Optional[str]) -> Optional[str]:
    """
    Normalizes a department string (whether slug ID, exact display name,
    or legacy variant) to its canonical full display name.
    Returns None if empty or invalid.
    """
    if not dept_input or not str(dept_input).strip():
        return None
    raw = str(dept_input).strip()
    raw_lower = raw.lower()

    # 1. Exact ID match
    if raw_lower in _DEPT_BY_ID:
        return _DEPT_BY_ID[raw_lower]["name"]

    # 2. Exact Name match
    if raw_lower in _DEPT_BY_NAME:
        return _DEPT_BY_NAME[raw_lower]["name"]

    # 3. Legacy / alias match
    if raw_lower in _LEGACY_MAPPING:
        return _LEGACY_MAPPING[raw_lower]

    # 4. Partial prefix match on known names
    for name_lower, dept in _DEPT_BY_NAME.items():
        if raw_lower == name_lower or raw_lower in name_lower or name_lower.startswith(raw_lower):
            return dept["name"]

    return None


def validate_department(dept_input: Optional[str]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validates that a department value belongs to the approved list of 29 departments.
    Returns (is_valid, normalized_name, department_dict).
    """
    if not dept_input or not str(dept_input).strip():
        return False, None, None
    canonical_name = normalize_department(dept_input)
    if not canonical_name:
        return False, None, None
    dept_obj = _DEPT_BY_NAME.get(canonical_name.lower())
    return True, canonical_name, dept_obj


def search_departments(query: str = "", category: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Performs case-insensitive search across name, category, and keywords.
    Example: searching 'heart' returns Cardiology (Heart).
    """
    q = (query or "").strip().lower()
    cat_filter = (category or "").strip().lower()

    results = []
    for d in HOSPITAL_DEPARTMENTS:
        # Category filter
        if cat_filter and d["category"].lower() != cat_filter and d["category_id"] != cat_filter:
            continue

        if not q:
            results.append(d)
            continue

        # Check match in name, category, or keywords
        name_lower = d["name"].lower()
        id_lower = d["id"].lower()
        cat_lower = d["category"].lower()

        # Tokenize name words
        name_words = [w.strip("(),/-") for w in name_lower.split() if w.strip("(),/-")]

        if len(q) <= 3:
            # For short queries (<=3 chars like 'ear', 'ent', 'icu', 'eye'), require word boundary or start of word
            name_match = any(w.startswith(q) for w in name_words) or (q == id_lower)
            cat_match = any(w.startswith(q) for w in cat_lower.split())
            keyword_match = any(kw.lower() == q or kw.lower().startswith(q) for kw in d.get("keywords", []))
        else:
            name_match = q in name_lower
            id_match = q in id_lower
            cat_match = q in cat_lower
            keyword_match = any(q in kw.lower() or kw.lower().startswith(q) for kw in d.get("keywords", []))

        if name_match or (len(q) > 3 and id_match) or cat_match or keyword_match:
            results.append(d)

    return results
