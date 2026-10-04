import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanAPI, drugAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import {
  FileText,
  Edit3,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Tag
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import VerificationBadge from '../components/VerificationBadge';

const OCRReview = () => {
  const navigate = useNavigate();
  const { activeScan, setActiveScan, selectedPatient, setCurrentMedicines } = usePatient();

  const [ocrText, setOcrText] = useState(activeScan?.raw_text || '');
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('medicines'); // medicines, clinical, raw_json

  // If no active scan in memory, load sample text
  useEffect(() => {
    if (!ocrText) {
      setOcrText(
        "CHRONORX HEALTH CLINIC - CARDIOLOGY\n" +
        "Dr. Sarah Jenkins, M.D. | Reg #MD-88421\n" +
        "Date: 2025-05-20\n" +
        "Patient ID: DEMO-1001 | Age: 58 | Sex: M | Wt: 82 kg\n" +
        "Allergies: Penicillin (mild urticaria)\n" +
        "Rx:\n" +
        "1. Atorvastatin 20mg Tab - 1 tab PO at bedtime (ONCE daily at night) x 30 days\n" +
        "2. Lisinopril 10mg Tab - 1 tab PO in the morning (ONCE daily) x 30 days\n" +
        "3. Aspirin 81mg EC Tab - 1 tab PO after breakfast x 30 days\n" +
        "4. Metformin 500mg Tab - 1 tab PO BID with meals x 30 days\n" +
        "Instructions: Avoid grapefruit juice with Atorvastatin. Log BP weekly."
      );
    }
  }, []);

  const handleRunAIExtraction = async () => {
    if (!ocrText.trim()) {
      setError('Cannot extract from empty text.');
      return;
    }

    setExtracting(true);
    setError('');
    try {
      const scanId = activeScan?.scan_id || 'SCAN-DEMO-SAMPLE';
      const patientId = selectedPatient?.patient_id || 'DEMO-1001';

      const data = await scanAPI.extract(scanId, patientId, ocrText);
      setExtractedData(data);
      setCurrentMedicines(data.medicines || []);
    } catch (err) {
      console.error("Extraction error:", err);
      setError(err.response?.data?.detail || 'Failed to extract structured data. Please verify text formatting.');
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmAndProceed = () => {
    if (extractedData?.medicines) {
      setCurrentMedicines(extractedData.medicines);
    }
    navigate('/interactions');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600" />
            OCR Review & AI Structured Extraction
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 3 — Steps 2, 3, 4 & 5: Review raw transcription, edit OCR artifacts, and extract normalized clinical entities.
          </p>
        </div>

        {extractedData && (
          <button
            onClick={handleConfirmAndProceed}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
          >
            Proceed to Drug Safety Check
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Workspace: Left OCR Editor, Right AI Structured Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Raw OCR Text Box (Editable by Clinician) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Step 2: Extracted OCR Text (Editable)
              </h3>
            </div>
            {activeScan?.confidence_score && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                OCR Confidence: {Math.round(activeScan.confidence_score * 100)}%
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500">
            You may correct any unclear abbreviations, typos, or numbers before passing to the clinical NLP engine:
          </p>

          <textarea
            rows={14}
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
            placeholder="Extracted prescription text will appear here..."
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              PII is automatically scrubbed before AI processing.
            </span>
            <button
              type="button"
              onClick={handleRunAIExtraction}
              disabled={extracting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-2 transition disabled:opacity-50"
            >
              {extracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                  Extracting Entities...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  Execute AI Structured Extraction
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: AI Structured Results & RxNorm Mapping */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Step 3 & 4: Structured Fields & RxNorm Verification
                </h3>
              </div>

              {extractedData && (
                <div className="flex gap-1 text-[11px] font-semibold">
                  <button
                    onClick={() => setActiveTab('medicines')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      activeTab === 'medicines' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Meds ({extractedData.medicines?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('clinical')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      activeTab === 'clinical' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Instructions
                  </button>
                </div>
              )}
            </div>

            {!extractedData && !extracting && (
              <div className="py-20 text-center text-slate-400 text-xs">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Click <strong>"Execute AI Structured Extraction"</strong> to extract medications, dosage, frequency, and link with NIH RxNorm.
              </div>
            )}

            {extracting && (
              <div className="py-20 text-center text-slate-500 text-xs space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                <p>Analyzing prescription linguistics & querying NIH RxNorm...</p>
              </div>
            )}

            {extractedData && activeTab === 'medicines' && (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {extractedData.medicines?.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{med.raw_name}</span>
                        {med.strength && (
                          <span className="ml-2 font-mono text-teal-700 font-semibold">{med.strength}</span>
                        )}
                      </div>
                      <VerificationBadge
                        status={med.needs_manual_review ? 'manual_verification_required' : 'identified'}
                        confidence={med.confidence}
                      />
                    </div>

                    {/* Normalized RxNorm Name */}
                    <div className="bg-white p-2 rounded border border-slate-200 text-[11px] text-slate-600">
                      <span className="text-slate-400 font-medium">RxNorm Normalized: </span>
                      <strong className="text-slate-800">
                        {med.normalized_name || 'Unable to confidently identify — manual verification required'}
                      </strong>
                      {med.rxcui && (
                        <span className="ml-2 font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                          RxCUI: {med.rxcui}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1">
                      <div>
                        <span className="text-slate-400 block">Frequency:</span>
                        <span className="font-medium text-slate-800">{med.frequency || 'Daily'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Route:</span>
                        <span className="font-medium text-slate-800">{med.route || 'Oral'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Duration:</span>
                        <span className="font-medium text-slate-800">{med.duration || 'As directed'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {extractedData && activeTab === 'clinical' && (
              <div className="space-y-4 text-xs">
                {extractedData.allergies_if_visible?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block mb-1">
                      Detected Allergy Warnings:
                    </span>
                    <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg text-red-800">
                      {extractedData.allergies_if_visible.join(', ')}
                    </div>
                  </div>
                )}

                {extractedData.instructions?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Clinical Instructions:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                      {extractedData.instructions.map((ins, i) => (
                        <li key={i}>{ins}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {extractedData.investigations?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Ordered Investigations & Labs:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                      {extractedData.investigations.map((inv, i) => (
                        <li key={i}>{inv}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action */}
          {extractedData && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {extractedData.medicines?.length || 0} medication(s) identified.
              </span>
              <button
                onClick={handleConfirmAndProceed}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-2 transition"
              >
                Proceed to Drug Safety Check
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRReview;
