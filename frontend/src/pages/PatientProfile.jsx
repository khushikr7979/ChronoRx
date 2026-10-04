import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientAPI, auditAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import {
  User,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Camera,
  Calculator,
  ArrowRight,
  Calendar,
  Phone,
  FileText
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const PatientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setSelectedPatient } = usePatient();
  const [patient, setPatient] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      setLoading(true);
      try {
        const p = await patientAPI.get(id);
        setPatient(p);
        setSelectedPatient(p);
        const logs = await auditAPI.getPatientAudit(id);
        setAuditLogs(logs);
      } catch (err) {
        console.error("Failed to load patient profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchPatientData();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs">
        Loading patient profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 text-center text-red-600 text-xs">
        Patient record not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-teal-50 border border-teal-200 text-teal-700 rounded-2xl flex items-center justify-center font-bold text-xl">
            {patient.patient_id.slice(-4)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                {patient.patient_id}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registered on {new Date(patient.created_at).toLocaleDateString()} by {patient.created_by || 'Staff'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/scan')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition"
          >
            <Camera className="w-4 h-4" />
            Scan New Rx
          </button>
          <button
            onClick={() => navigate('/dose-support')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
          >
            <Calculator className="w-4 h-4" />
            Dose Calculator
          </button>
        </div>
      </div>

      {/* Anthropometrics & Clinical Vitals Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-400 font-semibold block uppercase">Age / Gender</span>
          <span className="text-lg font-bold text-slate-800 mt-1 block">{patient.age} yrs • {patient.gender}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-400 font-semibold block uppercase">Weight / Height</span>
          <span className="text-lg font-bold text-slate-800 mt-1 block">{patient.weight} kg • {patient.height} cm</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-400 font-semibold block uppercase">DuBois BSA</span>
          <span className="text-lg font-bold text-teal-700 mt-1 block font-mono">{patient.bsa} m²</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-400 font-semibold block uppercase">Body Mass Index</span>
          <span className="text-lg font-bold text-slate-800 mt-1 block font-mono">{patient.bmi} kg/m²</span>
        </div>
      </div>

      {/* Detailed Clinical History & Allergies */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
          Clinical Profile & Drug Sensitivities
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <span className="font-semibold text-slate-700 block mb-1">Known Drug Allergies:</span>
            <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg text-red-900 font-medium">
              {patient.allergies || 'None known'}
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-700 block mb-1">Existing Medications:</span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium">
              {patient.existing_medications || 'None recorded'}
            </div>
          </div>

          <div className="md:col-span-2">
            <span className="font-semibold text-slate-700 block mb-1">Medical Diagnoses & History:</span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed">
              {patient.medical_history || 'None reported'}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Audit History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
          Subject Audit Trail & Access Logs
        </h3>

        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="text-xs flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="font-bold text-teal-800 mr-2">{log.action}</span>
                <span className="text-slate-600">{log.details}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="py-4 text-center text-slate-400 text-xs">No audit events recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
