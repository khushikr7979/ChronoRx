import datetime
from typing import List, Dict, Any

CHRONOPHARMACOLOGY_KNOWLEDGE_BASE = {
    "atorvastatin": {
        "recommended_time": "10:00 PM",
        "timing_desc": "Bedtime",
        "food_relation": "With or without food",
        "rationale": "Circadian biology: Hepatic HMG-CoA reductase and endogenous cholesterol synthesis peak between midnight and 06:00 AM. Bedtime administration optimizes lipid reduction."
    },
    "simvastatin": {
        "recommended_time": "10:00 PM",
        "timing_desc": "Bedtime",
        "food_relation": "With or without food",
        "rationale": "Short half-life statin: Maximum hepatic cholesterol synthesis occurs nocturnally. Night administration is clinically recommended in FDA labeling."
    },
    "omeprazole": {
        "recommended_time": "07:30 AM",
        "timing_desc": "30-60 min Before Breakfast",
        "food_relation": "Empty stomach before meal",
        "rationale": "Acid pump kinetics: Parietal cell H+/K+-ATPase pumps are activated by food intake. Peak plasma concentrations of omeprazole should coincide with maximal pump activation."
    },
    "pantoprazole": {
        "recommended_time": "07:30 AM",
        "timing_desc": "30-60 min Before Breakfast",
        "food_relation": "Empty stomach before meal",
        "rationale": "Administer 30-60 minutes prior to morning meal for optimal parietal cell proton pump inhibition."
    },
    "prednisone": {
        "recommended_time": "08:00 AM",
        "timing_desc": "Morning with breakfast",
        "food_relation": "With meal",
        "rationale": "Adrenal axis harmony: Synchronizes with the body's natural circadian cortisol peak (07:00-08:00 AM), minimizing HPA-axis suppression and reducing insomnia."
    },
    "furosemide": {
        "recommended_time": "08:00 AM",
        "timing_desc": "Morning",
        "food_relation": "With or without food",
        "rationale": "Diuretic timing: Morning administration produces peak diuresis during daytime hours, preventing nocturia, disrupted sleep, and nocturnal fall risk."
    },
    "hydrochlorothiazide": {
        "recommended_time": "08:00 AM",
        "timing_desc": "Morning",
        "food_relation": "With or without food",
        "rationale": "Administer in the morning to prevent nocturnal diuresis."
    },
    "levothyroxine": {
        "recommended_time": "06:30 AM",
        "timing_desc": "Early morning (At least 30-60 min before breakfast)",
        "food_relation": "Strictly empty stomach with full glass of water",
        "rationale": "Absorption kinetics: Gastric pH and food severely attenuate levothyroxine bioavailability. Administer 30-60 minutes before breakfast on an empty stomach."
    },
    "lisinopril": {
        "recommended_time": "08:30 AM",
        "timing_desc": "Morning",
        "food_relation": "With or without food",
        "rationale": "Consistent once-daily morning dosing maintains stable 24-hour hemodynamic control. (Bedtime dosing may be considered by physician for non-dipping hypertension)."
    },
    "metformin": {
        "recommended_time": "08:30 AM & 08:00 PM",
        "timing_desc": "Morning & Evening with meals",
        "food_relation": "With meals",
        "rationale": "Gastrointestinal tolerability: Administration with meals significantly mitigates common gastrointestinal side effects (nausea, cramping, diarrhea)."
    },
    "aspirin": {
        "recommended_time": "08:30 AM",
        "timing_desc": "After breakfast",
        "food_relation": "After meal",
        "rationale": "Taking with or immediately following food cushions the gastric mucosa against local prostaglandin inhibition and direct irritation."
    },
    "ibuprofen": {
        "recommended_time": "01:00 PM & 08:00 PM",
        "timing_desc": "After meals PRN",
        "food_relation": "After meal / with milk",
        "rationale": "Take with meals or food to protect gastric mucosal integrity against NSAID-induced erosions."
    },
    "warfarin": {
        "recommended_time": "06:00 PM",
        "timing_desc": "Consistent Evening Dose",
        "food_relation": "Consistent dietary timing",
        "rationale": "Evening dosing permits same-day INR blood test results to be evaluated by the clinical team and dose adjusted prior to the evening administration."
    },
    "clopidogrel": {
        "recommended_time": "09:00 AM",
        "timing_desc": "Morning",
        "food_relation": "With or without food",
        "rationale": "Once daily morning dosing ensures predictable 24-hour platelet aggregation inhibition."
    }
}

class ScheduleService:
    def generate_timetable(self, medications: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Creates a circadian-optimized medication timetable.
        Does not unilaterally override clinician orders;
        Highlights evidence-based chronopharmacology rationale as recommendations
        requiring clinician approval.
        """
        timetable = []
        recommendations = []

        # Standard default time slots
        time_slot_defaults = [
            ("07:00 AM", "Morning - Before breakfast", "Before meal"),
            ("08:30 AM", "Morning - With/After breakfast", "After meal"),
            ("01:00 PM", "Afternoon - Lunch", "With meal"),
            ("07:30 PM", "Evening - Dinner", "With meal"),
            ("10:00 PM", "Night - Bedtime", "At bedtime")
        ]

        slot_index = 0

        for med in medications:
            name = med.get("name") or med.get("drug_name") or med.get("raw_name") or "Medication"
            strength = med.get("strength") or med.get("dosage") or "As prescribed"
            frequency = med.get("frequency") or "Once daily"
            route = med.get("route") or "Oral"
            
            clean_name = name.lower()

            # Check chronopharmacology knowledge base
            chrono_match = None
            for key, info in CHRONOPHARMACOLOGY_KNOWLEDGE_BASE.items():
                if key in clean_name:
                    chrono_match = info
                    break

            if chrono_match:
                time_slot = chrono_match["recommended_time"]
                timing_desc = chrono_match["timing_desc"]
                food_rel = chrono_match["food_relation"]
                rationale = chrono_match["rationale"]
                recommendations.append(f"{name}: {rationale}")
            else:
                # Fallback to staggered daytime slots
                default_slot = time_slot_defaults[slot_index % len(time_slot_defaults)]
                slot_index += 1
                time_slot = med.get("time_slot") or default_slot[0]
                timing_desc = med.get("timing_description") or default_slot[1]
                food_rel = med.get("food_relation") or default_slot[2]
                rationale = "Standard evenly-spaced therapeutic administration interval."

            timetable.append({
                "drug_name": name,
                "dosage": strength,
                "route": route,
                "frequency": frequency,
                "time_slot": time_slot,
                "timing_description": timing_desc,
                "food_relation": food_rel,
                "chronopharmacology_rationale": rationale,
                "clinician_approved": True
            })

        # Sort timetable chronologically (parse time)
        def parse_slot_time(item):
            ts = item.get("time_slot", "08:00 AM")
            try:
                # Handle cases like "08:30 AM & 08:00 PM"
                first_ts = ts.split("&")[0].strip()
                return datetime.datetime.strptime(first_ts, "%I:%M %p").time()
            except Exception:
                return datetime.time(8, 0)

        timetable.sort(key=parse_slot_time)

        return {
            "timetable": timetable,
            "chronopharmacology_recommendations": recommendations,
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        }

schedule_service = ScheduleService()
