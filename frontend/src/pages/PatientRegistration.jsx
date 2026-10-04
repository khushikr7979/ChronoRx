import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ArrowRight,
  Sparkles,
  Stethoscope,
  Users
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const PatientRegistration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setSelectedPatient, refreshPatients, openPatientForConsultation } = usePatient();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    weight: '',
    height: '',
    gender: 'Male',
    medical_history: '',
    allergies: '',
    existing_medications: '',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);

  // Live DuBois BSA Calculation: BSA = 0.007184 * W^0.425 * H^0.725
  const calculateLiveBSA = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (w > 0 && h > 0) {
      const bsa = 0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725);
      return bsa.toFixed(2);
    }
    return null;
  };

  const calculateLiveBMI = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (w > 0 && h > 0) {
      const hm = h / 100.0;
      return (w / (hm * hm)).toFixed(1);
    }
    return null;
  };

  const liveBSA = calculateLiveBSA();
  const liveBMI = calculateLiveBMI();

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Patient name is required';
    if (!formData.age || parseInt(formData.age) <= 0 || parseInt(formData.age) > 125) {
      errs.age = 'Enter a valid age (1-125)';
    }
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      errs.weight = 'Enter valid weight in kg';
    }
    if (!formData.height || parseFloat(formData.height) <= 0) {
      errs.height = 'Enter valid height in cm';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone || null,
        age: parseInt(formData.age),
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        gender: formData.gender,
        medical_history: formData.medical_history || 'None reported',
        allergies: formData.allergies || 'None known',
        existing_medications: formData.existing_medications || 'None',
      };

      const result = await patientAPI.create(payload);
      setRegisteredPatient(result);
      setSelectedPatient(result);
      await refreshPatients();
    } catch (err) {
      console.error("Patient creation failed:", err);
      setErrors({ form: err.response?.data?.detail || 'Failed to register patient.' });
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoData = () => {
    setFormData({
      name: 'Robert H. Anderson',
      phone: '+1 (555) 234-5678',
      age: '62',
      weight: '84.5',
      height: '176',
      gender: 'Male',
      medical_history: 'Essential Hypertension (10 years), Mild Coronary Artery Disease, Dyslipidemia',
      allergies: 'Penicillin, Shellfish',
      existing_medications: 'Aspirin 81mg Daily, Amlodipine 5mg Daily',
    });
    setErrors({});
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-teal-600" />
            Patient Registration & Pseudo-Anonymization
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 1: Secure PII isolation, automatic Patient_ID issuance, and anthropometric calculations.
          </p>
        </div>

        <button
          type="button"
          onClick={fillDemoData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          Fill Realistic Demo Patient
        </button>
      </div>

      {/* Success Notification Modal */}
      {registeredPatient && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-emerald-100 rounded-full text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Registration Successful
                </span>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  Status: WAITING_FOR_DOCTOR
                </span>
                <span className="text-[11px] font-semibold bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full">
                  Enqueued to Doctor Patient Queue
                </span>
              </div>
              <h3 className="text-lg font-bold text-emerald-950 mt-1">
                Assigned Identifier: <span className="text-teal-700 underline font-mono">{registeredPatient.patient_id}</span>
              </h3>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Direct PII (Name, Phone) has been isolated in encrypted local storage.
                Subject <strong>{registeredPatient.patient_id}</strong> is now waiting in the Doctor Consultation Queue with status <strong>WAITING_FOR_DOCTOR</strong>.
              </p>

              {user?.role === 'receptionist' ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5" />
                    View Intake & Waiting Queue
                  </button>
                  <button
                    onClick={() => navigate('/scan')}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    Upload / Scan Intake Document
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRegisteredPatient(null)}
                    className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
                  >
                    Register Another Patient
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={async () => {
                      await openPatientForConsultation(registeredPatient);
                      navigate(`/consultation?patient_id=${registeredPatient.patient_id}`);
                    }}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    Open in Doctor Consultation
                  </button>
                  <button
                    onClick={() => navigate('/scan')}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    Scan Prescription
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRegisteredPatient(null)}
                    className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Register Another Patient
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        {errors.form && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Section 1: Identifying Information (PII) */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Identifying Information (Strictly Protected PII)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            This information is held securely in local records and is <strong>never</strong> transmitted to external AI models or medical database queries.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Patient Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.name ? 'border-red-400 bg-red-50/50' : 'border-slate-300'
                }`}
                placeholder="e.g. Johnathan Doe"
              />
              {errors.name && <span className="text-[11px] text-red-500 mt-1 block">{errors.name}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Clinical Anthropometrics */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Clinical Anthropometrics
            </h3>
            {liveBSA && (
              <div className="flex items-center gap-3 text-xs bg-teal-50 text-teal-900 border border-teal-200 px-3 py-1 rounded-md font-mono">
                <span>DuBois BSA: <strong>{liveBSA} m²</strong></span>
                <span>•</span>
                <span>BMI: <strong>{liveBMI} kg/m²</strong></span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Age (years) *
              </label>
              <input
                type="number"
                min="1"
                max="125"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.age ? 'border-red-400 bg-red-50/50' : 'border-slate-300'
                }`}
                placeholder="e.g. 58"
              />
              {errors.age && <span className="text-[11px] text-red-500 mt-1 block">{errors.age}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender *
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.weight ? 'border-red-400 bg-red-50/50' : 'border-slate-300'
                }`}
                placeholder="e.g. 82.0"
              />
              {errors.weight && <span className="text-[11px] text-red-500 mt-1 block">{errors.weight}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Height (cm) *
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.height ? 'border-red-400 bg-red-50/50' : 'border-slate-300'
                }`}
                placeholder="e.g. 178"
              />
              {errors.height && <span className="text-[11px] text-red-500 mt-1 block">{errors.height}</span>}
            </div>
          </div>
        </div>

        {/* Section 3: Clinical Background & History */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            3. Clinical Profile & Safety Constraints
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Known Drug Allergies & Adverse Reactions
            </label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. Penicillin (anaphylaxis), Sulfa (rash) or 'None known'"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Existing / Chronic Medications
            </label>
            <input
              type="text"
              value={formData.existing_medications}
              onChange={(e) => setFormData({ ...formData, existing_medications: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. Metformin 500mg BID, Amlodipine 5mg Daily"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Relevant Medical History & Diagnoses
            </label>
            <textarea
              rows={3}
              value={formData.medical_history}
              onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. Essential Hypertension, Type 2 Diabetes Mellitus, CKD Stage 2"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 transition flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? 'Registering & Anonymizing...' : 'Register Patient & Generate ID'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientRegistration;
