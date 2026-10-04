import os
from PIL import Image, ImageDraw, ImageFont

def generate_sample_prescription_image(output_path: str, title: str, doctor: str, patient_id: str, rx_lines: list):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img = Image.new("RGB", (900, 1150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([(20, 20), (880, 1130)], outline=(15, 118, 110), width=3)
    draw.rectangle([(25, 25), (875, 120)], fill=(240, 253, 250), outline=(204, 251, 241), width=1)
    
    # Text rendering (using default font to avoid missing font issues)
    draw.text((45, 40), f"CHRONORX HEALTH CLINIC - {title.upper()}", fill=(15, 118, 110))
    draw.text((45, 65), f"Physician: {doctor}  |  Reg: #MD-778219", fill=(51, 65, 85))
    draw.text((45, 90), "100 Medical Center Way, Suite 400 | Phone: (555) 019-8234", fill=(100, 116, 139))

    # Patient bar
    draw.rectangle([(40, 140), (860, 200)], fill=(241, 245, 249), outline=(203, 213, 225))
    draw.text((55, 155), f"Patient ID: {patient_id}    Age: 58    Sex: Male    Weight: 82 kg    Height: 178 cm", fill=(15, 23, 42))
    draw.text((55, 175), "Allergies: Penicillin (Rash)    Clinical Dx: Essential Hypertension, Dyslipidemia", fill=(185, 28, 28))

    # Rx Symbol & divider
    draw.text((50, 220), "Rx", fill=(15, 118, 110))
    draw.line([(40, 255), (860, 255)], fill=(148, 163, 184), width=1)

    # Medicines
    y = 280
    for i, line in enumerate(rx_lines, 1):
        draw.text((55, y), f"{i}. {line}", fill=(30, 41, 59))
        y += 55

    # Instructions
    y += 30
    draw.line([(40, y), (860, y)], fill=(203, 213, 225), width=1)
    y += 20
    draw.text((55, y), "CLINICAL INSTRUCTIONS & PRECAUTIONS:", fill=(15, 118, 110))
    y += 30
    draw.text((55, y), "- Avoid grapefruit juice with Atorvastatin.", fill=(71, 85, 105))
    y += 25
    draw.text((55, y), "- Take Lisinopril consistently in morning. Check BP log weekly.", fill=(71, 85, 105))
    y += 25
    draw.text((55, y), "- Take Aspirin with food. Report any bruising or dark stools immediately.", fill=(71, 85, 105))

    # Footer signature
    y = 980
    draw.line([(550, y), (840, y)], fill=(15, 23, 42), width=1)
    draw.text((550, y + 10), f"Signed: {doctor}", fill=(15, 23, 42))
    draw.text((550, y + 30), "Date: 2025-05-20", fill=(100, 116, 139))
    
    # Disclaimer
    draw.text((45, 1090), "Clinical Decision Support Prototype - Verified Clinician Authorization Required", fill=(148, 163, 184))

    img.save(output_path, "JPEG", quality=90)
    print(f"Generated sample prescription: {output_path}")

if __name__ == "__main__":
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "demo_assets")
    
    # Sample 1: Cardiology / Internal Medicine
    generate_sample_prescription_image(
        output_path=os.path.join(assets_dir, "sample_cardio_prescription.jpg"),
        title="Internal Medicine & Cardiology",
        doctor="Dr. Sarah Jenkins, M.D.",
        patient_id="DEMO-1001",
        rx_lines=[
            "Atorvastatin 20mg Tablet - 1 tab PO at bedtime (ONCE daily) x 30 days",
            "Lisinopril 10mg Tablet - 1 tab PO in the morning (ONCE daily) x 30 days",
            "Aspirin 81mg EC Tablet - 1 tab PO daily after breakfast x 30 days",
            "Metformin 500mg Tablet - 1 tab PO BID with morning and evening meals x 30 days"
        ]
    )

    # Sample 2: Complex interaction scenario (Warfarin + Clopidogrel + Omeprazole)
    generate_sample_prescription_image(
        output_path=os.path.join(assets_dir, "sample_interaction_prescription.jpg"),
        title="Anticoagulation & Vascular Service",
        doctor="Dr. Alexander Vance, M.D.",
        patient_id="DEMO-1002",
        rx_lines=[
            "Warfarin 5mg Tablet - 1 tab PO once daily at 6:00 PM x 30 days",
            "Clopidogrel 75mg Tablet - 1 tab PO once daily in morning x 30 days",
            "Omeprazole 20mg Capsule - 1 cap PO daily 30 minutes before breakfast x 30 days",
            "Amoxicillin 500mg Capsule - 1 cap PO TID x 7 days [FLAG: Check Allergy History]"
        ]
    )
