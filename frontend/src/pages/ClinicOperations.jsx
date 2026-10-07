import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import { followupAPI, appointmentAPI } from '../services/api';
import {
  MessageSquare,
  QrCode,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Send,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  Stethoscope,
  XCircle,
  PlusCircle,
  FileCheck,
  Sparkles,
  Search
} from 'lucide-react';

const ClinicOperations = () => {
  const { user } = useAuth();
  const { selectedPatient, patientsList } = usePatient();

  // Default tab: Receptionists start on QR & Appointments Desk; Doctors/Admins start on 3-Day Follow-Up Console
  const [activeSection, setActiveSection] = useState(
    user?.role === 'receptionist' ? 'appointments' : 'followups'
  );

  // --- Follow-Up State (Doctor / Admin) ---
  const [followupSessions, setFollowupSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [followupFeedback, setFollowupFeedback] = useState(null);

  // Initiate Follow-up Modal/Form
  const [initiatePatientId, setInitiatePatientId] = useState(selectedPatient?.patient_id || '');
  const [initiateDiagnosis, setInitiateDiagnosis] = useState('');
  const [initiatingWindow, setInitiatingWindow] = useState(false);

  // --- Appointments & QR Verification State ---
  const [appointments, setAppointments] = useState([]);
  const [doctorsSlots, setDoctorsSlots] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [autoConfirmOnScan, setAutoConfirmOnScan] = useState(true);
  const [qrVerifyResult, setQrVerifyResult] = useState(null);
  const [qrVerifyError, setQrVerifyError] = useState(null);
  const [verifyingQr, setVerifyingQr] = useState(false);

  // Staff Booking Form State
  const [bookPatientId, setBookPatientId] = useState(selectedPatient?.patient_id || '');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookSlot, setBookSlot] = useState('');
  const [bookReason, setBookReason] = useState('Scheduled Chronotherapy & Medication Review');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState(null);
  const [selectedReceiptAppt, setSelectedReceiptAppt] = useState(null);

  useEffect(() => {
    if (selectedPatient?.patient_id) {
      setInitiatePatientId(selectedPatient.patient_id);
      setBookPatientId(selectedPatient.patient_id);
    }
  }, [selectedPatient]);

  const loadFollowups = async () => {
    if (user?.role === 'receptionist') return;
    setLoadingFollowups(true);
    try {
      const list = await followupAPI.list();
      const arr = Array.isArray(list) ? list : [];
      setFollowupSessions(arr);
      if (arr.length > 0 && !selectedSessionId) {
        setSelectedSessionId(arr[0].session_id);
      }
    } catch (err) {
      console.warn('Error loading follow-up sessions:', err);
    } finally {
      setLoadingFollowups(false);
    }
  };

  const loadThread = async (sessionId) => {
    if (!sessionId || user?.role === 'receptionist') return;
    try {
      const data = await followupAPI.getThread(sessionId);
      setActiveThread(data);
    } catch (err) {
      setFollowupFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Unable to load follow-up conversation thread.'
      });
    }
  };

  const loadAppointmentsAndSlots = async () => {
    setLoadingAppointments(true);
    try {
      const [apptList, docList] = await Promise.all([
        appointmentAPI.list(),
        appointmentAPI.getDoctorsAndSlots(bookDate)
      ]);
      setAppointments(Array.isArray(apptList) ? apptList : []);
      const docs = Array.isArray(docList) ? docList : [];
      setDoctorsSlots(docs);
      if (docs.length > 0 && !bookDoctorId) {
        setBookDoctorId(docs[0].doctor_id);
        if (docs[0].available_slots?.length > 0) {
          setBookSlot(docs[0].available_slots[0]);
        }
      }
    } catch (err) {
      console.warn('Error loading appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    loadFollowups();
    loadAppointmentsAndSlots();
  }, [user?.role]);

  useEffect(() => {
    if (selectedSessionId && user?.role !== 'receptionist') {
      loadThread(selectedSessionId);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    if (bookDate) {
      appointmentAPI.getDoctorsAndSlots(bookDate).then((docs) => {
        if (Array.isArray(docs)) {
          setDoctorsSlots(docs);
        }
      }).catch(() => {});
    }
  }, [bookDate]);

  const handleInitiateFollowup = async (e) => {
    e.preventDefault();
    if (!initiatePatientId) return;
    setInitiatingWindow(true);
    setFollowupFeedback(null);
    try {
      const created = await followupAPI.initiate({
        patient_id: initiatePatientId,
        diagnosis: initiateDiagnosis || undefined,
      });
      setFollowupFeedback({
        type: 'success',
        text: `3-Day Follow-Up window (${created.session_id}) activated for patient ${created.patient_id}.`
      });
      await loadFollowups();
      setSelectedSessionId(created.session_id);
      await loadThread(created.session_id);
    } catch (err) {
      setFollowupFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Could not initiate follow-up window.'
      });
    } finally {
      setInitiatingWindow(false);
    }
  };

  const handleSendDoctorReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedSessionId) return;
    setSendingReply(true);
    setFollowupFeedback(null);
    try {
      await followupAPI.sendMessage(selectedSessionId, {
        message_type: 'DOCTOR_REPLY',
        content: replyText.trim(),
      });
      setReplyText('');
      await loadThread(selectedSessionId);
      await loadFollowups();
    } catch (err) {
      setFollowupFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to send clinician reply.'
      });
    } finally {
      setSendingReply(false);
    }
  };

  const handleVerifyQr = async (e, overrideQrPayload = null) => {
    if (e) e.preventDefault();
    const tokenToVerify = (overrideQrPayload ?? qrInput).trim();
    if (!tokenToVerify) return;
    if (overrideQrPayload) setQrInput(overrideQrPayload);

    setVerifyingQr(true);
    setQrVerifyError(null);
    setQrVerifyResult(null);
    try {
      const result = await appointmentAPI.verifyQR(tokenToVerify, autoConfirmOnScan);
      setQrVerifyResult(result);
      await loadAppointmentsAndSlots();
    } catch (err) {
      setQrVerifyError(err.response?.data?.detail || 'Invalid or unrecognized QR verification token.');
    } finally {
      setVerifyingQr(false);
    }
  };

  const handleStaffBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookPatientId || !bookDoctorId || !bookDate || !bookSlot) return;
    setBookingLoading(true);
    setBookingMessage(null);
    try {
      const created = await appointmentAPI.book({
        patient_id: bookPatientId,
        doctor_id: bookDoctorId,
        appointment_date: bookDate,
        time_slot: bookSlot,
        reason: bookReason,
      });
      setBookingMessage({
        type: 'success',
        text: `Booked ${created.appointment_id} (${created.receipt_number}) for ${created.patient_id} on ${created.appointment_date} at ${created.time_slot}.`
      });
      setSelectedReceiptAppt(created);
      await loadAppointmentsAndSlots();
    } catch (err) {
      setBookingMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Could not book appointment.'
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleUpdateApptStatus = async (appointmentId, newStatus) => {
    try {
      const updated = await appointmentAPI.updateStatus(
        appointmentId,
        newStatus,
        newStatus === 'CANCELLED' ? 'Cancelled at clinic desk' : undefined
      );
      if (selectedReceiptAppt?.appointment_id === appointmentId) {
        setSelectedReceiptAppt(updated);
      }
      await loadAppointmentsAndSlots();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update appointment status.');
    }
  };

  const currentDoctorSlotObj = doctorsSlots.find((d) => d.doctor_id === bookDoctorId) || doctorsSlots[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-900 text-white rounded-2xl p-6 shadow-lg border border-teal-700/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Post-Consultation Follow-Up &amp; QR Appointment Desk
                </h1>
                <span className="bg-teal-400/20 text-teal-200 border border-teal-400/30 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                  {user?.role} Console
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Manage 72-hour post-billing patient-doctor follow-up threads, schedule appointments, and verify zero-PII QR receipts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.role !== 'receptionist' && (
              <button
                onClick={() => setActiveSection('followups')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  activeSection === 'followups'
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>3-Day Follow-Ups ({followupSessions.length})</span>
              </button>
            )}
            <button
              onClick={() => setActiveSection('appointments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeSection === 'appointments'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>QR Verification &amp; Appointments ({appointments.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: 3-DAY FREE PATIENT-DOCTOR FOLLOW-UP CONSOLE (DOCTOR/ADMIN) */}
      {/* ===================================================================== */}
      {activeSection === 'followups' && user?.role !== 'receptionist' && (
        <div className="space-y-6">
          {/* Non-emergency clinical banner + Initiate follow-up bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <div className="font-bold uppercase tracking-wide text-[11px] text-amber-800">
                  72-Hour Post-Consultation Follow-Up Governance
                </div>
                <p className="leading-relaxed">
                  Follow-up windows are automatically created when an E-Prescription is finalized and billed, granting the patient <strong>3 days (72 hours)</strong> of direct messaging with their prescribing physician only. After 72 hours, the channel automatically locks into read-only mode.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleInitiateFollowup}
              className="clinical-card p-4 flex flex-col justify-between gap-2"
            >
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-teal-600" />
                  Activate 3-Day Window
                </span>
                <span className="text-[10px] font-mono text-slate-400">72h Access</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={initiatePatientId}
                  onChange={(e) => setInitiatePatientId(e.target.value)}
                  className="clinical-input py-1.5 text-xs flex-1"
                  required
                >
                  <option value="">Select Patient...</option>
                  {patientsList.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.patient_id} — {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={initiatingWindow || !initiatePatientId}
                  className="clinical-btn-primary py-1.5 px-3 whitespace-nowrap"
                >
                  {initiatingWindow ? 'Activating...' : 'Start 3-Day Window'}
                </button>
              </div>
            </form>
          </div>

          {followupFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
                followupFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>{followupFeedback.text}</span>
              <button
                onClick={() => setFollowupFeedback(null)}
                className="text-[11px] underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Follow-Up Sessions List */}
            <div className="clinical-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-teal-600" />
                  <span>Patient Follow-Up Windows</span>
                </h2>
                <button
                  onClick={loadFollowups}
                  className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-50"
                  title="Refresh Follow-Ups"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFollowups ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {followupSessions.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No 3-day follow-up sessions yet. Finalize an E-Prescription or use &ldquo;Start 3-Day Window&rdquo; above.
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {followupSessions.map((sess) => {
                    const isSelected = sess.session_id === selectedSessionId;
                    return (
                      <button
                        key={sess.session_id}
                        onClick={() => setSelectedSessionId(sess.session_id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-teal-50/90 border-teal-400 shadow-sm'
                            : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-teal-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {sess.patient_name || sess.patient_id}{' '}
                            <span className="text-teal-700">({sess.patient_id})</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
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
                          Dx: {sess.diagnosis || 'Post-Consultation Follow-Up'}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
                          <span>{sess.session_id}</span>
                          <span>Dr: {sess.doctor_name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 2 Columns: Active Follow-Up Thread & Clinician Reply Box */}
            <div className="lg:col-span-2 clinical-card flex flex-col min-h-[520px]">
              {!activeThread ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Select a Follow-Up Session</p>
                  <p className="text-xs mt-1 max-w-sm">
                    Choose a patient follow-up window on the left to inspect questions, adverse side-effect reports, and send clinician guidance.
                  </p>
                </div>
              ) : (
                <>
                  {/* Thread Header */}
                  <div className="p-4 border-b border-slate-200 bg-slate-50/70 rounded-t-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {activeThread.session.patient_name || activeThread.session.patient_id}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                          {activeThread.session.patient_id}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {activeThread.session.session_id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Associated Doctor: <strong>{activeThread.session.doctor_name}</strong> ({activeThread.session.doctor_id}) &bull; Billed:{' '}
                        {new Date(activeThread.session.billed_at).toLocaleString()}
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
                          <span>Window Expired (Read-Only)</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{activeThread.session.remaining_label}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[360px]">
                    {activeThread.messages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No follow-up messages or side-effect reports have been posted in this 3-day window yet.
                      </div>
                    ) : (
                      activeThread.messages.map((msg) => {
                        const isDoctor = msg.sender_role === 'doctor' || msg.message_type === 'DOCTOR_REPLY';
                        const isSideEffect = msg.message_type === 'SIDE_EFFECT';
                        const sev = msg.side_effect_severity || msg.severity;
                        return (
                          <div
                            key={msg.message_id}
                            className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm border ${
                                isDoctor
                                  ? 'bg-teal-600 text-white border-teal-700'
                                  : isSideEffect
                                  ? 'bg-rose-50 text-rose-950 border-rose-200'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span className={`font-bold text-[11px] ${isDoctor ? 'text-teal-100' : 'text-slate-700'}`}>
                                  {msg.sender_name} ({msg.sender_id})
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    isDoctor
                                      ? 'bg-teal-700 text-teal-100'
                                      : isSideEffect
                                      ? 'bg-rose-200 text-rose-900'
                                      : 'bg-white text-slate-600'
                                  }`}
                                >
                                  {isSideEffect
                                    ? `Adverse Side Effect${sev ? ` • ${sev}` : ''}`
                                    : isDoctor
                                    ? 'Clinician Reply'
                                    : 'Follow-Up Question'}
                                </span>
                              </div>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <div
                                className={`text-[10px] mt-1.5 text-right ${
                                  isDoctor ? 'text-teal-200' : 'text-slate-400'
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

                  {/* Reply Composer */}
                  <div className="p-4 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl">
                    {activeThread.session.is_locked ? (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span>
                          This 3-day post-consultation follow-up window expired on{' '}
                          <strong>{new Date(activeThread.session.follow_up_expires_at).toLocaleString()}</strong>.
                          Messaging is locked in read-only mode for audit compliance.
                        </span>
                      </div>
                    ) : (
                      <form onSubmit={handleSendDoctorReply} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write clinical follow-up guidance or side-effect instructions..."
                          className="clinical-input flex-1"
                          required
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim()}
                          className="clinical-btn-primary whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{sendingReply ? 'Sending...' : 'Send Doctor Reply'}</span>
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: QR RECEIPT VERIFICATION & APPOINTMENT DESK                 */}
      {/* ===================================================================== */}
      {activeSection === 'appointments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Receptionist QR Verification Scanner / Token Validator */}
            <div className="clinical-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-teal-600" />
                    <span>Receptionist QR Receipt Verification</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Validate opaque appointment QR tokens without exposing patient PII in the QR payload.
                  </p>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Zero-PII QR
                </span>
              </div>

              <form onSubmit={(e) => handleVerifyQr(e)} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Scan or Paste QR Payload / Verification Token / Receipt #
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="e.g. CRX-APT:APT-1001:CRX-VRF-... or RCP-..."
                      className="clinical-input font-mono flex-1"
                    />
                    <button
                      type="submit"
                      disabled={verifyingQr || !qrInput.trim()}
                      className="clinical-btn-primary whitespace-nowrap"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{verifyingQr ? 'Verifying...' : 'Verify QR'}</span>
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConfirmOnScan}
                    onChange={(e) => setAutoConfirmOnScan(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Automatically mark appointment status as <strong>CONFIRMED</strong> upon valid QR verification</span>
                </label>
              </form>

              {qrVerifyError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5">
                  <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <div>
                    <div className="font-bold">QR Verification Failed</div>
                    <div>{qrVerifyError}</div>
                  </div>
                </div>
              )}

              {qrVerifyResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-3 ${
                    qrVerifyResult.valid
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {qrVerifyResult.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                      <span>
                        {qrVerifyResult.valid
                          ? 'QR Receipt Verified & Authentic'
                          : `Verification Status: ${qrVerifyResult.verification_status}`}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-white/80 border border-emerald-200">
                      {qrVerifyResult.appointment_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Appointment ID</span>
                      <span className="font-mono font-bold text-slate-800">{qrVerifyResult.appointment_id}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Receipt #</span>
                      <span className="font-mono font-bold text-slate-800">{qrVerifyResult.receipt_number}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Patient Ref</span>
                      <span className="font-semibold text-slate-800">
                        {qrVerifyResult.patient_display_ref || qrVerifyResult.patient_id}
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Attending Doctor</span>
                      <span className="font-semibold text-slate-800">{qrVerifyResult.doctor_name}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Scheduled Slot</span>
                      <span className="font-semibold text-slate-800">
                        {qrVerifyResult.appointment_date} &bull; {qrVerifyResult.time_slot}
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Verified By</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {qrVerifyResult.verified_by || user?.user_id}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium">{qrVerifyResult.message}</p>
                </div>
              )}
            </div>

            {/* Card 2: Clinic Desk Appointment Booking */}
            <div className="clinical-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>Schedule Patient Appointment</span>
              </h2>

              <form onSubmit={handleStaffBookAppointment} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Patient
                    </label>
                    <select
                      value={bookPatientId}
                      onChange={(e) => setBookPatientId(e.target.value)}
                      className="clinical-input"
                      required
                    >
                      <option value="">Select Patient...</option>
                      {patientsList.map((p) => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.patient_id} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Doctor
                    </label>
                    <select
                      value={bookDoctorId}
                      onChange={(e) => {
                        setBookDoctorId(e.target.value);
                        const docObj = doctorsSlots.find((d) => d.doctor_id === e.target.value);
                        if (docObj?.available_slots?.length > 0) {
                          setBookSlot(docObj.available_slots[0]);
                        }
                      }}
                      className="clinical-input"
                      required
                    >
                      {doctorsSlots.map((d) => (
                        <option key={d.doctor_id} value={d.doctor_id}>
                          {d.doctor_name} ({d.doctor_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Appointment Date
                    </label>
                    <input
                      type="date"
                      value={bookDate}
                      onChange={(e) => setBookDate(e.target.value)}
                      className="clinical-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Available Time Slot
                    </label>
                    <select
                      value={bookSlot}
                      onChange={(e) => setBookSlot(e.target.value)}
                      className="clinical-input"
                      required
                    >
                      {(currentDoctorSlotObj?.available_slots || []).map((slot) => (
                        <option key={slot} value={slot}>
                          {slot} (Available)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Consultation Reason
                  </label>
                  <input
                    type="text"
                    value={bookReason}
                    onChange={(e) => setBookReason(e.target.value)}
                    className="clinical-input"
                  />
                </div>

                {bookingMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      bookingMessage.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {bookingMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={bookingLoading || !bookPatientId || !bookDoctorId || !bookSlot}
                  className="clinical-btn-primary w-full"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{bookingLoading ? 'Booking & Generating QR Receipt...' : 'Book Appointment & Issue QR Receipt'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Appointments Roster Table */}
          <div className="clinical-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-600" />
                <span>Clinic Appointment &amp; QR Check-In Registry ({appointments.length})</span>
              </h3>
              <button
                onClick={loadAppointmentsAndSlots}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 rounded-lg flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAppointments ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No appointments scheduled yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                      <th className="py-2.5 px-3">Appointment / Receipt</th>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Doctor</th>
                      <th className="py-2.5 px-3">Date &amp; Slot</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments.map((appt) => (
                      <tr key={appt.appointment_id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900">{appt.appointment_id}</div>
                          <div className="font-mono text-[10px] text-slate-400">{appt.receipt_number}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">{appt.patient_name || appt.patient_id}</div>
                          <div className="font-mono text-[10px] text-teal-700">{appt.patient_id}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">{appt.doctor_name}</div>
                          <div className="text-[10px] text-slate-400">{appt.department}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">{appt.appointment_date}</div>
                          <div className="text-[11px] text-teal-700 font-medium">{appt.time_slot}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              appt.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : appt.status === 'COMPLETED'
                                ? 'bg-teal-100 text-teal-800'
                                : appt.status === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {appt.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            onClick={() => handleVerifyQr(null, appt.qr_payload)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] transition"
                            title="Verify QR Token & Check-In"
                          >
                            Verify QR
                          </button>
                          {appt.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleUpdateApptStatus(appt.appointment_id, 'COMPLETED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] transition"
                            >
                              Complete
                            </button>
                          )}
                          {appt.status === 'BOOKED' && (
                            <button
                              onClick={() => handleUpdateApptStatus(appt.appointment_id, 'NO_SHOW')}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] transition"
                            >
                              No-Show
                            </button>
                          )}
                          {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleUpdateApptStatus(appt.appointment_id, 'CANCELLED')}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicOperations;
