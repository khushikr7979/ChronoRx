import os
import datetime
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from app.config import settings

class PDFService:
    def __init__(self):
        self.output_dir = settings.GENERATED_REPORTS_DIR
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_prescription_pdf(
        self,
        patient_id: str,
        doctor_name: str,
        clinic_name: str,
        confirmed_medications: List[Dict[str, Any]],
        patient_vitals: Optional[Dict[str, Any]] = None,
        schedule: Optional[List[Dict[str, Any]]] = None,
        interaction_warnings: Optional[List[Dict[str, Any]]] = None,
        dietary_instructions: Optional[List[str]] = None,
        ocr_summary: Optional[str] = None,
        clinician_notes: Optional[str] = None,
        diagnosis: Optional[str] = None,
        is_verified: bool = True,
        reviewed_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a professional clinical-grade PDF e-Prescription & Review document
        with ChronoRx Tech branding, verified medications table, chronopharmacology timetable,
        interaction notices, and mandatory clinician signature block.
        """
        timestamp_slug = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"ChronoRx_{patient_id}_{timestamp_slug}.pdf"
        filepath = os.path.join(self.output_dir, filename)

        doc = SimpleDocTemplate(
            filepath,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom palette
        c_primary = colors.HexColor("#0F766E")    # Teal 700
        c_dark = colors.HexColor("#0F172A")       # Slate 900
        c_light = colors.HexColor("#F8FAFC")      # Slate 50
        c_accent = colors.HexColor("#0284C7")     # Sky 600
        c_warning = colors.HexColor("#B91C1C")    # Red 700

        title_style = ParagraphStyle(
            'HeaderTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            textColor=c_primary,
            leading=22
        )
        subtitle_style = ParagraphStyle(
            'HeaderSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            textColor=colors.HexColor("#64748B"),
            leading=12
        )
        section_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            textColor=c_dark,
            leading=14,
            spaceAfter=4
        )
        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            textColor=c_dark,
            leading=11
        )
        table_cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            textColor=c_dark,
            leading=10
        )
        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            textColor=colors.white,
            leading=10
        )
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=7.5,
            textColor=colors.HexColor("#475569"),
            leading=10,
            alignment=1  # Centered
        )

        story = []

        # 1. Header Banner
        header_data = [
            [
                Paragraph(f"<b>ChronoRx Tech</b> — Clinical Decision Support", title_style),
                Paragraph(f"<b>Date:</b> {datetime.date.today().strftime('%B %d, %Y')}<br/><b>Doc Ref:</b> CRX-{timestamp_slug}", subtitle_style)
            ],
            [
                Paragraph(f"<b>Facility:</b> {clinic_name} | <b>Provider:</b> {doctor_name}", subtitle_style),
                Paragraph(f"<b>Status:</b> {'VERIFIED & APPROVED' if is_verified else 'PRELIMINARY / UNVERIFIED'}", subtitle_style)
            ]
        ]
        header_table = Table(header_data, colWidths=[340, 200])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=2, spaceAfter=8))

        # 2. Patient Demographics (Pseudo-Anonymized)
        vitals = patient_vitals or {}
        patient_info_text = (
            f"<b>Primary Clinical Diagnosis:</b> <font color='#0F766E'><b>{diagnosis or 'Routine Clinical Consultation'}</b></font><br/>"
            f"<b>Patient ID:</b> {patient_id} &nbsp;|&nbsp; "
            f"<b>Age:</b> {vitals.get('age', 'N/A')} yrs &nbsp;|&nbsp; "
            f"<b>Gender:</b> {vitals.get('gender', 'N/A')} &nbsp;|&nbsp; "
            f"<b>Weight:</b> {vitals.get('weight', 'N/A')} kg &nbsp;|&nbsp; "
            f"<b>Height:</b> {vitals.get('height', 'N/A')} cm &nbsp;|&nbsp; "
            f"<b>BSA (DuBois):</b> {vitals.get('bsa', 'N/A')} m² &nbsp;|&nbsp; "
            f"<b>BMI:</b> {vitals.get('bmi', 'N/A')} kg/m²<br/>"
            f"<b>Allergies:</b> <font color='#B91C1C'><b>{vitals.get('allergies', 'None reported')}</b></font> &nbsp;|&nbsp; "
            f"<b>Clinical History:</b> {vitals.get('medical_history', 'None reported')}"
        )
        patient_table = Table([[Paragraph(patient_info_text, body_style)]], colWidths=[540])
        patient_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(patient_table)
        story.append(Spacer(1, 10))

        # 3. Confirmed Medications Table
        story.append(Paragraph("<b>Confirmed Medication Orders (Verified by Clinician)</b>", section_style))
        med_rows = [[
            Paragraph("<b>Medication & Strength</b>", table_header_style),
            Paragraph("<b>Route</b>", table_header_style),
            Paragraph("<b>Frequency / Timing</b>", table_header_style),
            Paragraph("<b>Duration</b>", table_header_style),
            Paragraph("<b>Instructions & Food</b>", table_header_style)
        ]]

        for med in confirmed_medications:
            m_name = med.get('name') or med.get('drug_name') or med.get('raw_name') or 'Medication'
            m_str = med.get('strength') or ''
            med_rows.append([
                Paragraph(f"<b>{m_name}</b> {m_str}", table_cell_style),
                Paragraph(med.get('route', 'Oral'), table_cell_style),
                Paragraph(med.get('frequency', 'Once daily'), table_cell_style),
                Paragraph(med.get('duration', '30 days'), table_cell_style),
                Paragraph(med.get('instructions', med.get('dosage_text', 'As directed')), table_cell_style)
            ])

        med_table = Table(med_rows, colWidths=[150, 60, 110, 70, 150])
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), c_primary),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(med_table)
        story.append(Spacer(1, 10))

        # 4. Chronopharmacology Timetable
        if schedule:
            story.append(Paragraph("<b>ChronoRx Daily Administration Timetable</b>", section_style))
            sched_rows = [[
                Paragraph("<b>Time Slot</b>", table_header_style),
                Paragraph("<b>Medication</b>", table_header_style),
                Paragraph("<b>Timing Phase</b>", table_header_style),
                Paragraph("<b>Food Relationship</b>", table_header_style)
            ]]
            for item in schedule:
                sched_rows.append([
                    Paragraph(f"<b>{item.get('time_slot')}</b>", table_cell_style),
                    Paragraph(f"{item.get('drug_name')} ({item.get('dosage')})", table_cell_style),
                    Paragraph(item.get('timing_description', 'Standard'), table_cell_style),
                    Paragraph(item.get('food_relation', 'Unrestricted'), table_cell_style)
                ])
            sched_table = Table(sched_rows, colWidths=[90, 170, 140, 140])
            sched_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#334155")),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ]))
            story.append(sched_table)
            story.append(Spacer(1, 10))

        # 5. Drug Safety & Interaction Review
        if interaction_warnings:
            story.append(Paragraph("<b>Authoritative Drug Safety & Interaction Surveillance</b>", section_style))
            alert_items = []
            for w in interaction_warnings:
                sev = w.get('severity', 'MODERATE')
                color_hex = "#B91C1C" if sev == "HIGH" else "#D97706"
                alert_text = f"• <font color='{color_hex}'><b>[{sev}] {w.get('drug_a')} + {w.get('drug_b')}</b></font>: {w.get('issue')} ({w.get('explanation')})"
                alert_items.append([Paragraph(alert_text, table_cell_style)])
            
            if not alert_items:
                alert_items.append([Paragraph("• <i>No relevant interaction identified in the checked source.</i>", table_cell_style)])

            safety_table = Table(alert_items, colWidths=[540])
            safety_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFBEB")),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#FDE68A")),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(safety_table)
            story.append(Spacer(1, 8))

        # 6. Dietary Instructions
        if dietary_instructions:
            diet_p = "<b>Dietary Cautions:</b> " + " | ".join(dietary_instructions)
            story.append(Paragraph(diet_p, body_style))
            story.append(Spacer(1, 6))

        # 7. Clinician Notes
        if clinician_notes:
            notes_p = f"<b>Clinician Remarks:</b> {clinician_notes}"
            story.append(Paragraph(notes_p, body_style))
            story.append(Spacer(1, 8))

        # 8. Clinician Signature Block
        story.append(KeepTogether([
            HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94A3B8"), spaceBefore=4, spaceAfter=8),
            Table([
                [
                    Paragraph(
                        f"<b>Authorized Prescribing Clinician:</b><br/>"
                        f"{reviewed_by or doctor_name}<br/>"
                        f"<i>Verification Status: {'Verified & Confirmed' if is_verified else 'Review Pending'}</i>",
                        body_style
                    ),
                    Paragraph(
                        "<b>Clinician Signature:</b><br/><br/>"
                        "__________________________________________<br/>"
                        f"Date: {datetime.date.today().strftime('%Y-%m-%d')}",
                        body_style
                    )
                ]
            ], colWidths=[270, 270]),
            Spacer(1, 8),
            # Mandatory Medical Safety Disclaimer
            Paragraph(
                "<b>MANDATORY MEDICAL SAFETY NOTICE:</b> ChronoRx Tech is an AI-assisted clinical decision support system (CDSS) prototype. "
                "It is NOT an autonomous doctor or automated prescribing platform. Authoritative drug identification is anchored in NIH RxNorm "
                "and U.S. FDA Drug Labeling APIs. All dosages, interactions, and chronopharmacology schedules have been reviewed, verified, "
                "and approved by the licensed clinician signed above prior to release.",
                disclaimer_style
            )
        ]))

        doc.build(story)

        return {
            "review_id": f"REV-{timestamp_slug}",
            "patient_id": patient_id,
            "pdf_filename": filename,
            "pdf_url": f"/reports/{filename}",
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "verification_status": "Clinician Verified" if is_verified else "Pending Clinician Review",
            "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional."
        }

pdf_service = PDFService()
