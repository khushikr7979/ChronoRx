import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  patientAPI,
  prescriptionAPI,
  scheduleAPI,
  historyAPI,
  followupAPI,
  appointmentAPI
} from '../services/api';
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
  Info,
  MessageSquare,
  QrCode,
  Send,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Printer,
  XCircle
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import { UserProfileCard, UserAvatar } from '../components/UserProfileCard';

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

  // --- Feature 1: 3-Day Follow-Up State ---
  const [followupSessions, setFollowupSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [msgType, setMsgType] = useState('QUESTION');
  const [sideEffectSeverity, setSideEffectSeverity] = useState('MILD');
  const [msgContent, setMsgContent] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [followupStatusMsg, setFollowupStatusMsg] = useState(null);

  // --- Feature 2: Appointment Booking & QR Receipt State ---
  const [doctorsSlots, setDoctorsSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState('');
  const [consultationType, setConsultationType] = useState('IN_PERSON');
  const [bookingReason, setBookingReason] = useState('Routine Chronotherapy & Prescription Consultation');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);

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

      // 5. Fetch 3-Day Follow-Up Sessions
      try {
        const fList = await followupAPI.list();
        const sessionsArr = Array.isArray(fList) ? fList : [];
        setFollowupSessions(sessionsArr);
        if (sessionsArr.length > 0 && !selectedSessionId) {
          setSelectedSessionId(sessionsArr[0].session_id);
        }
      } catch (err) {
        console.warn('Follow-up fetch error:', err);
        setFollowupSessions([]);
      }

      // 6. Fetch Appointments & Doctor Slots
      try {
        const [appts, docs] = await Promise.all([
          appointmentAPI.list(),
          appointmentAPI.getDoctorsAndSlots(selectedDate)
        ]);
        const apptArr = Array.isArray(appts) ? appts : [];
        setMyAppointments(apptArr);
        if (apptArr.length > 0 && !activeReceipt) {
          setActiveReceipt(apptArr[0]);
        }
        const docsArr = Array.isArray(docs) ? docs : [];
        setDoctorsSlots(docsArr);
        if (docsArr.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(docsArr[0].doctor_id);
          if (docsArr[0].available_slots?.length > 0) {
            setSelectedSlot(docsArr[0].available_slots[0]);
          }
        }
      } catch (err) {
        console.warn('Appointments fetch error:', err);
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

  useEffect(() => {
    if (selectedSessionId) {
      followupAPI
        .getThread(selectedSessionId)
        .then((t) => setActiveThread(t))
        .catch((err) => {
          console.warn('Could not load follow-up thread:', err);
        });
    }
  }, [selectedSessionId]);

  useEffect(() => {
    if (selectedDate && patientId) {
      appointmentAPI
        .getDoctorsAndSlots(selectedDate)
        .then((docs) => {
          const arr = Array.isArray(docs) ? docs : [];
          setDoctorsSlots(arr);
          const curDoc = arr.find((d) => d.doctor_id === selectedDoctorId) || arr[0];
          if (curDoc?.available_slots?.length > 0 && !curDoc.available_slots.includes(selectedSlot)) {
            setSelectedSlot(curDoc.available_slots[0]);
          }
        })
        .catch(() => {});
    }
  }, [selectedDate]);

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

  const handleSendFollowupMessage = async (e) => {
    e.preventDefault();
    if (!msgContent.trim() || !selectedSessionId) return;
    setSendingMsg(true);
    setFollowupStatusMsg(null);
    try {
      await followupAPI.sendMessage(selectedSessionId, {
        message_type: msgType,
        side_effect_severity: msgType === 'SIDE_EFFECT' ? sideEffectSeverity : null,
        severity: msgType === 'SIDE_EFFECT' ? sideEffectSeverity : null,
        content: msgContent.trim()
      });
      setMsgContent('');
      const updatedThread = await followupAPI.getThread(selectedSessionId);
      setActiveThread(updatedThread);
      setFollowupStatusMsg({
        type: 'success',
        text:
          msgType === 'SIDE_EFFECT'
            ? 'Adverse side-effect report securely transmitted to your prescribing doctor.'
            : 'Follow-up question sent to your prescribing doctor.'
      });
    } catch (err) {
      setFollowupStatusMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to send follow-up message.'
      });
    } finally {
      setSendingMsg(false);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedSlot) return;
    setBookingSubmitting(true);
    setBookingFeedback(null);
    try {
      const created = await appointmentAPI.book({
        doctor_id: selectedDoctorId,
        appointment_date: selectedDate,
        time_slot: selectedSlot,
        consultation_type: consultationType,
        reason: bookingReason
      });
      setActiveReceipt(created);
      setBookingFeedback({
        type: 'success',
        text: `Appointment ${created.appointment_id} booked! Digital QR receipt (${created.receipt_number}) generated below.`
      });
      const [appts, docs] = await Promise.all([
        appointmentAPI.list(),
        appointmentAPI.getDoctorsAndSlots(selectedDate)
      ]);
      setMyAppointments(Array.isArray(appts) ? appts : []);
      setDoctorsSlots(Array.isArray(docs) ? docs : []);
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to book appointment. Slot may already be taken.'
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    try {
      const updated = await appointmentAPI.updateStatus(
        appointmentId,
        'CANCELLED',
        'Cancelled by patient via Patient Portal'
      );
      if (activeReceipt?.appointment_id === appointmentId) {
        setActiveReceipt(updated);
      }
      const [appts, docs] = await Promise.all([
        appointmentAPI.list(),
        appointmentAPI.getDoctorsAndSlots(selectedDate)
      ]);
      setMyAppointments(Array.isArray(appts) ? appts : []);
      setDoctorsSlots(Array.isArray(docs) ? docs : []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Unable to cancel appointment.');
    }
  };

  const currentDoctorSlotObj =
    doctorsSlots.find((d) => d.doctor_id === selectedDoctorId) || doctorsSlots[0];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Activity className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
        <h2 className="text-base font-semibold text-slate-800">Loading Your Patient Portal...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving verified clinical records securely</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Welcome & Identity Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-800 to-teal-700 text-white rounded-2xl p-6 shadow-lg border border-emerald-700/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">
                  {user?.full_name || patientData?.name || 'Patient Portal'}
                </h1>
                <span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                  Patient
                </span>
                <span className="bg-white/15 text-white border border-white/25 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full">
                  {user?.user_id}
                </span>
                <span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full">
                  {patientId}
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                ChronoRx Patient Care Portal &bull; System ID: <span className="font-mono font-bold">{user?.user_id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={loadAllData}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              title="Refresh Records"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition text-white shadow-sm"
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
            <span className="text-emerald-200/80 block text-[11px]">3-Day Follow-Ups</span>
            <span className="font-semibold text-white">{followupSessions.length} consultation window(s)</span>
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
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Medication Schedule</span>
        </button>

        <button
          onClick={() => setActiveTab('followup')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'followup'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>3-Day Doctor Follow-Up</span>
          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
            Free 72h
          </span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'appointments'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Book Appointment &amp; QR Receipts ({myAppointments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
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
          <div className="md:col-span-2 clinical-card p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Personal Demographics &amp; Clinical Metrics</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Patient ID</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{patientData?.patient_id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Full Name</span>
                <span className="font-semibold text-slate-800 text-sm">{patientData?.name}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Contact Phone</span>
                <span className="font-semibold text-slate-800">{patientData?.phone || 'Not recorded'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Age / Gender</span>
                <span className="font-semibold text-slate-800">{patientData?.age} yrs &bull; {patientData?.gender}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Height / Weight</span>
                <span className="font-semibold text-slate-800">{patientData?.height} cm &bull; {patientData?.weight} kg</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Body Surface Area (BSA)</span>
                <span className="font-semibold text-slate-800">{patientData?.bsa ? `${patientData.bsa} m²` : 'Calculated'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Body Mass Index (BMI)</span>
                <span className="font-semibold text-slate-800">{patientData?.bmi || 'Calculated'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Registered Date</span>
                <span className="font-semibold text-slate-800">
                  {patientData?.created_at ? new Date(patientData.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase">Assigned Clinician</span>
                <span className="font-semibold text-slate-800 font-mono">{patientData?.assigned_doctor_id || 'DOC-1001'}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                <span className="font-bold text-rose-800 block text-[11px] uppercase tracking-wide">Known Allergies</span>
                <p className="text-rose-900 mt-1 font-medium">{patientData?.allergies || 'No known drug allergies reported.'}</p>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                <span className="font-bold text-amber-800 block text-[11px] uppercase tracking-wide">Existing Baseline Medications</span>
                <p className="text-amber-900 mt-1">{patientData?.existing_medications || 'None recorded.'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <UserProfileCard compact={false} />

            <div className="clinical-card p-5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Security &amp; Access Control</span>
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
            <div className="clinical-card p-12 text-center">
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
                  <div key={review.review_id} className="clinical-card p-5">
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

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveTab('followup')}
                          className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>3-Day Follow-Up</span>
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(review)}
                          disabled={downloadingId === review.review_id}
                          className="clinical-btn-primary"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{downloadingId === review.review_id ? 'Downloading...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </div>

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

                    <div className="mt-2 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Prescribed Medications ({meds.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {meds.map((m, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
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
            <div className="clinical-card p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Medication Schedule Available</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your daily medication schedule will appear here once your physician completes and approves your circadian dosing timetable.
              </p>
            </div>
          ) : (
            <div className="clinical-card overflow-hidden">
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
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
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

                    <div className="text-right text-xs">
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

      {/* ===================================================================== */}
      {/* TAB 4: 3-DAY FREE PATIENT-DOCTOR FOLLOW-UP (FEATURE 1)                */}
      {/* ===================================================================== */}
      {activeTab === 'followup' && (
        <div className="space-y-5">
          {/* Mandatory Non-Emergency Disclaimer Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <div className="font-bold uppercase tracking-wide text-[11px] text-amber-800">
                Post-Consultation Follow-Up Channel &mdash; Not for Emergency Medical Care
              </div>
              <p className="leading-relaxed">
                Every finalized consultation includes a complimentary <strong>3-day (72-hour)</strong> follow-up window to ask questions or report medication side effects directly to the doctor who treated you. After 72 hours, messaging automatically becomes read-only.{' '}
                <strong>If you are experiencing a medical emergency, chest pain, or severe allergic reaction, call emergency services immediately.</strong>
              </p>
            </div>
          </div>

          {followupSessions.length === 0 ? (
            <div className="clinical-card p-12 text-center space-y-3">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Active 3-Day Follow-Up Windows</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                A 3-day free follow-up communication window is automatically opened as soon as your consultation prescription is finalized by your doctor.
              </p>
              <button
                onClick={() => setActiveTab('appointments')}
                className="clinical-btn-primary mx-auto mt-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Book a Consultation Appointment</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Sidebar: Consultation Follow-Up Windows */}
              <div className="clinical-card p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>My Consultation Windows ({followupSessions.length})</span>
                </h3>
                <div className="space-y-2">
                  {followupSessions.map((sess) => {
                    const isSelected = sess.session_id === selectedSessionId;
                    return (
                      <button
                        key={sess.session_id}
                        onClick={() => setSelectedSessionId(sess.session_id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-400 shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {sess.doctor_name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap ${
                              sess.is_locked
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {sess.is_locked ? <Lock className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                            {sess.remaining_label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 truncate">
                          Diagnosis: {sess.diagnosis || 'Consultation Follow-Up'}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
                          <span>{sess.session_id}</span>
                          <span>Expires: {new Date(sess.follow_up_expires_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right 2 Columns: Thread & Patient Message / Side-Effect Form */}
              <div className="lg:col-span-2 clinical-card flex flex-col min-h-[500px]">
                {activeThread && (
                  <>
                    <div className="p-4 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {activeThread.session.doctor_name}
                          </span>
                          <span className="font-mono text-[11px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-bold">
                            {activeThread.session.doctor_id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Consultation Billed: {new Date(activeThread.session.billed_at).toLocaleString()} &bull; 72h Window Expires:{' '}
                          {new Date(activeThread.session.follow_up_expires_at).toLocaleString()}
                        </p>
                      </div>

                      <div
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                          activeThread.session.is_locked
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {activeThread.session.is_locked ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Expired &mdash; Read-Only</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{activeThread.session.remaining_label}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[340px]">
                      {activeThread.messages.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-400">
                          No messages yet. Ask a follow-up question or report any medication side effects below.
                        </div>
                      ) : (
                        activeThread.messages.map((msg) => {
                          const isPatient = msg.sender_role === 'patient';
                          const isSideEffect = msg.message_type === 'SIDE_EFFECT';
                          const sev = msg.side_effect_severity || msg.severity;
                          return (
                            <div
                              key={msg.message_id}
                              className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm border ${
                                  isSideEffect
                                    ? 'bg-rose-50 text-rose-950 border-rose-200'
                                    : isPatient
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3 mb-1">
                                  <span
                                    className={`font-bold text-[11px] ${
                                      isPatient && !isSideEffect ? 'text-emerald-100' : 'text-slate-700'
                                    }`}
                                  >
                                    {msg.sender_name}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                      isSideEffect
                                        ? 'bg-rose-200 text-rose-900'
                                        : isPatient
                                        ? 'bg-emerald-700 text-emerald-100'
                                        : 'bg-teal-100 text-teal-800'
                                    }`}
                                  >
                                    {isSideEffect
                                      ? `Side Effect${sev ? ` • ${sev}` : ''}`
                                      : isPatient
                                      ? 'My Question'
                                      : 'Doctor Reply'}
                                  </span>
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                <div
                                  className={`text-[10px] mt-1.5 text-right ${
                                    isPatient && !isSideEffect ? 'text-emerald-200' : 'text-slate-400'
                                  }`}
                                >
                                  {new Date(msg.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Composer or Locked State */}
                    <div className="p-4 border-t border-slate-200 bg-slate-50/60 rounded-b-2xl space-y-3">
                      {followupStatusMsg && (
                        <div
                          className={`p-2.5 rounded-xl text-xs border ${
                            followupStatusMsg.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          {followupStatusMsg.text}
                        </div>
                      )}

                      {activeThread.session.is_locked ? (
                        <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-700">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span>
                              Your 3-day free follow-up window has expired and is now locked in read-only mode.
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveTab('appointments')}
                            className="clinical-btn-primary whitespace-nowrap"
                          >
                            Book New Appointment
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleSendFollowupMessage} className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-slate-600 text-[11px] uppercase">Message Type:</span>
                            <button
                              type="button"
                              onClick={() => setMsgType('QUESTION')}
                              className={`px-3 py-1 rounded-lg font-semibold transition ${
                                msgType === 'QUESTION'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-slate-200 text-slate-600'
                              }`}
                            >
                              Follow-Up Question
                            </button>
                            <button
                              type="button"
                              onClick={() => setMsgType('SIDE_EFFECT')}
                              className={`px-3 py-1 rounded-lg font-semibold transition ${
                                msgType === 'SIDE_EFFECT'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white border border-slate-200 text-slate-600'
                              }`}
                            >
                              Report Adverse Side Effect
                            </button>

                            {msgType === 'SIDE_EFFECT' && (
                              <select
                                value={sideEffectSeverity}
                                onChange={(e) => setSideEffectSeverity(e.target.value)}
                                className="ml-auto rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800"
                              >
                                <option value="MILD">Severity: MILD</option>
                                <option value="MODERATE">Severity: MODERATE</option>
                                <option value="SEVERE">Severity: SEVERE</option>
                              </select>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={msgContent}
                              onChange={(e) => setMsgContent(e.target.value)}
                              placeholder={
                                msgType === 'SIDE_EFFECT'
                                  ? 'Describe the side effect, timing after dose, and severity...'
                                  : 'Ask your prescribing doctor a follow-up question about your medication...'
                              }
                              className="clinical-input flex-1"
                              required
                            />
                            <button
                              type="submit"
                              disabled={sendingMsg || !msgContent.trim()}
                              className="clinical-btn-primary whitespace-nowrap"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{sendingMsg ? 'Sending...' : 'Send'}</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: APPOINTMENT BOOKING & DIGITAL QR RECEIPT (FEATURE 2)           */}
      {/* ===================================================================== */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Book an Appointment */}
            <div className="clinical-card p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Book Clinical Appointment</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an available physician and time slot. A digital receipt with a privacy-preserving QR check-in code is generated automatically.
                </p>
              </div>

              <form onSubmit={handleBookAppointment} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Select Attending Physician
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => {
                      setSelectedDoctorId(e.target.value);
                      const docObj = doctorsSlots.find((d) => d.doctor_id === e.target.value);
                      if (docObj?.available_slots?.length > 0) {
                        setSelectedSlot(docObj.available_slots[0]);
                      }
                    }}
                    className="clinical-input"
                    required
                  >
                    {doctorsSlots.map((doc) => (
                      <option key={doc.doctor_id} value={doc.doctor_id}>
                        {doc.doctor_name} &mdash; {doc.department} ({doc.available_slots.length} slots open)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="clinical-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Consultation Mode
                    </label>
                    <select
                      value={consultationType}
                      onChange={(e) => setConsultationType(e.target.value)}
                      className="clinical-input"
                    >
                      <option value="IN_PERSON">In-Clinic Consultation</option>
                      <option value="TELEHEALTH">Telehealth / Video Consult</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Time Slot Grid */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                    Select Available Time Slot
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      ...(currentDoctorSlotObj?.available_slots || []),
                      ...(currentDoctorSlotObj?.booked_slots || [])
                    ].map((slot) => {
                      const isBooked = (currentDoctorSlotObj?.booked_slots || []).includes(slot);
                      const isChosen = selectedSlot === slot && !isBooked;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBooked}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition ${
                            isBooked
                              ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed'
                              : isChosen
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Reason for Visit
                  </label>
                  <input
                    type="text"
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                    className="clinical-input"
                    placeholder="Brief reason for clinical consultation..."
                  />
                </div>

                {bookingFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      bookingFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {bookingFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={bookingSubmitting || !selectedDoctorId || !selectedSlot}
                  className="clinical-btn-primary w-full py-3"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {bookingSubmitting
                      ? 'Confirming Slot & Generating QR Receipt...'
                      : 'Confirm Booking & Generate QR Receipt'}
                  </span>
                </button>
              </form>
            </div>

            {/* Right Card: Digital QR Appointment Receipt */}
            <div className="clinical-card p-6 flex flex-col justify-between space-y-4">
              {!activeReceipt ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <QrCode className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-600">No Appointment Receipt Selected</p>
                  <p className="text-xs mt-1 max-w-xs">
                    Book an appointment on the left to receive your digital appointment receipt and check-in QR code.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        ChronoRx Official Digital Receipt
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 font-mono">
                        {activeReceipt.receipt_number}
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        activeReceipt.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeReceipt.status === 'CANCELLED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {activeReceipt.status}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    {activeReceipt.qr_svg_data_uri && (
                      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex-shrink-0">
                        <img
                          src={activeReceipt.qr_svg_data_uri}
                          alt={`Appointment QR ${activeReceipt.appointment_id}`}
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                    )}

                    <div className="space-y-2 text-xs flex-1">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Appointment ID</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {activeReceipt.appointment_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Attending Physician</span>
                        <span className="font-bold text-slate-800">{activeReceipt.doctor_name}</span>
                        <span className="block text-[11px] text-slate-500">{activeReceipt.department}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 block">Date</span>
                          <span className="font-bold text-slate-800">{activeReceipt.appointment_date}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 block">Time Slot</span>
                          <span className="font-bold text-emerald-700">{activeReceipt.time_slot}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zero-PII QR Security Notice */}
                  <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl text-[11px] text-teal-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-teal-800">
                      <ShieldCheck className="w-4 h-4 text-teal-600" />
                      <span>Zero-PII Encrypted Verification Token</span>
                    </div>
                    <p className="text-teal-800/90 leading-relaxed">
                      For your privacy, this QR code contains <strong>no personal health information, name, or phone number</strong>. Receptionists scan this opaque token to verify your slot:
                    </p>
                    <code className="block bg-white/90 px-2.5 py-1 rounded border border-teal-200 font-mono text-[10px] text-slate-700 break-all">
                      {activeReceipt.qr_payload}
                    </code>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChronoRx Receipt ${activeReceipt.receipt_number}</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a;max-width:540px;margin:0 auto}.card{border:2px solid #0d9488;border-radius:16px;padding:24px;background:#f8fafc}.code{font-family:monospace;background:#e2e8f0;padding:6px 10px;border-radius:8px;font-size:12px;word-break:break-all}</style></head><body><div class="card"><h2>ChronoRx Digital Appointment Receipt</h2><p><strong>Receipt #:</strong> ${activeReceipt.receipt_number}</p><p><strong>Appointment ID:</strong> ${activeReceipt.appointment_id}</p><p><strong>Status:</strong> ${activeReceipt.status}</p><p><strong>Doctor:</strong> ${activeReceipt.doctor_name} (${activeReceipt.department})</p><p><strong>Date &amp; Time:</strong> ${activeReceipt.appointment_date} at ${activeReceipt.time_slot}</p><div style="margin:16px 0"><img src="${activeReceipt.qr_svg_data_uri}" width="160" height="160" alt="QR Verification Code"/></div><p style="font-size:12px;color:#0f766e"><strong>Zero-PII Verification Token:</strong></p><div class="code">${activeReceipt.qr_payload}</div></div></body></html>`;
                          const blob = new Blob([receiptHtml], { type: 'text/html' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `ChronoRx_Receipt_${activeReceipt.receipt_number}.html`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        }}
                        className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Receipt</span>
                      </button>
                    </div>

                    {activeReceipt.status !== 'CANCELLED' && activeReceipt.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(activeReceipt.appointment_id)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Appointment</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* List of Patient's Appointments */}
          {myAppointments.length > 0 && (
            <div className="clinical-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                My Appointments History ({myAppointments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {myAppointments.map((appt) => (
                  <button
                    key={appt.appointment_id}
                    onClick={() => setActiveReceipt(appt)}
                    className={`text-left p-3.5 rounded-xl border text-xs transition ${
                      activeReceipt?.appointment_id === appt.appointment_id
                        ? 'bg-emerald-50/90 border-emerald-400 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{appt.appointment_id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          appt.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : appt.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 mt-1">{appt.doctor_name}</div>
                    <div className="text-[11px] text-slate-500">
                      {appt.appointment_date} &bull; {appt.time_slot}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 mt-1">{appt.receipt_number}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MEDICAL HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-600" />
              <span>My Medical History &amp; Clinical Consultations</span>
            </h2>
            <span className="text-xs text-slate-500">Official active medical records</span>
          </div>

          <div className="clinical-card p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Chronic Conditions &amp; Background
              </h3>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-800 leading-relaxed">
                {patientData?.medical_history || 'No chronic background conditions recorded.'}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Consultation Records ({historyEntries.length})
              </h3>
              {historyEntries.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                  No individual consultation entries recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry) => (
                    <div key={entry.entry_id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
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
