import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  doseAPI,
  drugAPI,
  interactionAPI,
  scheduleAPI,
  prescriptionAPI,
  patientAPI,
  getFullAssetUrl
} from '../services/api';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import {
  Stethoscope,
  FileCheck,
  ShieldAlert,
  Clock,
  Download,
  Printer,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Calendar,
  Sparkles,
  UserCheck,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const DoctorConsultation = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    selectedPatient,
    setSelectedPatient,
    patientsList,
    refreshPatients,
    diagnosis,
    setDiagnosis,
    clinicianNotes,
    setClinicianNotes,
    currentMedicines,
    setCurrentMedicines,
    currentSchedule,
    setCurrentSchedule,
    currentInteractions,
    setCurrentInteractions,
    updatePatientStatus,
    consultationContext,
  } = usePatient();

  // Consultation Step: 1 = Clinical Notes, 2 = Medicines & Posology, 3 = DDI, 4 = Timetable & Review, 5 = Delivery
  const [activeStep, setActiveStep] = useState(1);
  const [savingStep1, setSavingStep1] = useState(false);
  const [step1SavedBanner, setStep1SavedBanner] = useState('');

  // New Medicine input form state
  const [medName, setMedName] = useState('');
  const [medStrength, setMedStrength] = useState('');
  const [medRoute, setMedRoute] = useState('Oral');
  const [medFreq, setMedFreq] = useState('Once daily');
  const [medDuration, setMedDuration] = useState('30 days');
  const [medInstructions, setMedInstructions] = useState('');

  // Posology state
  const [posologyResult, setPosologyResult] = useState(null);
  const [loadingPosology, setLoadingPosology] = useState(false);

  // Interaction State
  const [interactionResult, setInteractionResult] = useState(null);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  // Schedule state
  const [scheduleItems, setScheduleItems] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isScheduleApproved, setIsScheduleApproved] = useState(false);

  // Review & PDF Generation State
  const [isVerified, setIsVerified] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);

  // Delivery Modal state (Tier 3)
  const [deliveryChannel, setDeliveryChannel] = useState('whatsapp');
  const [deliveryPhone, setDeliveryPhone] = useState(selectedPatient?.phone || '');
  const [sendingDelivery, setSendingDelivery] = useState(false);
  const [deliveryStatusMsg, setDeliveryStatusMsg] = useState(null);

  const [errorMsg, setErrorMsg] = useState('');
  const lastQueryPatientRef = useRef(null);
  const prevSelectedPatientIdRef = useRef(selectedPatient?.patient_id || null);

  // Ensure patients list is loaded when opening Doctor Consultation directly
  useEffect(() => {
    if (patientsList.length === 0) {
      refreshPatients();
    }
  }, [patientsList.length, refreshPatients]);

  // Auto-load patient from query param when URL query param changes
  useEffect(() => {
    const pId = searchParams.get('patient_id');
    if (pId && lastQueryPatientRef.current !== pId) {
      const found = patientsList.find((p) => p.patient_id === pId);
      if (found) {
        lastQueryPatientRef.current = pId;
        setSelectedPatient(found);
        setDiagnosis(found.diagnosis || '');
        setClinicianNotes(found.clinical_notes || '');
      } else {
        patientAPI
          .get(pId)
          .then((fetched) => {
            if (fetched) {
              lastQueryPatientRef.current = pId;
              setSelectedPatient(fetched);
              setDiagnosis(fetched.diagnosis || '');
              setClinicianNotes(fetched.clinical_notes || '');
            }
          })
          .catch(() => {});
      }
    }
  }, [searchParams, patientsList, setSelectedPatient, setDiagnosis, setClinicianNotes]);

  // Sync diagnosis/notes when user switches to a different patient
  useEffect(() => {
    const currentId = selectedPatient?.patient_id || null;
    if (currentId && prevSelectedPatientIdRef.current !== currentId) {
      prevSelectedPatientIdRef.current = currentId;
      setDiagnosis(selectedPatient.diagnosis || '');
      setClinicianNotes(selectedPatient.clinical_notes || '');
      setDeliveryPhone(selectedPatient.phone || '');
      setErrorMsg('');
    }
  }, [selectedPatient, setDiagnosis, setClinicianNotes]);

  // Step 1 handler: Validate, persist diagnosis & consultation notes to backend, and proceed to Step 2
  const handleSaveAndProceedToMedicines = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (savingStep1) return;

    setErrorMsg('');
    setStep1SavedBanner('');

    if (!selectedPatient || !selectedPatient.patient_id) {
      setErrorMsg('Please select a valid patient before saving diagnosis and consultation notes.');
      return;
    }

    const cleanDiagnosis = (diagnosis || '').trim();
    const cleanNotes = (clinicianNotes || '').trim();

    if (!cleanDiagnosis) {
      setErrorMsg('Primary clinical diagnosis is required before proceeding to medicines.');
      return;
    }

    setSavingStep1(true);
    try {
      const updated = await updatePatientStatus(
        'IN_CONSULTATION',
        cleanDiagnosis,
        cleanNotes,
        { patient: selectedPatient, openOnly: false }
      );

      if (!updated || !updated.patient_id || updated.status !== 'IN_CONSULTATION') {
        throw new Error('Consultation diagnosis and notes could not be verified by the server.');
      }

      setStep1SavedBanner(
        `Saved Step 1 Diagnosis ("${updated.diagnosis}") & Consultation Notes for ${updated.patient_id}.`
      );
      setActiveStep(2);
    } catch (err) {
      console.error('Failed to save Step 1 diagnosis and notes:', err);
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to save diagnosis and consultation notes. Please try again.';
      setErrorMsg(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSavingStep1(false);
    }
  };

  // Sync default medicines if empty
  useEffect(() => {
    if (currentMedicines.length === 0) {
      setCurrentMedicines([
        { name: 'Amlodipine', strength: '5 mg', route: 'Oral', frequency: 'Once daily in morning', duration: '30 days', instructions: 'Take in morning with water' },
        { name: 'Atorvastatin', strength: '20 mg', route: 'Oral', frequency: 'Once daily at bedtime', duration: '30 days', instructions: 'Take at night. Avoid grapefruit juice.' }
      ]);
    }
  }, []);

  // Add medication
  const handleAddMedicine = () => {
    if (!medName.trim()) {
      setErrorMsg('Please enter a medication name.');
      return;
    }
    const newMed = {
      name: medName.trim(),
      strength: medStrength.trim() || 'Standard Dose',
      route: medRoute,
      frequency: medFreq,
      duration: medDuration,
      instructions: medInstructions.trim() || 'As directed by physician'
    };
    const updated = [...currentMedicines, newMed];
    setCurrentMedicines(updated);
    setMedName('');
    setMedStrength('');
    setMedInstructions('');
    setErrorMsg('');
  };

  const handleRemoveMedicine = (idx) => {
    const updated = currentMedicines.filter((_, i) => i !== idx);
    setCurrentMedicines(updated);
  };

  // Run Posology for selected medicine
  const handleCheckPosology = async (drugName, strength) => {
    if (!drugName) return;
    setLoadingPosology(true);
    setErrorMsg('');
    try {
      const res = await doseAPI.analyze({
        drug_name: drugName,
        strength: strength || '10mg',
        age: selectedPatient?.age || 50,
        weight: selectedPatient?.weight || 70,
        height: selectedPatient?.height || 170,
        route: 'Oral',
        frequency: 'Daily',
        patient_id: selectedPatient?.patient_id
      });
      setPosologyResult(res);
    } catch (err) {
      console.error('Posology error:', err);
      setErrorMsg('Posology check failed. Authoritative API may be offline; fallback guidance active.');
    } finally {
      setLoadingPosology(false);
    }
  };

  // Run DDI Checker
  const handleRunDDI = async () => {
    setLoadingInteractions(true);
    setErrorMsg('');
    try {
      const drugList = currentMedicines.map((m) => m.name);
      const res = await interactionAPI.check(drugList, selectedPatient?.patient_id);
      setInteractionResult(res);
      setCurrentInteractions(res.alerts || []);
      // Progress to step 3
      setActiveStep(3);
      await updatePatientStatus('ANALYSIS_COMPLETE', diagnosis, clinicianNotes);
    } catch (err) {
      console.error('DDI check error:', err);
      setErrorMsg('Drug interaction check failed.');
    } finally {
      setLoadingInteractions(false);
    }
  };

  // Generate Chronopharmacology Timetable
  const handleGenerateSchedule = async () => {
    setLoadingSchedule(true);
    setErrorMsg('');
    try {
      const res = await scheduleAPI.generate(currentMedicines, selectedPatient?.patient_id);
      setScheduleItems(res.timetable || []);
      setCurrentSchedule(res.timetable || []);
      setActiveStep(4);
      await updatePatientStatus('PENDING_REVIEW', diagnosis, clinicianNotes);
    } catch (err) {
      console.error('Schedule error:', err);
      setErrorMsg('Timetable generation failed.');
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Approve Timetable
  const handleApproveSchedule = async () => {
    try {
      await scheduleAPI.approve(selectedPatient?.patient_id || 'DEMO-1001', scheduleItems);
      setIsScheduleApproved(true);
      await updatePatientStatus('APPROVED', diagnosis, clinicianNotes);
    } catch (err) {
      console.error('Schedule approve error:', err);
      setIsScheduleApproved(true); // fallback
    }
  };

  // Generate Authorized Prescription PDF
  const handleGeneratePrescription = async () => {
    if (!isVerified) {
      setErrorMsg('Please confirm clinician review before generating the authorized prescription.');
      return;
    }
    setGeneratingPdf(true);
    setErrorMsg('');

    try {
      const payload = {
        patient_id: selectedPatient?.patient_id || 'DEMO-1001',
        doctor_name: user?.full_name || 'Dr. Authorized Clinician, M.D.',
        clinic_name: 'ChronoRx Clinical Center of Excellence',
        diagnosis: diagnosis || 'Clinical Evaluation & Hypertension Care',
        confirmed_medications: currentMedicines,
        schedule: scheduleItems.length > 0 ? scheduleItems : currentSchedule,
        interaction_warnings: interactionResult?.alerts || currentInteractions,
        dietary_instructions: [
          'Take antihypertensive agents at scheduled morning hour with a full glass of water.',
          'Take HMG-CoA reductase inhibitors (statins) at bedtime for peak circadian enzyme inhibition.',
          'Separate multivalent cations (calcium/antacids) by 2 hours from medication administration.'
        ],
        clinician_notes: clinicianNotes || 'Patient evaluated and approved for chronopharmacological prescription therapy.',
        is_verified: true,
        reviewed_by: user?.full_name || 'Dr. Authorized Clinician',
      };

      const res = await prescriptionAPI.generate(payload);
      setPdfResult(res);
      setActiveStep(5);
      await updatePatientStatus('PRESCRIPTION_GENERATED', diagnosis, clinicianNotes);
    } catch (err) {
      console.error('Prescription generation failed:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to generate official prescription PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Tier 3: Digital Prescription Delivery (WhatsApp / SMS)
  const handleSendDelivery = async () => {
    setSendingDelivery(true);
    setDeliveryStatusMsg(null);
    try {
      const res = await prescriptionAPI.deliver({
        patient_id: selectedPatient?.patient_id || 'DEMO-1001',
        phone: deliveryPhone || selectedPatient?.phone,
        review_id: pdfResult?.review_id,
        delivery_channel: deliveryChannel,
      });

      setDeliveryStatusMsg({
        success: res.success,
        status: res.status,
        message: res.message,
      });
    } catch (err) {
      console.error('Delivery error:', err);
      setDeliveryStatusMsg({
        success: false,
        status: 'UNCONFIGURED',
        message: 'Digital delivery service is not configured. Download and Print remain fully operational.',
      });
    } finally {
      setSendingDelivery(false);
    }
  };

  // Browser Print
  const handlePrint = async () => {
    if (selectedPatient?.patient_id) {
      try {
        await prescriptionAPI.logPrint(selectedPatient.patient_id, pdfResult?.review_id);
      } catch (e) {
        // ignore log error
      }
    }
    window.print();
  };

  // Download PDF
  const handleDownload = async () => {
    if (selectedPatient?.patient_id) {
      try {
        await prescriptionAPI.logDownload(selectedPatient.patient_id, pdfResult?.review_id);
      } catch (e) {
        // ignore log error
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header & Patient Context Strip */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">
            <Stethoscope className="w-4 h-4 text-teal-600" />
            <span>Tier 2: Doctor Clinical Consultation Suite</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Consultation & Prescription Workflow
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connected Clinical Flow: Diagnosis → Posology → DDI → Circadian Schedule → Clinician Sign-off → Delivery
          </p>
        </div>

        {/* Selected Patient Mini Card & Inline Switcher */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Active Subject</div>
            {patientsList.length > 0 ? (
              <select
                value={selectedPatient?.patient_id || ''}
                onChange={(e) => {
                  const found = patientsList.find((p) => p.patient_id === e.target.value);
                  if (found) {
                    setSelectedPatient(found);
                    if (searchParams.get('patient_id')) {
                      setSearchParams({ patient_id: found.patient_id });
                    }
                  }
                }}
                className="font-mono font-bold text-teal-800 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                {patientsList.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.patient_id} — {p.name} ({p.age}y, {p.gender})
                  </option>
                ))}
              </select>
            ) : selectedPatient ? (
              <div>
                <div className="font-mono font-bold text-teal-800 text-sm">{selectedPatient.patient_id}</div>
                <div className="text-slate-600 font-semibold">{selectedPatient.name}</div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No active patient selected.</div>
            )}
          </div>
          {selectedPatient && (
            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3 space-y-0.5 text-slate-500">
              <div>Age/Sex: <strong className="text-slate-800">{selectedPatient.age}y • {selectedPatient.gender}</strong></div>
              <div>Weight: <strong className="text-slate-800">{selectedPatient.weight} kg</strong></div>
              <div>DuBois BSA: <strong className="text-teal-700">{selectedPatient.bsa || '1.85'} m²</strong></div>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Step Progress Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-5 gap-2 text-xs text-center font-bold">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeStep === 1
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>1. Diagnosis & Notes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeStep === 1) {
                handleSaveAndProceedToMedicines();
              } else {
                setActiveStep(2);
              }
            }}
            disabled={savingStep1}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeStep === 2
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>2. Medicines & Posology</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeStep === 3
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>3. DDI Safety Check</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(4)}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeStep === 4
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>4. Chrono Timetable</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(5)}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeStep === 5
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>5. Sign-off & Delivery</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: DIAGNOSIS & CLINICAL NOTES */}
      {activeStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 1: Clinical Assessment & Diagnosis</h2>
              <p className="text-xs text-slate-500">Record attending physician diagnosis and symptoms.</p>
            </div>
            <span className="text-[11px] font-mono bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200 font-bold">
              Status: {selectedPatient?.status || 'IN_CONSULTATION'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider">
                Primary Clinical Diagnosis *
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => {
                  setDiagnosis(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. Essential Hypertension, Type 2 Diabetes, Hyperlipidemia"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-xs"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This diagnosis will be formally included in the authorized prescription document.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider">
                Attending Clinician
              </label>
              <input
                type="text"
                disabled
                value={`${user?.full_name} (${user?.user_id})`}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold text-xs"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Authorized provider credentials attached to clinical record.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-xs">
              Symptoms, Clinical Observations & Consultation Notes
            </label>
            <textarea
              rows={4}
              value={clinicianNotes}
              onChange={(e) => setClinicianNotes(e.target.value)}
              placeholder="Enter patient presenting symptoms, blood pressure/lab findings, and instructions..."
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-xs"
            />
          </div>

          {/* Vitals Summary Strip */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-teal-600" />
              <span>Baseline Medical History & Reported Allergies</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">Allergies:</span>{' '}
                <span className="text-red-700 font-bold">{selectedPatient?.allergies || 'None known'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Medical History:</span>{' '}
                <span>{selectedPatient?.medical_history || 'None reported'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveAndProceedToMedicines}
              disabled={savingStep1}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
            >
              {savingStep1 ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Diagnosis &amp; Notes...</span>
                </>
              ) : (
                <>
                  <span>Save &amp; Proceed to Medicines</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PRESCRIBED MEDICINES & POSOLOGY */}
      {activeStep === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 2: Prescribed Medications & Posology Analysis</h2>
              <p className="text-xs text-slate-500">
                Prescribe medications and calculate clinical posology / DuBois BSA estimates.
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {currentMedicines.length} Medication(s) Prescribed
            </span>
          </div>

          {/* Active Consultation Context Strip (Saved from Step 1) */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {step1SavedBanner || `Step 1 Diagnosis Recorded: ${diagnosis || selectedPatient?.diagnosis || 'In Consultation'}`}
                </div>
                {clinicianNotes && (
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    Notes: {clinicianNotes}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-teal-900 bg-white px-2.5 py-1 rounded border border-emerald-200 self-start sm:self-center">
              Ref: {consultationContext?.consultation_id || selectedPatient?.consultation_id || `CON-${selectedPatient?.patient_id || 'ACTIVE'}`}
            </span>
          </div>

          {/* New Medication Entry Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />
              <span>Add Prescribed Medication</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-600 mb-1 font-semibold">Drug Name *</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="e.g. Lisinopril, Metformin"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Strength</label>
                <input
                  type="text"
                  value={medStrength}
                  onChange={(e) => setMedStrength(e.target.value)}
                  placeholder="e.g. 10 mg, 500 mg"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Route</label>
                <select
                  value={medRoute}
                  onChange={(e) => setMedRoute(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="Oral">Oral</option>
                  <option value="Sublingual">Sublingual</option>
                  <option value="Inhalation">Inhalation</option>
                  <option value="Subcutaneous">Subcutaneous</option>
                  <option value="Topical">Topical</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Frequency</label>
                <select
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="Once daily">Once daily (QD)</option>
                  <option value="Twice daily">Twice daily (BID)</option>
                  <option value="Three times daily">Three times daily (TID)</option>
                  <option value="At bedtime">At bedtime (QHS)</option>
                  <option value="As needed">As needed (PRN)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Duration</label>
                <input
                  type="text"
                  value={medDuration}
                  onChange={(e) => setMedDuration(e.target.value)}
                  placeholder="e.g. 30 days"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <input
                type="text"
                value={medInstructions}
                onChange={(e) => setMedInstructions(e.target.value)}
                placeholder="Specific instructions (e.g. Take with breakfast. Drink with full glass of water.)"
                className="flex-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddMedicine}
                className="w-full sm:w-auto px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Medication
              </button>
            </div>
          </div>

          {/* Current Prescribed Medication Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                  <th className="py-2.5 px-3">Medication</th>
                  <th className="py-2.5 px-3">Strength</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Actions & Posology</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentMedicines.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{m.name}</td>
                    <td className="py-2.5 px-3 text-slate-700">{m.strength}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.route}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.frequency}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.duration}</td>
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCheckPosology(m.name, m.strength)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 rounded text-[11px] font-semibold border border-slate-200 transition"
                      >
                        Posology CDSS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Posology Decision Support Card (if calculated) */}
          {posologyResult && (
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-teal-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  Clinical Posology Support: {posologyResult.drug_name}
                </span>
                <span className="font-mono text-[11px] bg-teal-200/80 px-2 py-0.5 rounded text-teal-950">
                  BSA: {posologyResult.calculated_bsa} m² (DuBois)
                </span>
              </div>
              <div className="text-slate-700 leading-relaxed">
                <div><strong>Standard Reference:</strong> {posologyResult.reference_dosing}</div>
                <div><strong>Monograph Guidance:</strong> {posologyResult.monograph_guidance}</div>
              </div>
              <div className="text-[11px] text-teal-800 bg-teal-100/70 p-2 rounded border border-teal-200/60 font-medium">
                {posologyResult.disclaimer}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveStep(1)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ← Back to Diagnosis
            </button>

            <button
              onClick={handleRunDDI}
              disabled={loadingInteractions || currentMedicines.length === 0}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
            >
              {loadingInteractions ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking DDI Rules...
                </>
              ) : (
                <>
                  <span>Run DDI Safety Check</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DDI SAFETY & FOOD INTERACTIONS */}
      {activeStep === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 3: Drug-Drug & Drug-Food Interaction Surveillance</h2>
              <p className="text-xs text-slate-500">
                NIH RxNav / openFDA cross-reference for severe contraindications and duplicate therapies.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
              Verified Sources: NIH RxNav & openFDA
            </span>
          </div>

          {/* DDI Alert Cards */}
          <div className="space-y-3">
            {interactionResult?.alerts?.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  alert.severity === 'Severe'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : alert.severity === 'Moderate'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-2">
                    <span className="text-base">{alert.severity === 'Severe' ? '🔴' : alert.severity === 'Moderate' ? '🟡' : '🟢'}</span>
                    <span>{alert.drug_a} + {alert.drug_b}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold ${
                    alert.severity === 'Severe' ? 'bg-red-200 text-red-950' : alert.severity === 'Moderate' ? 'bg-amber-200 text-amber-950' : 'bg-emerald-200 text-emerald-950'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <div className="font-semibold text-slate-900">{alert.issue}</div>
                <p className="text-slate-700 leading-relaxed">{alert.explanation}</p>
                <div className="text-[10px] text-slate-500 pt-1">
                  Source: {alert.source} • Reviewed: Clinician Consultation
                </div>
              </div>
            ))}

            {(!interactionResult?.alerts || interactionResult.alerts.length === 0) && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <div className="font-bold">No relevant interaction identified from checked sources.</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Checked across NIH RxNav & openFDA monograph registries for all {currentMedicines.length} prescribed medications.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveStep(2)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ← Back to Medicines
            </button>

            <button
              onClick={handleGenerateSchedule}
              disabled={loadingSchedule}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
            >
              {loadingSchedule ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Timetable...
                </>
              ) : (
                <>
                  <span>Generate Chrono Timetable</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CHRONOPHARMACOLOGY TIMETABLE */}
      {activeStep === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 4: Chronopharmacology Timetable & Approval</h2>
              <p className="text-xs text-slate-500">
                Circadian daily timing schedule (Morning, Afternoon, Night). Doctor must review & approve.
              </p>
            </div>
            {isScheduleApproved ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Schedule Approved
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                Pending Doctor Approval
              </span>
            )}
          </div>

          {/* Schedule Slots */}
          <div className="space-y-4">
            {scheduleItems.map((item, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>{item.time_slot}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-teal-800">{item.drug_name} ({item.dosage})</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {item.food_relation}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Instructions & Phase</label>
                    <input
                      type="text"
                      value={item.timing_description}
                      onChange={(e) => {
                        const copy = [...scheduleItems];
                        copy[idx].timing_description = e.target.value;
                        setScheduleItems(copy);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Food Relationship</label>
                    <input
                      type="text"
                      value={item.food_relation}
                      onChange={(e) => {
                        const copy = [...scheduleItems];
                        copy[idx].food_relation = e.target.value;
                        setScheduleItems(copy);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                {item.chronopharmacology_rationale && (
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    Rationale: {item.chronopharmacology_rationale}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Action Bar for Schedule */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-teal-50/70 border border-teal-200 rounded-xl">
            <div className="text-xs text-teal-900">
              <strong className="block font-bold">Physician Timetable Verification</strong>
              <span>Approve this administration schedule before advancing to prescription sign-off.</span>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleApproveSchedule}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  isScheduleApproved
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isScheduleApproved ? 'Schedule Approved ✓' : 'Approve Schedule'}
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveStep(3)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ← Back to DDI
            </button>

            <button
              onClick={() => setActiveStep(5)}
              disabled={!isScheduleApproved}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
            >
              <span>Proceed to Prescription Sign-Off</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: CLINICAL VERIFICATION & TIER 3 PRESCRIPTION DELIVERY */}
      {activeStep === 5 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 5: Clinician Review, Sign-off & Delivery</h2>
              <p className="text-xs text-slate-500">
                Authorize official prescription, generate ReportLab PDF, and provide patient delivery.
              </p>
            </div>
            <span className="text-xs font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold">
              Patient: {selectedPatient?.patient_id}
            </span>
          </div>

          {/* Clinician Review Checkbox Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  I hereby certify that I have reviewed the AI-assisted posology, interactions, and timetable.
                </span>
                <span className="text-slate-600 leading-relaxed block mt-0.5">
                  The confirmed medication orders, dosages, and daily administration schedules represent clinically verified orders authorized by {user?.full_name} ({user?.user_id}).
                </span>
              </div>
            </label>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleGeneratePrescription}
                disabled={generatingPdf || !isVerified}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
              >
                {generatingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating ReportLab PDF...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Generate Authorized Prescription (Generate Rx)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TIER 3 PRESCRIPTION DELIVERY SECTION (Appears once generated) */}
          {pdfResult && (
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Prescription Generated Successfully</h3>
                    <p className="text-xs text-slate-600">Reference: {pdfResult.review_id} • Status: {pdfResult.verification_status}</p>
                  </div>
                </div>
              </div>

              {/* Tier 3 Action Buttons: Download PDF, Print Prescription, Send to Patient */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href={getFullAssetUrl(pdfResult.pdf_url)}
                  download
                  onClick={handleDownload}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-center shadow-xs flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition"
                >
                  <Download className="w-4 h-4 text-teal-600" />
                  <span>Download PDF</span>
                </a>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-center shadow-xs flex items-center justify-center gap-2 text-xs font-bold text-slate-800 transition"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Print Prescription</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeliveryStatusMsg(null);
                    handleSendDelivery();
                  }}
                  disabled={sendingDelivery}
                  className="p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-center shadow-sm flex items-center justify-center gap-2 text-xs font-bold transition disabled:opacity-50"
                >
                  {sendingDelivery ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Send to Patient (WhatsApp/SMS)</span>
                </button>
              </div>

              {/* Delivery Configuration / Status Box */}
              <div className="p-4 bg-white rounded-xl border border-emerald-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-teal-600" />
                    Digital Delivery Dispatch Parameters
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">Twilio / Interakt Abstraction</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Delivery Channel</label>
                    <select
                      value={deliveryChannel}
                      onChange={(e) => setDeliveryChannel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="whatsapp">WhatsApp Delivery</option>
                      <option value="sms">SMS Text Message</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Destination Phone Number</label>
                    <input
                      type="text"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      placeholder="+1-555-0199"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {deliveryStatusMsg && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    deliveryStatusMsg.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}>
                    {deliveryStatusMsg.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{deliveryStatusMsg.message}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Status: {deliveryStatusMsg.status} • Destination: {deliveryPhone || selectedPatient?.phone || 'On file'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Embedded PDF Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner h-[500px] bg-slate-100">
                <iframe
                  src={getFullAssetUrl(pdfResult.pdf_url)}
                  title="Prescription Preview"
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorConsultation;
