import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import {
  Users,
  Camera,
  FileCheck,
  ShieldAlert,
  Clock,
  FileText,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  Building,
  UserCheck,
  Stethoscope
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingPatientId, setOpeningPatientId] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    selectedPatient,
    setSelectedPatient,
    patientsList,
    doctorQueue,
    refreshPatients,
    openPatientForConsultation
  } = usePatient();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await auditAPI.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const role = user?.role || 'doctor';

  // Role-specific card definitions
  const getCards = () => {
    if (role === 'receptionist') {
      return [
        {
          title: 'My Registered Patients',
          value: metrics?.cards?.my_patients ?? 0,
          subtext: `Intakes by ${user?.user_id}`,
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-200'
        },
        {
          title: 'Total Clinic Patients',
          value: metrics?.cards?.total_patients ?? 0,
          subtext: 'Directory population',
          icon: Building,
          color: 'text-teal-600',
          bg: 'bg-teal-50',
          border: 'border-teal-200'
        },
        {
          title: 'My Uploaded Scans',
          value: metrics?.cards?.scanned_prescriptions ?? 0,
          subtext: 'Uploaded by this account',
          icon: Camera,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          border: 'border-indigo-200'
        },
        {
          title: 'Total Scans Processed',
          value: metrics?.cards?.total_scans ?? 0,
          subtext: 'OCR pipeline total',
          icon: FileText,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200'
        },
        {
          title: 'Prescriptions Pending Review',
          value: metrics?.cards?.pending_verification ?? 0,
          subtext: 'Awaiting doctor sign-off',
          icon: Clock,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200'
        },
        {
          title: 'Completed Prescriptions',
          value: metrics?.cards?.medication_reviews ?? 0,
          subtext: 'Ready for patient',
          icon: FileCheck,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200'
        },
      ];
    }

    if (role === 'admin') {
      return [
        {
          title: 'Registered Doctors',
          value: metrics?.cards?.total_doctors ?? 1,
          subtext: 'DOC-100X accounts',
          icon: Users,
          color: 'text-teal-600',
          bg: 'bg-teal-50',
          border: 'border-teal-200'
        },
        {
          title: 'Registered Receptionists',
          value: metrics?.cards?.total_receptionists ?? 1,
          subtext: 'REC-100X accounts',
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-200'
        },
        {
          title: 'System Administrators',
          value: metrics?.cards?.total_admins ?? 1,
          subtext: 'ADM-100X accounts',
          icon: ShieldCheck,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          border: 'border-purple-200'
        },
        {
          title: 'Global Patients',
          value: metrics?.cards?.total_patients ?? 0,
          subtext: 'All clinical subjects',
          icon: Building,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          border: 'border-indigo-200'
        },
        {
          title: 'Prescription Scans',
          value: metrics?.cards?.scanned_prescriptions ?? 0,
          subtext: 'All system uploads',
          icon: Camera,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200'
        },
        {
          title: 'Prescriptions Processed',
          value: metrics?.cards?.medication_reviews ?? 0,
          subtext: 'Clinical reviews',
          icon: FileCheck,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200'
        },
      ];
    }

    // Default: Doctor
    return [
      {
        title: 'My Assigned Patients',
        value: metrics?.cards?.my_patients ?? 0,
        subtext: `Assigned to ${user?.user_id}`,
        icon: Users,
        color: 'text-teal-600',
        bg: 'bg-teal-50',
        border: 'border-teal-200'
      },
      {
        title: 'Total Clinic Patients',
        value: metrics?.cards?.total_patients ?? 0,
        subtext: 'Pseudo-anonymized records',
        icon: Building,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200'
      },
      {
        title: 'My Prescriptions Signed',
        value: metrics?.cards?.medication_reviews ?? 0,
        subtext: 'Clinician signed reviews',
        icon: FileCheck,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200'
      },
      {
        title: 'Pending Sign-off',
        value: metrics?.cards?.pending_verification ?? 0,
        subtext: 'Awaiting your review',
        icon: Clock,
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200'
      },
      {
        title: 'Active Safety Alerts',
        value: metrics?.cards?.interaction_alerts ?? 3,
        subtext: 'NIH / FDA drug checks',
        icon: ShieldAlert,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200'
      },
      {
        title: 'Prescription Scans',
        value: metrics?.cards?.scanned_prescriptions ?? 0,
        subtext: 'Camera & OCR processed',
        icon: Camera,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200'
      },
    ];
  };

  const cardsData = getCards();

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <MedicalDisclaimer />

      {/* Hero Welcome & Quick Launch */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-teal-900/50">
        <div>
          <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-2 border border-teal-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {role === 'doctor'
                ? `Clinician Portal • Dr. ${user?.full_name?.replace(/^Dr\.\s*/i, '') || 'Doctor'} (${user?.user_id})`
                : role === 'receptionist'
                ? `Intake Desk • ${user?.full_name} (${user?.user_id})`
                : `Administrator Portal • ${user?.full_name} (${user?.user_id})`}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {role === 'doctor'
              ? 'Clinical Decision Support Dashboard'
              : role === 'receptionist'
              ? 'Patient Intake & Document Dashboard'
              : 'Enterprise System & Audit Dashboard'}
          </h1>
          <p className="mt-1 text-slate-300 text-sm max-w-2xl">
            {role === 'doctor'
              ? 'Precision posology, RxNorm drug normalization, openFDA contraindication checks, and circadian chronopharmacology.'
              : role === 'receptionist'
              ? 'Register new patients with automated P-XXXX anonymization, upload prescription images, and manage intake records.'
              : 'Global compliance monitoring, staff identity directory (DOC-100X, REC-100X, ADM-100X), and system security.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {role === 'receptionist' ? (
            <>
              <button
                onClick={() => navigate('/patients/register')}
                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Register New Patient
              </button>
              <button
                onClick={() => navigate('/clinic-operations')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-2 transition text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                QR Verify &amp; Appointments
              </button>
              <button
                onClick={() => navigate('/scan')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg border border-slate-700 flex items-center gap-2 transition text-sm"
              >
                <Camera className="w-4 h-4" />
                Upload / Scan Document
              </button>
            </>
          ) : role === 'admin' ? (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition text-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                Staff Directory &amp; Audit
              </button>
              <button
                onClick={() => navigate('/clinic-operations')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-2 transition text-sm"
              >
                <Clock className="w-4 h-4" />
                Follow-Ups &amp; QR Desk
              </button>
              <button
                onClick={() => navigate('/patients')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg border border-slate-700 flex items-center gap-2 transition text-sm"
              >
                <Users className="w-4 h-4" />
                All Patients
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/scan')}
                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition text-sm"
              >
                <Camera className="w-4 h-4" />
                Scan Prescription
              </button>
              <button
                onClick={() => navigate('/clinic-operations')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-2 transition text-sm"
              >
                <Clock className="w-4 h-4" />
                3-Day Follow-Ups &amp; QR
              </button>
              <button
                onClick={() => navigate('/dose-support')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg border border-slate-700 flex items-center gap-2 transition text-sm"
              >
                <FileCheck className="w-4 h-4" />
                Dose Support
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cardsData.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              className={`bg-white rounded-xl p-4 border ${c.border} shadow-sm hover:shadow transition`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{c.title}</span>
                <div className={`p-1.5 rounded-lg ${c.bg} ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{c.value}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{c.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Clinical Alerts / Workflow Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Doctor Patient Queue (Tier 2 Primary Cockpit) */}
          {(role === 'doctor' || role === 'admin') && (
            <div className="bg-white rounded-xl border border-teal-200/80 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-100/80 rounded-lg text-teal-800">
                    <Stethoscope className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      Doctor Patient Queue
                      <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">
                        {doctorQueue.length} In Queue
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Patients awaiting doctor consultation, posology evaluation, and authorized sign-off
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshPatients}
                    className="text-xs text-slate-600 hover:text-teal-700 flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                  <button
                    onClick={() => navigate('/consultation')}
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm transition"
                  >
                    Active Consultation
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {doctorQueue.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-700 font-bold">No patients currently in the waiting queue.</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    New patient registrations completed by the front desk receptionist automatically populate this queue with status WAITING_FOR_DOCTOR.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] border-y border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">Patient ID</th>
                        <th className="py-2.5 px-3 font-bold">Age / Gender</th>
                        <th className="py-2.5 px-3 font-bold">Weight / BSA</th>
                        <th className="py-2.5 px-3 font-bold">Status</th>
                        <th className="py-2.5 px-3 font-bold">Registered</th>
                        <th className="py-2.5 px-3 text-right font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {doctorQueue.map((p) => {
                        const statusColors = {
                          WAITING_FOR_DOCTOR: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
                          IN_CONSULTATION: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold',
                          ANALYSIS_COMPLETE: 'bg-purple-50 text-purple-800 border-purple-300 font-semibold',
                          PENDING_REVIEW: 'bg-indigo-50 text-indigo-800 border-indigo-300 font-semibold',
                          APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
                          PRESCRIPTION_GENERATED: 'bg-slate-100 text-slate-700 border-slate-300',
                        };
                        const isOpening = openingPatientId === p.patient_id;
                        return (
                          <tr key={p.patient_id} className="hover:bg-teal-50/30 transition">
                            <td className="py-3 px-3 font-mono font-bold text-teal-800">
                              {p.patient_id}
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              {p.age} yrs • {p.gender}
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              {p.weight} kg <span className="text-slate-400">({p.bsa || '—'} m²)</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${statusColors[p.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {p.status?.replace(/_/g, ' ') || 'WAITING'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={async () => {
                                  setOpeningPatientId(p.patient_id);
                                  try {
                                    await openPatientForConsultation(p);
                                    navigate(`/consultation?patient_id=${p.patient_id}`);
                                  } finally {
                                    setOpeningPatientId(null);
                                  }
                                }}
                                disabled={isOpening}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
                              >
                                {isOpening ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Opening...
                                  </>
                                ) : (
                                  <>
                                    <Stethoscope className="w-3.5 h-3.5" />
                                    Open Patient
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Receptionist Intake Queue (Tier 1 Primary Cockpit) */}
          {role === 'receptionist' && (
            <div className="bg-white rounded-xl border border-blue-200/80 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-800">
                    <Users className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      Patient Intake & Waiting Queue
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                        {patientsList.length} Registered
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tracking intake status, doctor queue progression, and prescription readiness
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshPatients}
                    className="text-xs text-slate-600 hover:text-blue-700 flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                  <button
                    onClick={() => navigate('/patients/register')}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Register Patient
                  </button>
                </div>
              </div>

              {patientsList.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium">No patients currently registered.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] border-y border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">Patient ID</th>
                        <th className="py-2.5 px-3 font-bold">Patient Name</th>
                        <th className="py-2.5 px-3 font-bold">Age / Gender</th>
                        <th className="py-2.5 px-3 font-bold">Queue Status</th>
                        <th className="py-2.5 px-3 font-bold">Registered</th>
                        <th className="py-2.5 px-3 text-right font-bold">Intake Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patientsList.slice(0, 10).map((p) => {
                        const statusColors = {
                          WAITING_FOR_DOCTOR: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
                          IN_CONSULTATION: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold',
                          ANALYSIS_COMPLETE: 'bg-purple-50 text-purple-800 border-purple-300 font-semibold',
                          PENDING_REVIEW: 'bg-indigo-50 text-indigo-800 border-indigo-300 font-semibold',
                          APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
                          PRESCRIPTION_GENERATED: 'bg-slate-100 text-slate-700 border-slate-300',
                        };
                        return (
                          <tr key={p.patient_id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3 font-mono font-bold text-teal-800">
                              {p.patient_id}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900">
                              {p.name || 'Anonymous Subject'}
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              {p.age} yrs • {p.gender}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${statusColors[p.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {p.status?.replace(/_/g, ' ') || 'WAITING'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedPatient(p);
                                  navigate('/scan');
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] inline-flex items-center gap-1 transition"
                                title="Upload / Scan prescription document for this patient"
                              >
                                <Camera className="w-3 h-3" />
                                Scan Document
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Clinical Alert Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  {role === 'doctor' ? 'Clinical Action & Safety Alerts' : role === 'receptionist' ? 'Intake Status & Alerts' : 'System Surveillance'}
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">Automatic CDSS Surveillance</span>
            </div>

            <div className="space-y-3">
              {metrics?.alerts?.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-amber-100 rounded-md text-amber-700 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{alert.desc}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                    alert.status === 'Action Required'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : alert.status === 'Review Recommended'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Guided Pipeline Workflow */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-base mb-3">
              {role === 'doctor'
                ? 'Standard End-to-End Clinical Workflow'
                : role === 'receptionist'
                ? 'Standard Patient Intake Pipeline'
                : 'Enterprise System Architecture'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div
                onClick={() => navigate(role === 'receptionist' ? '/patients/register' : '/scan')}
                className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg cursor-pointer hover:bg-teal-100/70 transition"
              >
                <div className="text-[10px] font-bold text-teal-800 uppercase">Step 1</div>
                <div className="font-semibold text-slate-900 text-xs mt-1">
                  {role === 'receptionist' ? 'Patient Intake' : 'Capture / Upload'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {role === 'receptionist' ? 'Register patient, allocate P-XXXX ID.' : 'Live camera snapshot or PDF upload.'}
                </p>
              </div>

              <div
                onClick={() => navigate('/ocr-review')}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition"
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase">Step 2</div>
                <div className="font-semibold text-slate-900 text-xs mt-1">OCR & AI Extraction</div>
                <p className="text-[11px] text-slate-500 mt-1">Preprocess contrast, extract text, structured JSON.</p>
              </div>

              <div
                onClick={() => navigate(role === 'receptionist' ? '/patients' : '/interactions')}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition"
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase">Step 3</div>
                <div className="font-semibold text-slate-900 text-xs mt-1">
                  {role === 'receptionist' ? 'Patient Records' : 'Safety & Interactions'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {role === 'receptionist' ? 'Review registered patient directory.' : 'RxNorm match, openFDA monograph check.'}
                </p>
              </div>

              <div
                onClick={() => navigate(role === 'receptionist' ? '/settings' : '/prescription')}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition"
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase">Step 4</div>
                <div className="font-semibold text-slate-900 text-xs mt-1">
                  {role === 'receptionist' ? 'Intake Log' : 'Timetable & Sign-off'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {role === 'receptionist' ? 'Review intake records and audit log.' : 'Circadian schedule, clinician review & PDF.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Active Patient & Recent Audit Activity */}
        <div className="space-y-6">
          {/* Active Patient Snapshot */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
              <span>Selected Patient Demographics</span>
              <span className="text-[11px] text-teal-700 font-mono font-semibold">
                {selectedPatient?.patient_id || 'None'}
              </span>
            </h3>

            {selectedPatient ? (
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Age / Gender:</span>
                  <span className="font-semibold text-slate-800">{selectedPatient.age} yrs • {selectedPatient.gender}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Weight / Height:</span>
                  <span className="font-semibold text-slate-800">{selectedPatient.weight} kg • {selectedPatient.height} cm</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">DuBois BSA:</span>
                  <span className="font-semibold text-teal-700">{selectedPatient.bsa} m²</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Allergies:</span>
                  <span className="font-semibold text-red-600">{selectedPatient.allergies}</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1">Clinical History:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded text-[11px]">
                    {selectedPatient.medical_history}
                  </p>
                </div>
                {role === 'doctor' && (
                  <button
                    onClick={() => navigate('/dose-support')}
                    className="w-full mt-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs transition"
                  >
                    Analyze Medication Posology →
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No patient currently selected.
              </div>
            )}
          </div>

          {/* Real-time Audit Trail Stream */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                {role === 'admin' ? 'Global Audit Trail' : 'My Recent Activity'}
              </h3>
              <button
                onClick={fetchDashboardData}
                className="text-slate-400 hover:text-teal-600 p-1"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              {metrics?.recent_activity?.slice(0, 5).map((act, i) => (
                <div key={i} className="text-xs border-l-2 border-teal-500 pl-3 py-0.5">
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="font-semibold text-teal-800">{act.action}</span>
                    <span>{act.timestamp}</span>
                  </div>
                  <div className="font-medium text-slate-800 mt-0.5 line-clamp-1">{act.details}</div>
                  <div className="text-[10px] text-slate-400">By: {act.user_id} • Subject: {act.patient_id}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/settings')}
              className="w-full mt-4 text-center text-xs text-teal-700 hover:text-teal-800 font-semibold"
            >
              View Full Compliance Log →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
