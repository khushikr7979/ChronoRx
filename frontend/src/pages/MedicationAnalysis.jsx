import React, { useState, useEffect } from 'react';
import { doseAPI, drugAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Info,
  Clock,
  Sparkles
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const MedicationAnalysis = () => {
  const { selectedPatient } = usePatient();

  const [drugName, setDrugName] = useState('Atorvastatin');
  const [strength, setStrength] = useState('20 mg');
  const [age, setAge] = useState(selectedPatient?.age || 58);
  const [weight, setWeight] = useState(selectedPatient?.weight || 82.0);
  const [height, setHeight] = useState(selectedPatient?.height || 178.0);
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState('Once daily at bedtime');

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [clinicianReviewed, setClinicianReviewed] = useState(false);
  const [error, setError] = useState('');

  // Update inputs if active patient changes
  useEffect(() => {
    if (selectedPatient) {
      setAge(selectedPatient.age);
      setWeight(selectedPatient.weight);
      setHeight(selectedPatient.height);
    }
  }, [selectedPatient]);

  const handleAnalyze = async (e) => {
    e?.preventDefault();
    if (!drugName.trim()) {
      setError('Please provide a drug name.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setClinicianReviewed(false);

    try {
      const data = await doseAPI.analyze({
        patient_id: selectedPatient?.patient_id || 'DEMO-1001',
        drug_name: drugName,
        strength: strength,
        age: parseInt(age),
        weight: parseFloat(weight),
        height: parseFloat(height),
        route: route,
        frequency: frequency,
      });
      setResult(data);
    } catch (err) {
      console.error("Dose analysis failed:", err);
      setError(err.response?.data?.detail || 'Failed to analyze medication posology.');
    } finally {
      setAnalyzing(false);
    }
  };

  const setPresetDrug = (name, str, freq) => {
    setDrugName(name);
    setStrength(str);
    setFrequency(freq);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-teal-600" />
            AI-Assisted Posology & Dose Support
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 2: DuBois BSA calculations, RxNorm normalization, and authoritative openFDA monograph dosing.
          </p>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Presets:</span>
          <button
            onClick={() => setPresetDrug('Atorvastatin', '20 mg', 'Once daily at bedtime')}
            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded text-xs font-semibold"
          >
            Atorvastatin
          </button>
          <button
            onClick={() => setPresetDrug('Lisinopril', '10 mg', 'Once daily in morning')}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold"
          >
            Lisinopril
          </button>
          <button
            onClick={() => setPresetDrug('Metformin', '500 mg', 'Twice daily with meals')}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold"
          >
            Metformin
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Two Column Layout: Parameters on Left, Clinical Analysis on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form (1 Col) */}
        <form onSubmit={handleAnalyze} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Input Parameters
            </span>
            <span className="text-[11px] font-mono text-teal-700 font-semibold">
              {selectedPatient?.patient_id || 'DEMO-1001'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Drug Name *</label>
            <input
              type="text"
              required
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              placeholder="e.g. Atorvastatin"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Strength</label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                placeholder="e.g. 20 mg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Oral">Oral (PO)</option>
                <option value="Intravenous">Intravenous (IV)</option>
                <option value="Subcutaneous">Subcutaneous (SC)</option>
                <option value="Topical">Topical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Prescribed Frequency</label>
            <input
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="e.g. Once daily at bedtime"
            />
          </div>

          {/* Vitals */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Patient Anthropometrics
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Age (yr)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {analyzing ? 'Analyzing Monograph...' : 'Evaluate Clinical Posology'}
          </button>
        </form>

        {/* Right Panel: Posology Output & Monograph Dosing (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          {!result && !analyzing && (
            <div className="py-24 text-center text-slate-400 text-xs">
              <Calculator className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              Configure parameters on the left and click <strong>"Evaluate Clinical Posology"</strong>.
            </div>
          )}

          {analyzing && (
            <div className="py-24 text-center text-slate-500 text-xs space-y-2">
              <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Querying NIH RxNav and openFDA Monograph Labeling...</p>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              {/* Header Box */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{result.drug}</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                      {result.available_strength}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    RxNorm Match: <strong className="text-slate-800">{result.normalized_name}</strong>
                    {result.rxcui && <span className="ml-2 font-mono text-[11px]">(RxCUI: {result.rxcui})</span>}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Calculated DuBois BSA</div>
                  <div className="text-lg font-bold text-teal-700 font-mono">{result.calculated_bsa} m²</div>
                </div>
              </div>

              {/* Anthropometric Math Breakdown */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                  Anthropometric Calculation Details
                </span>
                <p className="font-mono text-[11px] leading-relaxed text-slate-600">
                  {result.calculation_details}
                </p>
              </div>

              {/* Official Reference Dosing */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-teal-600" />
                  Authoritative Dosing & Administration (U.S. FDA Labeling)
                </div>
                <div className="bg-teal-50/60 border border-teal-200 p-3.5 rounded-lg text-xs leading-relaxed text-slate-800">
                  {result.reference_dosing_info}
                </div>
                <div className="text-[10px] text-slate-400">
                  Source: <strong>{result.source}</strong>
                </div>
              </div>

              {/* Clinical Warnings */}
              {result.warnings?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Clinical Safety Warnings & Special Populations
                  </span>
                  <div className="space-y-1.5">
                    {result.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed"
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandatory Clinician Review Checkbox */}
              <div className="pt-4 border-t border-slate-200 bg-slate-50 p-4 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clinicianReviewed}
                    onChange={(e) => setClinicianReviewed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">
                      Clinician Confirmation Checkbox
                    </span>
                    <span className="text-slate-600 leading-relaxed block mt-0.5">
                      I confirm that I am an authorized licensed healthcare professional. I have clinically evaluated this patient's renal/hepatic function, age, and indications, and independently verified the prescribed posology.
                    </span>
                  </div>
                </label>

                <div className="mt-3 flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    clinicianReviewed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {clinicianReviewed ? '✓ Verified by Clinician' : '⏳ Awaiting Clinician Sign-off'}
                  </span>

                  <span className="text-[11px] text-slate-400 italic">
                    {result.disclaimer}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationAnalysis;
