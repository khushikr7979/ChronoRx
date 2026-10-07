import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Camera,
  FileText,
  Calculator,
  ShieldAlert,
  Clock,
  ClipboardList,
  FileCheck,
  Settings,
  ShieldCheck,
  UserCheck,
  Stethoscope,
  QrCode,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';

const Sidebar = ({ mobileOpen = false, onCloseMobile }) => {
  const { user } = useAuth();
  const { selectedPatient } = usePatient();

  // Role-Based Navigation Config
  const getNavItems = () => {
    const role = user?.role || 'doctor';

    if (role === 'patient') {
      return [
        { to: '/', label: 'My Patient Portal', icon: LayoutDashboard },
      ];
    }

    if (role === 'receptionist') {
      return [
        { to: '/', label: 'Intake Dashboard', icon: LayoutDashboard },
        { to: '/clinic-operations', label: 'QR Verify & Appointments', icon: QrCode, badge: 'QR Check-In' },
        { to: '/patients/register', label: 'Patient Registration', icon: UserPlus, badge: 'New Patient' },
        { to: '/patients', label: 'Patient Directory', icon: Users },
        { to: '/scan', label: 'Scan / Upload Intake', icon: Camera, badge: 'Camera/Upload' },
        { to: '/ocr-review', label: 'OCR Extraction Review', icon: FileText },
        { to: '/settings', label: 'Intake Audit Trail', icon: Settings },
      ];
    }

    if (role === 'admin') {
      return [
        { to: '/', label: 'Admin Dashboard', icon: LayoutDashboard },
        { to: '/clinic-operations', label: 'Follow-Ups & QR Desk', icon: QrCode, badge: '72h & QR' },
        { to: '/settings', label: 'Staff & Audit Directory', icon: ShieldCheck, badge: 'Admin' },
        { to: '/patients', label: 'Global Patient Directory', icon: Users },
        { to: '/patients/register', label: 'Register Patient', icon: UserPlus },
        { to: '/scan', label: 'Prescription Scans', icon: Camera },
        { to: '/ocr-review', label: 'OCR Pipeline Review', icon: FileText },
        { to: '/interactions', label: 'Safety Rules Engine', icon: ShieldAlert },
      ];
    }

    // Default: Doctor / Clinician
    return [
      { to: '/', label: 'Clinical Dashboard', icon: LayoutDashboard },
      { to: '/consultation', label: 'Doctor Consultation Flow', icon: Stethoscope, badge: 'Tier 2 Flow' },
      { to: '/clinic-operations', label: '3-Day Follow-Up & QR Desk', icon: MessageSquare, badge: '72h Care' },
      { to: '/patients', label: 'My Patients Directory', icon: Users },
      { to: '/patients/register', label: 'Patient Registration', icon: UserPlus },
      { to: '/scan', label: 'Scan Prescription', icon: Camera, badge: 'Camera/Upload' },
      { to: '/ocr-review', label: 'OCR & Extraction Review', icon: FileText },
      { to: '/dose-support', label: 'Medication / Dose Support', icon: Calculator },
      { to: '/interactions', label: 'Drug Safety & Interactions', icon: ShieldAlert },
      { to: '/timetable', label: 'ChronoRx Timetable', icon: Clock },
      { to: '/summary', label: 'Clinical Summary Report', icon: ClipboardList },
      { to: '/prescription', label: 'E-Prescription / PDF', icon: FileCheck, badge: 'Doctor Sign-off' },
      { to: '/settings', label: 'Clinical Audit Log', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/90 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 flex-shrink-0 transition-transform duration-200 z-40 ${
          mobileOpen
            ? 'fixed top-16 left-0 bottom-0 translate-x-0 shadow-2xl'
            : 'hidden lg:flex'
        }`}
      >
        <div className="space-y-6 overflow-y-auto">
          {/* User Role Card */}
          {user && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Current Session</span>
                <span className="font-mono text-teal-800 bg-teal-100/80 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  {user.user_id}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-900 truncate">
                {user.full_name}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">
                {user.role === 'doctor' ? '🩺 Clinician / Doctor' : user.role === 'receptionist' ? '📋 Intake Receptionist' : user.role === 'patient' ? '👤 Verified Patient' : '⚙️ Administrator'}
              </div>
            </div>
          )}

          {/* Active Patient Widget Card */}
          {selectedPatient && user?.role !== 'patient' && (
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200/80 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-teal-800 uppercase tracking-wider mb-1">
                <span>Active Subject</span>
                <span className="bg-teal-200/70 text-teal-900 px-1.5 py-0.5 rounded text-[10px]">
                  {selectedPatient.patient_id}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-800 truncate">
                {selectedPatient.name}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>{selectedPatient.age} yrs</span>
                <span>•</span>
                <span>{selectedPatient.gender}</span>
                <span>•</span>
                <span>{selectedPatient.weight} kg</span>
              </div>
              {selectedPatient.bsa && (
                <div className="mt-2 pt-2 border-t border-teal-200/60 flex justify-between text-[11px] text-teal-900">
                  <span className="text-slate-500">DuBois BSA:</span>
                  <span className="font-semibold">{selectedPatient.bsa} m²</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation Menu */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {user?.role === 'receptionist' ? 'Intake Modules' : user?.role === 'admin' ? 'Administration' : 'Clinical Modules'}
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => {
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm shadow-teal-500/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Info Box */}
        <div className="pt-4 border-t border-slate-200 text-slate-400 text-[11px] space-y-1">
          <div className="flex items-center justify-between">
            <span>Authoritative Sources:</span>
            <span className="font-mono text-[10px] text-teal-700">NIH RxNav / FDA</span>
          </div>
          <div className="text-[10px] text-slate-400">
            ChronoRx Tech CDSS v1.0
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
