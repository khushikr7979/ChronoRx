import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { summaryAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import {
  ClipboardList,
  FileCheck,
  CheckCircle2,
  ShieldAlert,
  Clock,
  ArrowRight,
  RefreshCw,
  Edit3,
  Sparkles,
  BookOpen,
  Printer
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const ClinicalSummary = () => {
  const navigate = useNavigate();
  const {
    selectedPatient,
    currentMedicines,
    currentInteractions,
    currentSchedule,
    clinicianNotes,
    setClinicianNotes,
  } = usePatient();

  const [summaryData, setSummaryData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchSummary = async () => {
    setGenerating(true);
    setError('');

    try {
      const payload = {
        patient_id: selectedPatient?.patient_id || 'DEMO-1001',
        confirmed_medications: currentMedicines.length > 0 ? currentMedicines : [
          { name: 'Atorvastatin', strength: '20 mg', route: 'Oral', frequency: 'Bedtime', verified: true },
          { name: 'Lisinopril', strength: '10 mg', route: 'Oral', frequency: 'Morning', verified: true },
          { name: 'Aspirin', strength: '81 mg', route: 'Oral', frequency: 'Morning after food', verified: true }
        ],
        interaction_alerts: currentInteractions || [],
        timetable: currentSchedule || [],
        clinician_notes: clinicianNotes,
      };

      const res = await summaryAPI.generate(payload);
      setSummaryData(res);
    } catch (err) {
      console.error("Failed to generate clinical summary:", err);
      setError('Could not compile clinical summary.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-teal-600" />
            AI-Assisted Clinical Summary Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 6: Multi-source synthesis of patient anthropometrics, verified medications, safety alerts, and circadian schedules.
          </p>
        </div>

        <button
          onClick={() => navigate('/prescription')}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
        >
          Generate E-Prescription / PDF
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Clinician Notes Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
          <Edit3 className="w-4 h-4 text-teal-600" />
          Clinician Observations & Final Verification Notes
        </div>
        <textarea
          rows={3}
          value={clinicianNotes}
          onChange={(e) => setClinicianNotes(e.target.value)}
          placeholder="Enter clinical notes, laboratory follow-up orders, or special patient counseling instructions..."
          className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            onClick={fetchSummary}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            Update Summary with Notes
          </button>
        </div>
      </div>

      {/* Generated Report Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
        {generating && (
          <div className="py-20 text-center text-slate-500 text-xs space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
            <p>Compiling comprehensive clinical report...</p>
          </div>
        )}

        {summaryData && !generating && (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  ChronoRx Tech CDSS Report
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Subject Clinical Case Summary
                </h2>
                <div className="text-xs text-slate-500 mt-1">
                  Subject Identifier: <strong className="text-slate-800 font-mono">{summaryData.patient_id}</strong> • Generated: {summaryData.generated_at}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-900 text-right">
                <span className="text-[10px] font-bold block uppercase tracking-wider">Status</span>
                <span className="text-xs font-semibold">Clinician Review Ready</span>
              </div>
            </div>

            {/* Markdown Rendered Summary Sections */}
            <div className="prose prose-sm max-w-none text-xs text-slate-700 space-y-4">
              <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-800">
                {summaryData.formatted_markdown}
              </pre>
            </div>

            {/* Sources & Citations */}
            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <span>Authoritative Reference Grounding: <strong>NIH RxNav REST API & U.S. FDA Drug Labeling</strong></span>
              </div>
              <span className="font-semibold text-teal-800">{summaryData.disclaimer}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicalSummary;
