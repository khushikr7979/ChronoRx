import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientAPI, prescriptionAPI, scheduleAPI, historyAPI } from '../services/api';
import {
  User,
  FileText,
  Calendar,
  Clock,
  Download,
  AlertCircle,
  CheckCircle,
  Activity,
  Heart,
  Pill,
  Shield,
  LogOut,
  RefreshCw,
  Info
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [patientData, setPatientData] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [scheduleData, setScheduleData] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  const patientId = user?.patient_id;

  const loadAllData = async () => {
    if (!patientId) {
      setError('No patient profile is linked to this user account.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Patient Profile
      const pProfile = await patientAPI.get(patientId);
      setPatientData(pProfile);

      // 2. Fetch Prescriptions (only active & verified)
      try {
        const pList = await prescriptionAPI.listForPatient(patientId);
        setPrescriptions(Array.isArray(pList) ? pList : []);
      } catch (err) {
        console.warn('Prescription fetch error:', err);
        setPrescriptions([]);
      }

      // 3. Fetch Schedule
      try {
        const sched = await scheduleAPI.getForPatient(patientId);
        setScheduleData(sched);
      } catch (err) {
        console.warn('Schedule fetch error:', err);
        setScheduleData(null);
      }

      // 4. Fetch Medical History
      try {
        const hist = await historyAPI.list(patientId);
        setHistoryEntries(Array.isArray(hist) ? hist : []);
      } catch (err) {
        console.warn('History fetch error:', err);
        setHistoryEntries([]);
      }
    } catch (err) {
      console.error('Failed to load patient dashboard:', err);
      setError(err.response?.data?.detail || 'Failed to load your patient records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [patientId]);

  const handleDownloadPdf = async (review) => {
    try {
      setDownloadingId(review.review_id);
      const filename = `Prescription_${patientId}_${review.review_id}.pdf`;
      await prescriptionAPI.downloadPdf(review.review_id, filename);
    } catch (err) {
      alert('Could not download prescription PDF. ' + (err.response?.data?.detail || 'Please try again later.'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Activity className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
        <h2 className="text-base font-semibold text-slate-800">Loading Your Patient Portal...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving verified clinical records securely</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Welcome & Identity Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
              <User className="w-8 h-8 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{patientData?.name || user?.full_name || 'Patient Portal'}</h1>
                <span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full">
                  {patientId}
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                ChronoRx Patient Portal &bull; Account: <span className="font-mono">{user?.user_id}</span> ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={loadAllData}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              title="Refresh Records"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition text-white shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Quick summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/15 text-xs">
          <div>
            <span className="text-emerald-200/80 block text-[11px]">Clinical Status</span>
            <span className="font-semibold text-white">{patientData?.status?.replace(/_/g, ' ') || 'ACTIVE'}</span>
          </div>
          <div>
            <span className="text-emerald-200/80 block text-[11px]">Primary Diagnosis</span>
            <span className="font-semibold text-white truncate block">{patientData?.diagnosis || 'None specified'}</span>
          </div>
          <div>
            <span className="text-emerald-200/80 block text-[11px]">Active Prescriptions</span>
            <span className="font-semibold text-white">{prescriptions.length} verified</span>
          </div>
          <div>
            <span className="text-emerald-200/80 block text-[11px]">Recorded Allergies</span>
            <span className="font-semibold text-amber-200 truncate block">{patientData?.allergies || 'None known'}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>My Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'prescriptions'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Prescriptions ({prescriptions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'schedule'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Medication Schedule</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Medical History</span>
        </button>
      </div>

      {/* TAB 1: MY PROFILE */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Personal Demographics & Clinical Metrics</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Patient ID</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{patientData?.patient_id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Full Name</span>
                <span className="font-semibold text-slate-800 text-sm">{patientData?.name}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Contact Phone</span>
                <span className="font-semibold text-slate-800">{patientData?.phone || 'Not recorded'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Age / Gender</span>
                <span className="font-semibold text-slate-800">{patientData?.age} yrs &bull; {patientData?.gender}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Height / Weight</span>
                <span className="font-semibold text-slate-800">{patientData?.height} cm &bull; {patientData?.weight} kg</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Body Surface Area (BSA)</span>
                <span className="font-semibold text-slate-800">{patientData?.bsa ? `${patientData.bsa} m²` : 'Calculated'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Body Mass Index (BMI)</span>
                <span className="font-semibold text-slate-800">{patientData?.bmi || 'Calculated'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Registered Date</span>
                <span className="font-semibold text-slate-800">
                  {patientData?.created_at ? new Date(patientData.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block text-[10px] uppercase">Assigned Clinician</span>
                <span className="font-semibold text-slate-800 font-mono">{patientData?.assigned_doctor_id || 'DOC-1001'}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs">
                <span className="font-bold text-rose-800 block text-[11px] uppercase tracking-wide">Known Allergies</span>
                <p className="text-rose-900 mt-1 font-medium">{patientData?.allergies || 'No known drug allergies reported.'}</p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <span className="font-bold text-amber-800 block text-[11px] uppercase tracking-wide">Existing Baseline Medications</span>
                <p className="text-amber-900 mt-1">{patientData?.existing_medications || 'None recorded.'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Security & Access Control</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your portal access is encrypted and isolated. You are authenticated under role{' '}
                <strong className="text-emerald-700 uppercase">PATIENT</strong> and linked strictly to clinical record{' '}
                <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">{patientId}</code>.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div>&bull; Multi-factor isolation enabled</div>
                <div>&bull; Cross-patient access strictly blocked</div>
                <div>&bull; Real-time audit trail recording</div>
              </div>
            </div>

            <MedicalDisclaimer />
          </div>
        </div>
      )}

      {/* TAB 2: MY PRESCRIPTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Verified Clinical Prescriptions</span>
            </h2>
            <span className="text-xs text-slate-500">Only verified and finalized prescriptions are visible</span>
          </div>

          {prescriptions.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Finalized Prescriptions Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once your attending doctor conducts a consultation and finalizes an e-prescription, it will appear here for immediate viewing and PDF download.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {prescriptions.map((review) => {
                let meds = [];
                try {
                  meds = typeof review.medications === 'string' ? JSON.parse(review.medications) : review.medications || [];
                } catch {
                  meds = [];
                }

                return (
                  <div key={review.review_id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:border-emerald-300 transition">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-800">{review.review_id}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Clinician Verified
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Prescribed by <strong className="text-slate-700">{review.doctor_name || 'Attending Clinician'}</strong> on{' '}
                          {review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDownloadPdf(review)}
                        disabled={downloadingId === review.review_id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadingId === review.review_id ? 'Downloading...' : 'Download PDF'}</span>
                      </button>
                    </div>

                    {/* Diagnosis & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Primary Diagnosis</span>
                        <span className="font-semibold text-slate-800">{review.diagnosis || 'Clinical Consultation'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Clinician Notes</span>
                        <span className="text-slate-700">{review.clinician_notes || 'Standard prescription guidelines apply.'}</span>
                      </div>
                    </div>

                    {/* Prescribed Medications list */}
                    <div className="mt-2 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Prescribed Medications ({meds.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {meds.map((m, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Pill className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{m.name || m.drug_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {m.dosage || m.strength || ''} &bull; {m.frequency || 'Daily'} &bull; {m.route || 'Oral'}
                            </div>
                            {m.instructions && (
                              <p className="text-[10px] text-slate-500 mt-1 italic">{m.instructions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEDICATION SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Personalized Chronopharmacology Schedule</span>
            </h2>
            {scheduleData?.doctor_name && (
              <span className="text-xs text-slate-500">
                Approved by <strong>{scheduleData.doctor_name}</strong>
              </span>
            )}
          </div>

          {!scheduleData || !scheduleData.schedule || scheduleData.schedule.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Medication Schedule Available</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your daily medication schedule will appear here once your physician completes and approves your circadian dosing timetable.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-800">
                <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Medication administration times have been synchronized with your circadian rhythms and meals for optimal efficacy and minimized side effects.
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {scheduleData.schedule.map((item, idx) => (
                  <div key={idx} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                          <span>{item.drug_name || item.medication || item.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {item.time || item.slot || 'Daily'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Dosage: <strong>{item.dose || item.dosage || 'Standard'}</strong> &bull; Meal: {item.food_relation || item.meal_instruction || 'With water'}
                        </p>
                        {item.instructions && (
                          <p className="text-[10px] text-emerald-700 mt-1 font-medium">{item.instructions}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right sm:text-right text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Circadian Target</span>
                      <span className="font-semibold text-slate-700 text-xs">
                        {item.chronopharmacology_rationale || item.rationale || 'Targeted Peak Window'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MEDICAL HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-600" />
              <span>My Medical History & Clinical Consultations</span>
            </h2>
            <span className="text-xs text-slate-500">Official active medical records</span>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Chronic Conditions & Background
              </h3>
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-800 leading-relaxed">
                {patientData?.medical_history || 'No chronic background conditions recorded.'}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Consultation Records ({historyEntries.length})
              </h3>
              {historyEntries.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                  No individual consultation entries recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry) => (
                    <div key={entry.entry_id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">{entry.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{entry.description}</p>
                      {entry.doctor_name && (
                        <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                          Clinician: {entry.doctor_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
