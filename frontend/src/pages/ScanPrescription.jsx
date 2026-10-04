import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanAPI, medicationAPI, patientAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import CameraCaptureModal from '../components/CameraCaptureModal';
import {
  Camera,
  Upload,
  FileText,
  AlertCircle,
  Sparkles,
  Sliders,
  RotateCw,
  Eye,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Trash2,
  Plus,
  Edit3,
  AlertTriangle,
  Check,
  X,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const ScanPrescription = () => {
  const navigate = useNavigate();
  const {
    selectedPatient,
    setSelectedPatient,
    patientsList,
    refreshPatients,
    setActiveScan,
    setCurrentMedicines,
    setDiagnosis,
    setClinicianNotes
  } = usePatient();

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0); // 0: idle, 1: upload, 2: preprocess, 3: ocr, 4: extract, 5: normalize, 6: done
  const [errorDetails, setErrorDetails] = useState(null); // { stage, message, technical }

  // Image Preprocessing controls
  const [rotation, setRotation] = useState(0);
  const [enhanceContrast, setEnhanceContrast] = useState(true);
  const [denoise, setDenoise] = useState(true);

  // Extracted Result State (In-place Review)
  const [extractedResult, setExtractedResult] = useState(null);
  const [editableText, setEditableText] = useState('');
  const [editableMedicines, setEditableMedicines] = useState([]);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', strength: '', frequency: 'Once daily', route: 'Oral', duration: '30 days' });
  const [patientMismatch, setPatientMismatch] = useState(null); // { hasMismatch, selectedPatient, detectedPatient, isConfirmed }
  const [isClinicianVerified, setIsClinicianVerified] = useState(false); // Clinician Safety Gate


  // Auto-resolve patient if not selected
  useEffect(() => {
    if (!selectedPatient && patientsList && patientsList.length > 0) {
      setSelectedPatient(patientsList[0]);
    }
  }, [patientsList, selectedPatient, setSelectedPatient]);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    const found = patientsList.find((p) => p.patient_id === pId);
    if (found) {
      setSelectedPatient(found);
    }
  };

  const processSelectedFile = (file) => {
    setErrorDetails(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setExtractedResult(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleCameraCaptureConfirm = (file, dataUrl) => {
    setErrorDetails(null);
    setSelectedFile(file);
    setPreviewUrl(dataUrl);
    setExtractedResult(null);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Main Pipeline Execution: Frontend -> API -> Backend -> OCR -> AI Extraction -> Result
  const handleUploadAndRunOCR = async () => {
    if (!selectedFile) {
      setErrorDetails({
        stage: 'File Selection',
        message: 'Please capture an image or select a prescription file first.',
        technical: 'No file provided'
      });
      return;
    }

    // Determine target patient (fallback safely to first patient or P-1001)
    let targetPatient = selectedPatient;
    if (!targetPatient) {
      if (patientsList && patientsList.length > 0) {
        targetPatient = patientsList[0];
        setSelectedPatient(targetPatient);
      } else {
        targetPatient = {
          patient_id: 'P-1001',
          name: 'Demo Patient',
          age: 58,
          weight: 82,
          gender: 'Male',
          allergies: 'None recorded'
        };
        setSelectedPatient(targetPatient);
      }
    }

    setUploading(true);
    setErrorDetails(null);
    setCurrentStage(1);

    try {
      // Stage 1: Upload File
      console.log(`[ChronoRx OCR] Stage 1: Uploading file '${selectedFile.name}' for patient '${targetPatient.patient_id}'...`);
      const uploadRes = await scanAPI.upload(selectedFile, selectedFile.name, targetPatient.patient_id);
      console.log(`[ChronoRx OCR] Upload successful. Scan ID: ${uploadRes.scan_id}`);

      // Stage 2 & 3: Run OCR with Preprocessing Options
      setCurrentStage(3);
      console.log(`[ChronoRx OCR] Stage 2/3: Executing OCR (rotate: ${rotation}°, contrast: ${enhanceContrast}, denoise: ${denoise})...`);
      const ocrRes = await scanAPI.runOCR(uploadRes.scan_id, {
        rotate_deg: rotation,
        enhance_contrast: enhanceContrast,
        denoise: denoise,
      });
      console.log(`[ChronoRx OCR] OCR successful. Engine: ${ocrRes.source_engine}, Confidence: ${ocrRes.confidence_score}`);

      // Stage 4 & 5: AI Structured Extraction & Drug Normalization
      setCurrentStage(4);
      console.log(`[ChronoRx OCR] Stage 4: Extracting structured medication and clinical data...`);
      const extractRes = await scanAPI.extract(
        uploadRes.scan_id,
        targetPatient.patient_id,
        ocrRes.raw_text
      );
      console.log(`[ChronoRx OCR] Extraction successful. Medicines detected: ${extractRes.medicines?.length || 0}`);

      setCurrentStage(6); // Done

      // Save to active workflow state
      const scanPayload = {
        scan_id: uploadRes.scan_id,
        patient_id: targetPatient.patient_id,
        file_url: uploadRes.file_url,
        raw_text: ocrRes.raw_text,
        confidence_score: ocrRes.confidence_score,
        engine: ocrRes.source_engine,
        structured_data: extractRes,
      };
      setActiveScan(scanPayload);

      // Populate local review state
      setExtractedResult({
        ...scanPayload,
        ...extractRes
      });
      setEditableText(ocrRes.raw_text);
      
      const meds = (extractRes.medicines || []).map((m, idx) => ({
        id: `med-${Date.now()}-${idx}`,
        name: m.normalized_name || m.raw_name || 'Unknown Medication',
        raw_name: m.raw_name,
        strength: m.strength || '',
        frequency: m.frequency || 'Once daily',
        route: m.route || 'Oral',
        duration: m.duration || '30 days',
        rxcui: m.rxcui,
        needs_manual_review: m.needs_manual_review
      }));
      setEditableMedicines(meds);
      setCurrentMedicines(meds);

      // Detect Patient Demographic Mismatch between Selected Patient and OCR Document
      const ocrPatId = extractRes.patient_id_if_visible || 
        ocrRes.raw_text.match(/patient\s*id\s*[:=-]?\s*([A-Za-z0-9\-]+)/i)?.[1]?.trim();
      const ocrAge = extractRes.patient_age_if_visible || 
        ocrRes.raw_text.match(/\bage\s*[:=-]?\s*(\d+)/i)?.[1];
      const ocrWt = extractRes.patient_weight_if_visible || 
        ocrRes.raw_text.match(/(?:wt|weight)\s*[:=-]?\s*(\d+(?:\.\d+)?\s*(?:kg|lbs?)?)/i)?.[1];

      if (ocrPatId && targetPatient.patient_id && ocrPatId.toUpperCase() !== targetPatient.patient_id.toUpperCase()) {
        console.warn(`[ChronoRx] Patient Mismatch Detected: Selected='${targetPatient.patient_id}' vs OCR='${ocrPatId}'`);
        setPatientMismatch({
          hasMismatch: true,
          selectedPatient: targetPatient,
          detectedPatient: {
            patient_id: ocrPatId,
            age: ocrAge || '45',
            weight: ocrWt || '75 kg'
          },
          isConfirmed: false
        });
      } else {
        setPatientMismatch(null);
      }
      setIsClinicianVerified(false);

    } catch (err) {
      console.error("[ChronoRx OCR Pipeline Error]:", err);
      const stageName = currentStage === 1 ? 'Image Upload' : currentStage === 3 ? 'OCR Text Extraction' : 'Structured Extraction';
      const detailMsg = err.response?.data?.detail || err.message || 'Failed to process prescription image.';
      
      setErrorDetails({
        stage: stageName,
        message: `OCR Processing Failed at ${stageName}. ${detailMsg}`,
        technical: JSON.stringify(err.response?.data || err.message)
      });
    } finally {
      setUploading(false);
    }
  };

  // Re-run extraction if doctor modifies the raw OCR text
  const handleReExtractFromEditedText = async () => {
    if (!editableText.trim()) return;
    setUploading(true);
    setCurrentStage(4);
    try {
      const scanId = extractedResult?.scan_id || 'SCAN-EDITED';
      const pId = selectedPatient?.patient_id || 'P-1001';
      const extractRes = await scanAPI.extract(scanId, pId, editableText);
      
      const meds = (extractRes.medicines || []).map((m, idx) => ({
        id: `med-${Date.now()}-${idx}`,
        name: m.normalized_name || m.raw_name,
        raw_name: m.raw_name,
        strength: m.strength || '',
        frequency: m.frequency || 'Once daily',
        route: m.route || 'Oral',
        duration: m.duration || '30 days',
        rxcui: m.rxcui,
        needs_manual_review: m.needs_manual_review
      }));
      setEditableMedicines(meds);
      setCurrentMedicines(meds);
      setCurrentStage(6);
    } catch (err) {
      console.error("Re-extraction error:", err);
      setErrorDetails({
        stage: 'Structured Re-Extraction',
        message: err.response?.data?.detail || 'Failed to extract from edited text.',
        technical: String(err)
      });
    } finally {
      setUploading(false);
    }
  };

  // Medication list adjustments by Doctor (Doctor Review)
  const handleRemoveMedication = (id) => {
    setEditableMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddMedication = () => {
    if (!newMed.name.trim()) return;
    const added = {
      id: `med-${Date.now()}`,
      name: newMed.name.trim(),
      raw_name: newMed.name.trim(),
      strength: newMed.strength.trim(),
      frequency: newMed.frequency,
      route: newMed.route,
      duration: newMed.duration,
      needs_manual_review: false
    };
    setEditableMedicines((prev) => [...prev, added]);
    setNewMed({ name: '', strength: '', frequency: 'Once daily', route: 'Oral', duration: '30 days' });
    setIsAddingMed(false);
  };

  // Confirm and proceed to Doctor Consultation / Clinical Analysis
  const handleConfirmAndProceedToConsultation = async () => {
    try {
      // 1. Sync confirmed medicines to context
      setCurrentMedicines(editableMedicines);

      // 2. Persist medications to backend for this patient
      const pId = selectedPatient?.patient_id || 'P-1001';
      for (const m of editableMedicines) {
        try {
          await medicationAPI.create({
            patient_id: pId,
            name: m.name,
            generic_name: m.name,
            strength: m.strength || 'Standard',
            route: m.route || 'Oral',
            frequency: m.frequency || 'Once daily',
            duration: m.duration || '30 days',
            instructions: `Extracted from prescription scan ${extractedResult?.scan_id || ''}`
          });
        } catch (saveErr) {
          console.warn("Medication already persisted or saved:", saveErr);
        }
      }

      // 3. Navigate to Consultation
      navigate('/consultation');
    } catch (err) {
      console.error("Failed to transition to consultation:", err);
      navigate('/consultation');
    }
  };

  // Quick Demo Prescriptions generator
  const loadDemoPrescription = async (type) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 1150;
      const ctx = canvas.getContext('2d');

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw clinic border
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 860, 1110);

      // Header background
      ctx.fillStyle = '#f0fdfa';
      ctx.fillRect(25, 25, 850, 100);

      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`CHRONORX HEALTH CLINIC - ${type.toUpperCase()}`, 45, 65);

      ctx.fillStyle = '#334155';
      ctx.font = '14px sans-serif';
      ctx.fillText('Dr. Sarah Jenkins, M.D. | Reg #MD-88421 | Cardiology & Internal Medicine', 45, 95);

      // Demographics Box
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(40, 140, 820, 65);
      ctx.fillStyle = '#0f172a';
      ctx.font = '14px sans-serif';
      const patId = selectedPatient?.patient_id || 'P-1001';
      ctx.fillText(`Patient ID: ${patId} | Age: ${selectedPatient?.age || 58}y | Wt: ${selectedPatient?.weight || 82}kg`, 55, 165);
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(`Allergies: ${selectedPatient?.allergies || 'Penicillin (mild urticaria)'}`, 55, 190);

      // Rx
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 28px serif';
      ctx.fillText('Rx', 50, 245);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 260);
      ctx.lineTo(850, 260);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.font = '15px sans-serif';

      if (type === 'cardiology') {
        ctx.fillText('1. Atorvastatin 20mg Tablet - 1 tab PO at bedtime (ONCE daily at night) x 30 days', 50, 310);
        ctx.fillText('2. Lisinopril 10mg Tablet - 1 tab PO in the morning (ONCE daily) x 30 days', 50, 355);
        ctx.fillText('3. Aspirin 81mg EC Tablet - 1 tab PO after breakfast x 30 days', 50, 400);
        ctx.fillText('4. Metformin 500mg Tablet - 1 tab PO BID with meals x 30 days', 50, 445);
        ctx.fillStyle = '#475569';
        ctx.font = 'italic 13px sans-serif';
        ctx.fillText('Instructions: Avoid grapefruit juice with Atorvastatin. Log BP weekly.', 50, 500);
      } else {
        ctx.fillText('1. Warfarin 5mg Tablet - 1 tab PO at 6:00 PM once daily x 30 days', 50, 310);
        ctx.fillText('2. Clopidogrel 75mg Tablet - 1 tab PO once daily with breakfast x 30 days', 50, 355);
        ctx.fillText('3. Omeprazole 20mg Capsule - 1 cap PO 30 mins before breakfast x 30 days', 50, 400);
        ctx.fillText('4. Atorvastatin 40mg Tablet - 1 tab PO at bedtime x 30 days', 50, 445);
        ctx.fillStyle = '#b91c1c';
        ctx.font = 'italic 13px sans-serif';
        ctx.fillText('Instructions: Strict INR monitoring every 2 weeks. Avoid high Vitamin K dietary swings.', 50, 500);
      }

      ctx.fillStyle = '#334155';
      ctx.font = '14px sans-serif';
      ctx.fillText('Clinical Diagnosis: Essential Hypertension & Dyslipidemia', 50, 600);
      ctx.fillText('Refills: 2 | Date: 2026-10-02', 50, 640);

      ctx.strokeStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(550, 950);
      ctx.lineTo(840, 950);
      ctx.stroke();
      ctx.fillText('Signature: Dr. Sarah Jenkins, M.D.', 550, 975);

      canvas.toBlob((blob) => {
        const file = new File([blob], `demo_${type}_prescription.jpg`, { type: 'image/jpeg' });
        processSelectedFile(file);
      }, 'image/jpeg');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-6 h-6 text-teal-600" />
            Scan Prescription / Medical Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-Assisted Optical Character Recognition (OCR), entity extraction, and clinical review pipeline.
          </p>
        </div>

        {/* Quick Demo Loaders */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Load sample:</span>
          <button
            onClick={() => loadDemoPrescription('cardiology')}
            className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
          >
            <span>🫀</span> Cardiology Rx
          </button>
          <button
            onClick={() => loadDemoPrescription('anticoagulant')}
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-semibold transition flex items-center gap-1.5"
          >
            <span>🩸</span> Anticoagulant Rx
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorDetails && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600" />
              OCR Processing Failed at {errorDetails.stage}
            </div>
            <button
              onClick={() => setErrorDetails(null)}
              className="text-red-500 hover:text-red-700 text-xs font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-red-700">{errorDetails.message}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleUploadAndRunOCR}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold shadow flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry OCR & Text Extraction
            </button>
            {errorDetails.technical && (
              <span className="text-[11px] text-red-600/80 font-mono truncate max-w-md">
                {errorDetails.technical}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dual Input Panels: Camera & File Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel A: Live Camera Capture */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:border-teal-300 transition">
          <div>
            <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center mb-4">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">A. Camera Scan</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Launch device camera or webcam. Position physical prescription within the viewfinder, capture, preview, and confirm.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center justify-center gap-2 transition"
            >
              <Camera className="w-4 h-4" />
              Open Camera Viewfinder
            </button>
          </div>
        </div>

        {/* Panel B: File Upload */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:border-teal-300 transition">
          <div>
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-4">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">B. File Upload</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload prescription images or clinical reports from local files. Supports JPG, PNG, WEBP, and PDF.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <label className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center justify-center gap-2 transition cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Choose Image / Document</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Selected Image Preview & Preprocessing Options */}
      {previewUrl && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Prescription Preview & Image Preprocessing Pipeline
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {selectedFile?.name} ({Math.round((selectedFile?.size || 0) / 1024)} KB)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Image Preview Window */}
            <div className="md:col-span-2 bg-slate-950 rounded-xl p-3 flex items-center justify-center min-h-[360px] overflow-hidden">
              <img
                src={previewUrl}
                alt="Selected Prescription"
                style={{ transform: `rotate(${rotation}deg)` }}
                className="max-h-[460px] w-auto object-contain transition-transform duration-200 rounded"
              />
            </div>

            {/* Preprocessing Settings Panel */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-teal-600" />
                OCR Preprocessing Filters
              </div>

              {/* Patient Selection Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Target Patient / Subject:
                </label>
                <select
                  value={selectedPatient?.patient_id || ''}
                  onChange={handlePatientSelect}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500"
                >
                  {patientsList && patientsList.length > 0 ? (
                    patientsList.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.patient_id} — {p.name || 'Patient'} ({p.age}y, {p.weight}kg)
                      </option>
                    ))
                  ) : (
                    <option value="P-1001">P-1001 — Demo Patient (58y, 82kg)</option>
                  )}
                </select>
              </div>

              <div className="space-y-3 text-xs text-slate-700 pt-2 border-t border-slate-200">
                <div>
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-slate-100 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate 90° (Current: {rotation}°)
                  </button>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhanceContrast}
                    onChange={(e) => setEnhanceContrast(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Enhance contrast & grayscale</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={denoise}
                    onChange={(e) => setDenoise(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Median filter noise reduction</span>
                </label>
              </div>

              {/* Progress Checklist when executing */}
              {uploading && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg space-y-1.5 text-[11px] text-teal-900">
                  <div className="font-bold flex items-center gap-1.5 text-teal-800">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Processing prescription pipeline...
                  </div>
                  <div className="flex items-center gap-1.5">
                    {currentStage >= 1 ? <Check className="w-3 h-3 text-teal-600" /> : <span className="w-3 h-3 text-slate-400">○</span>}
                    <span className={currentStage >= 1 ? "font-semibold" : "text-slate-500"}>Image upload</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {currentStage >= 3 ? <Check className="w-3 h-3 text-teal-600" /> : <span className="w-3 h-3 text-slate-400">○</span>}
                    <span className={currentStage >= 3 ? "font-semibold" : "text-slate-500"}>Preprocessing filters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {currentStage >= 4 ? <Check className="w-3 h-3 text-teal-600" /> : <span className="w-3 h-3 text-slate-400">○</span>}
                    <span className={currentStage >= 4 ? "font-semibold" : "text-slate-500"}>OCR text extraction</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {currentStage >= 6 ? <Check className="w-3 h-3 text-teal-600" /> : <span className="w-3 h-3 text-slate-400">○</span>}
                    <span className={currentStage >= 6 ? "font-semibold" : "text-slate-500"}>Medication & RxNorm extraction</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleUploadAndRunOCR}
                  disabled={uploading}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center justify-center gap-2 transition"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing prescription...
                    </>
                  ) : (
                    <>
                      Execute OCR & Text Extraction
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* OCR / TEXT EXTRACTION RESULT SECTION                     */}
      {/* ======================================================== */}
      {extractedResult && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-md p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[11px] font-bold rounded-full uppercase">
                  Step 2 of 5: OCR Extracted
                </span>
                <span className="text-xs text-slate-500">
                  Engine: <strong className="text-slate-700">
                    {extractedResult.engine?.toLowerCase().includes('fallback')
                      ? 'Clinical Heuristic Engine'
                      : extractedResult.engine || 'OCR Engine'}
                  </strong>
                </span>
                {extractedResult.engine?.toLowerCase().includes('fallback') && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full border border-slate-300">
                    Fallback Active (Tesseract binary not configured)
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Confidence: <strong className="text-teal-700">{Math.round((extractedResult.confidence_score || 0.85) * 100)}%</strong>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                OCR & Text Extraction Result
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/ocr-review')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                Open in Full OCR Review Workspace
              </button>
            </div>
          </div>

          {/* ⚠️ PATIENT INFORMATION MISMATCH WARNING SECTION */}
          {patientMismatch && !patientMismatch.isConfirmed && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl space-y-3.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>⚠️ PATIENT INFORMATION MISMATCH</span>
              </div>

              <p className="text-xs text-amber-900 leading-relaxed">
                The extracted prescription document contains patient identifiers that do not match your currently selected consultation record. <strong>Do NOT automatically merge these records.</strong> Clinician confirmation is required before proceeding.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-lg border border-amber-200">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Selected Patient:
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {patientMismatch.selectedPatient.patient_id} — {patientMismatch.selectedPatient.name || 'Selected Patient'}
                  </div>
                  <div className="text-slate-600">
                    Age: {patientMismatch.selectedPatient.age}y | Weight: {patientMismatch.selectedPatient.weight} kg
                  </div>
                </div>

                <div className="space-y-1 border-t sm:border-t-0 sm:border-l sm:pl-3 border-amber-200">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    OCR Detected Patient:
                  </div>
                  <div className="font-bold text-amber-950 text-sm">
                    {patientMismatch.detectedPatient.patient_id}
                  </div>
                  <div className="text-amber-800">
                    Age: {patientMismatch.detectedPatient.age} | Weight: {patientMismatch.detectedPatient.weight}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPatientMismatch({ ...patientMismatch, isConfirmed: true })}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition"
                >
                  <Check className="w-4 h-4" />
                  Use Selected Patient
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('ocr-raw-textarea');
                    if (el) el.focus();
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  Review OCR Data
                </button>
              </div>
            </div>
          )}

          {/* Confirmed Mismatch State */}
          {patientMismatch && patientMismatch.isConfirmed && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Doctor Confirmed: Prescribing for selected patient <strong>{patientMismatch.selectedPatient.patient_id} — {patientMismatch.selectedPatient.name}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPatientMismatch({ ...patientMismatch, isConfirmed: false })}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium"
              >
                Change
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Raw & Editable OCR Text */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Extracted Raw Prescription Text
                </span>
                <span className="text-[11px] text-slate-400">
                  {editableText.length} characters
                </span>
              </div>

              <textarea
                rows={11}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                placeholder="OCR text appears here..."
                className="w-full p-3 font-mono text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 leading-relaxed"
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[11px] text-slate-500 italic">
                  Doctor can edit text to correct any OCR misreads.
                </span>
                <button
                  type="button"
                  onClick={handleReExtractFromEditedText}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-white border border-teal-500 text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-extract Entities
                </button>
              </div>
            </div>

            {/* Right: Detected Medicines & Doctor Review */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  Detected Medications ({editableMedicines.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingMed(true)}
                  className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Medicine
                </button>
              </div>

              {/* Add Medicine Inline Form */}
              {isAddingMed && (
                <div className="p-3 bg-white border border-teal-300 rounded-lg space-y-2">
                  <div className="font-bold text-xs text-slate-800">Add New Medication</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Medication Name (e.g. Lisinopril)"
                      value={newMed.name}
                      onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                      className="p-1.5 border border-slate-300 rounded text-xs col-span-2"
                    />
                    <input
                      type="text"
                      placeholder="Strength (e.g. 10mg)"
                      value={newMed.strength}
                      onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                      className="p-1.5 border border-slate-300 rounded text-xs"
                    />
                    <select
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                      className="p-1.5 border border-slate-300 rounded text-xs"
                    >
                      <option value="Once daily">Once daily (OD)</option>
                      <option value="Twice daily">Twice daily (BID)</option>
                      <option value="Thrice daily">Thrice daily (TID)</option>
                      <option value="At bedtime">At bedtime (QHS)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingMed(false)}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Medications List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {editableMedicines.length === 0 ? (
                  <div className="p-4 bg-white border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                    No medications identified yet. Use "Add Medicine" or check OCR text.
                  </div>
                ) : (
                  editableMedicines.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:border-teal-200 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{m.name}</span>
                          {m.strength && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono rounded">
                              {m.strength}
                            </span>
                          )}
                          {m.rxcui && (
                            <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-mono rounded flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" /> RxCUI:{m.rxcui}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Route: {m.route || 'Oral'}</span>
                          <span>•</span>
                          <span>Freq: {m.frequency || 'OD'}</span>
                          <span>•</span>
                          <span>Duration: {m.duration || '30 days'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(m.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Remove medication"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Clinician Safety Gate Checkbox */}
              <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-lg space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isClinicianVerified}
                    onChange={(e) => setIsClinicianVerified(e.target.checked)}
                    className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <span className="text-xs text-slate-900 font-semibold leading-relaxed">
                    I have reviewed and verified the {editableMedicines.length} extracted medications against the source prescription document.
                  </span>
                </label>
                {!isClinicianVerified && (
                  <div className="text-[11px] text-amber-800 font-medium pl-6">
                    ⚠️ Clinician verification required before running DDI, Posology, or Chronopharmacology scheduling.
                  </div>
                )}
                {patientMismatch && !patientMismatch.isConfirmed && (
                  <div className="text-[11px] text-red-700 font-bold pl-6">
                    ⚠️ Please resolve the Patient Information Mismatch above by clicking "Use Selected Patient".
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-200 gap-3">
            <div className="text-xs text-slate-500">
              Active Patient: <strong className="text-slate-800">{selectedPatient?.name || selectedPatient?.patient_id || 'P-1001'}</strong> ({selectedPatient?.age}y, {selectedPatient?.weight}kg)
            </div>

            <button
              type="button"
              disabled={!isClinicianVerified || (patientMismatch && !patientMismatch.isConfirmed)}
              onClick={handleConfirmAndProceedToConsultation}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center justify-center gap-2 transition"
            >
              <Stethoscope className="w-4 h-4" />
              Confirm Extracted Medicines & Proceed to Doctor Consultation
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureConfirm={handleCameraCaptureConfirm}
      />
    </div>
  );
};

export default ScanPrescription;
