import React, { useState } from 'react';
import { prescriptionAPI, getFullAssetUrl } from '../services/api';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import {
  FileCheck,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Send,
  MessageSquare
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const PDFPrescription = () => {
  const { user } = useAuth();
  const {
    selectedPatient,
    currentMedicines,
    currentSchedule,
    currentInteractions,
    clinicianNotes,
  } = usePatient();

  const [doctorName, setDoctorName] = useState(user?.full_name || 'Dr. Sarah Jenkins, M.D.');
  const [clinicName, setClinicName] = useState('ChronoRx Clinical Center of Excellence');
  const [diagnosisText, setDiagnosisText] = useState(selectedPatient?.diagnosis || 'Essential Hypertension & Cardiovascular Management');
  const [isVerified, setIsVerified] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);
  const [error, setError] = useState('');
  
  // Tier 3 Digital Delivery state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState('whatsapp');
  const [deliveryPhone, setDeliveryPhone] = useState(selectedPatient?.phone || '+1 (555) 234-5678');
  const [sendingDelivery, setSendingDelivery] = useState(false);
  const [deliveryStatusMsg, setDeliveryStatusMsg] = useState(null);

  const handleGeneratePDF = async () => {
    if (!isVerified) {
      setError('Medication orders cannot be finalized into an official prescription without clinician verification.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const payload = {
        patient_id: selectedPatient?.patient_id || 'DEMO-1001',
        doctor_name: doctorName,
        clinic_name: clinicName,
        diagnosis: diagnosisText || 'Clinical Evaluation & Hypertension Care',
        confirmed_medications: currentMedicines.length > 0 ? currentMedicines : [
          { name: 'Atorvastatin', strength: '20 mg', route: 'Oral', frequency: 'Once daily at bedtime', duration: '30 days', instructions: 'Take at night. Avoid grapefruit juice.' },
          { name: 'Lisinopril', strength: '10 mg', route: 'Oral', frequency: 'Once daily in morning', duration: '30 days', instructions: 'Take in morning with water.' },
          { name: 'Aspirin', strength: '81 mg EC', route: 'Oral', frequency: 'Once daily', duration: '30 days', instructions: 'Take after breakfast.' },
          { name: 'Metformin', strength: '500 mg', route: 'Oral', frequency: 'Twice daily', duration: '30 days', instructions: 'Take with morning and evening meals.' }
        ],
        schedule: currentSchedule.length > 0 ? currentSchedule : null,
        interaction_warnings: currentInteractions.length > 0 ? currentInteractions : null,
        dietary_instructions: [
          'Maintain consistent dietary intake of Vitamin K if on anticoagulants.',
          'Separate calcium and iron supplements from thyroid or fluoroquinolones by 4 hours.'
        ],
        clinician_notes: clinicianNotes || 'Follow up with serial basic metabolic panel in 4 weeks.',
        is_verified: isVerified,
        reviewed_by: doctorName,
      };

      const res = await prescriptionAPI.generate(payload);
      setPdfResult(res);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError(err.response?.data?.detail || 'Failed to generate PDF prescription.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (selectedPatient?.patient_id && pdfResult?.review_id) {
      try {
        await prescriptionAPI.logDownload(selectedPatient.patient_id, pdfResult.review_id);
      } catch (e) {
        // ignore
      }
    }
    const link = document.createElement('a');
    link.href = getFullAssetUrl(pdfResult.pdf_url);
    link.download = pdfResult.pdf_filename || 'Prescription.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = async () => {
    if (selectedPatient?.patient_id && pdfResult?.review_id) {
      try {
        await prescriptionAPI.logPrint(selectedPatient.patient_id, pdfResult.review_id);
      } catch (e) {
        // ignore
      }
    }
    window.print();
  };

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-teal-600" />
            E-Prescription & ReportLab PDF Generation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 7: Clinician-authorized e-Prescription with chronopharmacology schedules and legal disclaimers.
          </p>
        </div>

        {pdfResult && (
          <div className="flex items-center gap-2">
            <a
              href={getFullAssetUrl(pdfResult.pdf_url)}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Clinical PDF
            </a>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Clinician Authorization Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          Authorizing Clinician & Clinic Details
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Prescribing Clinician Name & Credentials *
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Clinical Practice / Hospital Facility *
            </label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Clinical Diagnosis Input */}
        <div className="text-xs">
          <label className="block text-slate-700 font-semibold mb-1">
            Primary Clinical Diagnosis & Indications *
          </label>
          <input
            type="text"
            value={diagnosisText}
            onChange={(e) => setDiagnosisText(e.target.value)}
            placeholder="e.g. Essential Hypertension, Type 2 Diabetes Mellitus"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        {/* Verification Checkbox */}
        <div className={`p-4 rounded-xl border transition ${
          isVerified ? 'bg-teal-50/60 border-teal-300' : 'bg-amber-50/60 border-amber-300'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                Mandatory Clinician Verification Sign-Off
                {!isVerified && (
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                    Verification Required
                  </span>
                )}
              </span>
              <span className="text-slate-600 leading-relaxed block mt-0.5">
                I hereby certify that I have reviewed the AI-assisted extraction, drug identification, posology, and interaction findings. The confirmed medication orders, dosages, and daily administration schedules represent clinically verified medical orders.
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-500">
            {!isVerified ? '⚠️ Sign-off required before generating official PDF' : '✓ Verified and ready for generation'}
          </span>
          <button
            onClick={handleGeneratePDF}
            disabled={generating || !isVerified}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating ReportLab PDF...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                Generate Authorized PDF Prescription
              </>
            )}
          </button>
        </div>
      </div>

      {/* PDF Result Preview Window & Tier 3 Delivery */}
      {pdfResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Prescription Generated Successfully
                </h3>
                <p className="text-[11px] text-slate-500">Tier 3 Delivery: Download, Print, or Dispatch to Patient</p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Ref: {pdfResult.review_id}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-700">
              <div>File: <strong className="font-mono text-slate-900">{pdfResult.pdf_filename}</strong></div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Subject: <span className="font-mono font-bold text-teal-800">{pdfResult.patient_id}</span> • Status: <span className="text-emerald-700 font-semibold">{pdfResult.verification_status}</span>
              </div>
            </div>

            {/* Tier 3 Delivery Options: Download, Print, Send to Patient */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownload}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Prescription
              </button>
              <button
                onClick={() => setShowDeliveryModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Send className="w-3.5 h-3.5" />
                Send to Patient
              </button>
            </div>
          </div>

          {/* Embedded PDF Preview Frame */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner h-[620px] bg-slate-100">
            <iframe
              src={getFullAssetUrl(pdfResult.pdf_url)}
              title="Prescription PDF Preview"
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Tier 3 Digital Delivery Modal (WhatsApp / SMS) */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-base">Send Prescription to Patient</h3>
              </div>
              <button
                onClick={() => {
                  setShowDeliveryModal(false);
                  setDeliveryStatusMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dispatch the clinician-verified chronopharmacology schedule to the patient via secure messaging.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Delivery Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryChannel('whatsapp')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      deliveryChannel === 'whatsapp'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryChannel('sms')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      deliveryChannel === 'sms'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    SMS Text
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Recipient Mobile Number</label>
                <input
                  type="text"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {deliveryStatusMsg && (
              <div className={`p-3 rounded-xl text-xs border ${
                deliveryStatusMsg.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  {deliveryStatusMsg.success ? '✓ Delivery Dispatched' : '⚠️ Delivery Status Notice'}
                </div>
                <p className="mt-1 leading-relaxed text-[11px]">{deliveryStatusMsg.message}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeliveryModal(false);
                  setDeliveryStatusMsg(null);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendDelivery}
                disabled={sendingDelivery}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                {sendingDelivery ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Dispatch Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFPrescription;
