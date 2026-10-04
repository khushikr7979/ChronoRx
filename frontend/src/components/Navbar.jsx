import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import { Activity, User, LogOut, ShieldCheck, ChevronDown, UserCheck } from 'lucide-react';
import MedicalDisclaimer from './MedicalDisclaimer';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { selectedPatient, patientsList, setSelectedPatient } = usePatient();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'doctor':
        return <span className="bg-teal-100 text-teal-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-teal-200">Doctor / Clinician</span>;
      case 'admin':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-purple-200">Administrator</span>;
      case 'patient':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">Patient</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">Receptionist</span>;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  Chrono<span className="text-teal-600">Rx</span>
                </span>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200">
                  Tech CDSS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Clinical Decision Support & Chronopharmacology</p>
            </div>
          </div>

          {/* Active Patient Switcher & Clinical Bar (Staff only) */}
          <div className="hidden md:flex items-center gap-4">
            {user?.role !== 'patient' && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-medium text-slate-500">Active Patient:</span>
                <select
                  value={selectedPatient?.patient_id || ''}
                  onChange={(e) => {
                    const p = patientsList.find(item => item.patient_id === e.target.value);
                    if (p) setSelectedPatient(p);
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {patientsList.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.patient_id} ({p.gender}, {p.age}y, {p.weight}kg)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <MedicalDisclaimer compact={true} />
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 justify-end">
                    <span>{user.full_name}</span>
                    <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                      {user.user_id}
                    </span>
                  </div>
                  <div className="flex justify-end mt-0.5">{getRoleBadge(user.role)}</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold text-sm">
                  {user.full_name.charAt(0)}
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
