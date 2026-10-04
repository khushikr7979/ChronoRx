import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import { Users, Search, Plus, ArrowRight, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const PatientDirectory = () => {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { selectedPatient, setSelectedPatient } = usePatient();

  const loadPatients = async () => {
    setLoading(true);
    try {
      const data = await patientAPI.list();
      setPatients(data);
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.patient_id.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.medical_history && p.medical_history.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            Patient Directory & Clinical Cohorts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered patients with pseudo-anonymized Patient_IDs and anthropometric clinical indices.
          </p>
        </div>

        <button
          onClick={() => navigate('/patients/register')}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Register New Patient
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by Patient ID (e.g. P-1024, DEMO-1001), Name, or Clinical Condition..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
        />
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Patient ID</th>
                <th className="py-3 px-4">Subject Name (Protected PII)</th>
                <th className="py-3 px-4">Age / Sex</th>
                <th className="py-3 px-4">Weight / Height</th>
                <th className="py-3 px-4">DuBois BSA</th>
                <th className="py-3 px-4">Allergies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((p) => {
                const isSelected = selectedPatient?.patient_id === p.patient_id;
                return (
                  <tr
                    key={p.patient_id}
                    className={`hover:bg-slate-50 transition ${isSelected ? 'bg-teal-50/50' : ''}`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-800">
                      {p.patient_id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.name}
                      <span className="block text-[10px] text-slate-400 font-mono">{p.phone || 'No phone'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {p.age} yrs • {p.gender}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {p.weight} kg • {p.height} cm
                      <span className="block text-[10px] text-slate-400">BMI: {p.bmi || 'N/A'}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-teal-700">
                      {p.bsa ? `${p.bsa} m²` : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.allergies && p.allergies.toLowerCase() !== 'none known' && p.allergies.toLowerCase() !== 'none' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          <ShieldAlert className="w-3 h-3 text-red-500" />
                          {p.allergies}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">NKDA</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedPatient(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isSelected ? 'Active Selected' : 'Select'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPatient(p);
                          navigate('/scan');
                        }}
                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold transition"
                      >
                        Scan Rx
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No patients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientDirectory;
