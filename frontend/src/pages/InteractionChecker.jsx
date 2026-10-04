import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { interactionAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  RefreshCw,
  Utensils,
  Copy,
  Clock,
  Sparkles
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const InteractionChecker = () => {
  const navigate = useNavigate();
  const {
    selectedPatient,
    currentMedicines,
    currentInteractions,
    setCurrentInteractions,
  } = usePatient();

  // Populate list of medications to check from scanned prescription or defaults
  const [drugs, setDrugs] = useState(() => {
    if (currentMedicines && currentMedicines.length > 0) {
      return currentMedicines.map((m) => m.raw_name || m.name || m.drug_name);
    }
    return ['Warfarin', 'Aspirin', 'Omeprazole', 'Clopidogrel'];
  });

  const [newDrugInput, setNewDrugInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const runCheck = async (drugsToCheck) => {
    const list = drugsToCheck || drugs;
    if (list.length === 0) {
      setError('Please add at least one medication to evaluate.');
      return;
    }

    setChecking(true);
    setError('');

    try {
      const data = await interactionAPI.check(
        list,
        selectedPatient?.patient_id || 'DEMO-1001'
      );
      setResults(data);
      setCurrentInteractions(data.alerts || []);
    } catch (err) {
      console.error("Interaction check failed:", err);
      setError(err.response?.data?.detail || 'Failed to check drug interactions.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runCheck(drugs);
  }, []);

  const handleAddDrug = () => {
    if (!newDrugInput.trim()) return;
    const updated = [...drugs, newDrugInput.trim()];
    setDrugs(updated);
    setNewDrugInput('');
    runCheck(updated);
  };

  const handleRemoveDrug = (index) => {
    const updated = drugs.filter((_, i) => i !== index);
    setDrugs(updated);
    runCheck(updated);
  };

  const loadPreset = (presetList) => {
    setDrugs(presetList);
    runCheck(presetList);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-teal-600" />
            Drug Safety & Multi-Layer Interaction Surveillance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 4: Drug-drug interactions, food & dietary contraindications, and duplicate therapy detection.
          </p>
        </div>

        <button
          onClick={() => navigate('/timetable')}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
        >
          Proceed to ChronoRx Timetable
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Presets and Active Drug Pill Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active Medications Under Safety Surveillance ({drugs.length})
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Presets:</span>
            <button
              onClick={() => loadPreset(['Warfarin', 'Aspirin', 'Ibuprofen'])}
              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-800 rounded text-xs font-semibold"
            >
              Bleeding Hazard
            </button>
            <button
              onClick={() => loadPreset(['Clopidogrel', 'Omeprazole'])}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-xs font-semibold"
            >
              CYP2C19 Inhibition
            </button>
            <button
              onClick={() => loadPreset(['Atorvastatin', 'Lisinopril', 'Metformin'])}
              className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded text-xs font-semibold"
            >
              Cardio Triad
            </button>
          </div>
        </div>

        {/* Medication Tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {drugs.map((d, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
            >
              <span>{d}</span>
              <button
                onClick={() => handleRemoveDrug(idx)}
                className="text-slate-400 hover:text-red-600 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Add Drug Input */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={newDrugInput}
            onChange={(e) => setNewDrugInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDrug()}
            placeholder="Add another medicine to evaluate (e.g. Ciprofloxacin, Spironolactone)..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
          <button
            onClick={handleAddDrug}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Medication
          </button>
          <button
            onClick={() => runCheck()}
            disabled={checking}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            Re-evaluate
          </button>
        </div>
      </div>

      {/* Results Display */}
      {checking && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs space-y-2">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Cross-referencing NIH RxNav Interaction Matrix & FDA Monographs...</p>
        </div>
      )}

      {results && !checking && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              {results.alerts.length > 0 ? (
                <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-slate-900">{results.summary_message}</h3>
                <p className="text-xs text-slate-500">
                  Last checked: <strong>{results.checked_timestamp}</strong> across {results.checked_drugs_count} medications.
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 text-right">
              Sources: NIH RxNav • openFDA
            </div>
          </div>

          {/* Section 1: Drug-Drug Interaction Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Drug-Drug Interaction Findings
            </h3>

            {results.alerts.length === 0 ? (
              <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-5 text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-950 block text-sm">
                    No relevant interaction identified in the checked source.
                  </span>
                  <p className="mt-1 text-emerald-800 leading-relaxed">
                    The checked authoritative databases (NIH RxNav & openFDA) identified no known high or moderate severity pharmacokinetic/pharmacodynamic clashes among the queried agents. Clinicians should maintain standard patient-specific monitoring.
                  </p>
                </div>
              </div>
            ) : (
              results.alerts.map((alert, idx) => {
                const isHigh = alert.severity === 'HIGH';
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-5 shadow-sm space-y-3 ${
                      isHigh
                        ? 'bg-red-50/70 border-red-300 text-red-950'
                        : 'bg-amber-50/70 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isHigh ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {isHigh ? '🔴 SEVERE / HIGH PRIORITY' : '🟡 MODERATE / REVIEW'}
                        </span>
                        <h4 className="text-sm font-bold">
                          {alert.drug_a} + {alert.drug_b}
                        </h4>
                      </div>

                      <span className="text-[11px] font-mono text-slate-500">
                        {alert.last_checked_timestamp}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900">
                      Issue: {alert.issue}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed bg-white/70 p-3 rounded-lg border border-slate-200">
                      {alert.explanation}
                    </p>

                    {alert.clinical_recommendation && (
                      <div className="text-xs text-slate-800 bg-white/90 p-3 rounded-lg border border-slate-200">
                        <strong className="text-teal-900 block mb-0.5">Clinical Recommendation:</strong>
                        {alert.clinical_recommendation}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>Source: <strong>{alert.source}</strong></span>
                      <span className="italic font-medium text-amber-900">
                        Verification status: Requires Clinician Sign-off
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Section 2: Food & Dietary Interactions */}
          {results.food_interactions?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-teal-600" />
                Food & Dietary Interaction Advisories
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.food_interactions.map((food, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-sm">{food.drug}</span>
                      <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                        Dietary Factor
                      </span>
                    </div>

                    <div className="text-slate-700">
                      <strong className="text-slate-900">Factor:</strong> {food.food_factor}
                    </div>

                    <div className="text-slate-600 bg-slate-50 p-2.5 rounded text-[11px] leading-relaxed">
                      {food.warning}
                    </div>

                    <div className="text-[11px] text-teal-900 font-medium">
                      <strong>Guidance:</strong> {food.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Duplicate Therapies */}
          {results.duplicate_therapies?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-purple-600" />
                Duplicate Therapeutic Classes Detected
              </h3>
              <div className="space-y-2">
                {results.duplicate_therapies.map((dup, idx) => (
                  <div key={idx} className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900">
                    <strong className="block mb-0.5">{dup.therapeutic_class}: {dup.drug_a} + {dup.drug_b}</strong>
                    {dup.warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Next Step Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-5 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm">Proceed to Chronopharmacology Timetable</h4>
              <p className="text-xs text-slate-300">
                Organize verified medications into optimal circadian morning, evening, and bedtime dosing slots.
              </p>
            </div>
            <button
              onClick={() => navigate('/timetable')}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs shadow flex items-center gap-2 transition"
            >
              Open Timetable
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractionChecker;
