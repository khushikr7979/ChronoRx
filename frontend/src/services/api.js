import axios from 'axios';

// Base API configuration:
// 1. In production: uses import.meta.env.VITE_API_BASE_URL (e.g. 'https://api.chronorx.tech')
// 2. In local development: defaults to '' so requests are transparently routed via the Vite dev proxy
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).trim() : '';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const getFullAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('chronorx_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or unauthorized
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('chronorx_token');
        localStorage.removeItem('chronorx_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth Endpoints ---
export const authAPI = {
  login: async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  getStaff: async (role) => {
    const res = await api.get('/auth/staff', { params: role ? { role } : {} });
    return res.data;
  },
};

// --- Patient Endpoints ---
export const patientAPI = {
  list: async (params = {}) => {
    const res = await api.get('/patients', { params });
    return res.data;
  },
  getQueue: async (statusFilter = null) => {
    const res = await api.get('/patients/queue', {
      params: statusFilter ? { status_filter: statusFilter } : {},
    });
    return res.data;
  },
  get: async (patientId) => {
    const res = await api.get(`/patients/${patientId}`);
    return res.data;
  },
  create: async (patientData) => {
    const res = await api.post('/patients', patientData);
    return res.data;
  },
  updateStatus: async (patientId, data) => {
    const res = await api.put(`/patients/${patientId}/status`, data);
    return res.data;
  },
};

// --- Scan & OCR Endpoints ---
export const scanAPI = {
  upload: async (fileBlob, filename, patientId) => {
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('patient_id', patientId || 'P-1001');
    const res = await api.post('/scan/upload', formData, {
      headers: {
        'Content-Type': undefined, // Let browser set boundary automatically
      },
    });
    return res.data;
  },
  runOCR: async (scanId, options = {}) => {
    const res = await api.post('/scan/ocr', {
      scan_id: scanId,
      options: {
        rotate_deg: options.rotate_deg || 0,
        enhance_contrast: options.enhance_contrast ?? true,
        denoise: options.denoise ?? true,
      },
    });
    return res.data;
  },
  extract: async (scanId, patientId, editedText) => {
    const res = await api.post('/scan/extract', {
      scan_id: scanId,
      patient_id: patientId,
      edited_text: editedText,
    });
    return res.data;
  },
  delete: async (scanId, reason = 'Wrong document uploaded') => {
    const res = await api.delete(`/scan/${scanId}`, { params: { reason } });
    return res.data;
  },
  listForPatient: async (patientId) => {
    const res = await api.get(`/scan/patient/${patientId}`);
    return res.data;
  },
};

// --- Drugs Endpoints ---
export const drugAPI = {
  normalize: async (drugNames) => {
    const res = await api.post('/drugs/normalize', { drug_names: drugNames });
    return res.data;
  },
  reference: async (drugName) => {
    const res = await api.post('/drugs/reference', { drug_name: drugName });
    return res.data;
  },
};

// --- Medication Endpoints ---
export const medicationAPI = {
  list: async (patientId) => {
    const res = await api.get(`/medications/${patientId}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/medications', data);
    return res.data;
  },
  update: async (medicationId, data) => {
    const res = await api.put(`/medications/${medicationId}`, data);
    return res.data;
  },
  delete: async (medicationId) => {
    const res = await api.delete(`/medications/${medicationId}`);
    return res.data;
  },
};

// --- Dose / Posology Endpoints ---
export const doseAPI = {
  analyze: async (data) => {
    const res = await api.post('/dose/analyze', data);
    return res.data;
  },
};

export const posologyAPI = {
  analyze: async (data) => {
    const res = await api.post('/posology/analyze', data);
    return res.data;
  },
};

// --- Interaction Endpoints ---
export const interactionAPI = {
  check: async (drugs, patientId) => {
    const res = await api.post('/interactions/check', {
      drugs,
      patient_id: patientId,
    });
    return res.data;
  },
};

// --- Schedule Endpoints ---
export const scheduleAPI = {
  generate: async (medications, patientId) => {
    const res = await api.post('/schedule/generate', {
      medications,
      patient_id: patientId,
    });
    return res.data;
  },
  approve: async (patientId, timetable) => {
    const res = await api.post('/schedule/approve', {
      patient_id: patientId,
      timetable,
    });
    return res.data;
  },
  getForPatient: async (patientId) => {
    const res = await api.get(`/schedule/patient/${patientId}`);
    return res.data;
  },
  update: async (scheduleId, data) => {
    const res = await api.put(`/schedule/${scheduleId}`, data);
    return res.data;
  },
};

// --- Clinical Summary Endpoints ---
export const summaryAPI = {
  generate: async (data) => {
    const res = await api.post('/clinical-summary/generate', data);
    return res.data;
  },
};

// --- Prescription & PDF Endpoints ---
export const prescriptionAPI = {
  generate: async (data) => {
    const res = await api.post('/prescription/generate', data);
    return res.data;
  },
  listForPatient: async (patientId) => {
    const res = await api.get(`/prescriptions/${patientId}`);
    return res.data;
  },
  downloadPdf: async (reviewId, filename = 'Prescription.pdf') => {
    const res = await api.get(`/prescription/${reviewId}/download`, {
      responseType: 'blob'
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  sendById: async (prescriptionId, params = {}) => {
    const res = await api.post(`/prescriptions/${prescriptionId}/send`, null, { params });
    return res.data;
  },
  deliver: async (data) => {
    const res = await api.post('/prescription/deliver', data);
    return res.data;
  },
  logDownload: async (patientId, reviewId) => {
    const res = await api.post('/prescription/log-download', null, {
      params: { patient_id: patientId, review_id: reviewId },
    });
    return res.data;
  },
  logPrint: async (patientId, reviewId) => {
    const res = await api.post('/prescription/log-print', null, {
      params: { patient_id: patientId, review_id: reviewId },
    });
    return res.data;
  },
  archive: async (reviewId, reason, targetStatus = 'ARCHIVED') => {
    const res = await api.patch(`/prescriptions/${reviewId}/archive`, null, {
      params: { reason, target_status: targetStatus }
    });
    return res.data;
  },
};

// --- Patient History Endpoints ---
export const historyAPI = {
  list: async (patientId, includeArchived = false) => {
    const res = await api.get(`/patient-history/${patientId}`, {
      params: { include_archived: includeArchived }
    });
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/patient-history', data);
    return res.data;
  },
  archive: async (entryId, reason, targetStatus = 'ARCHIVED', patientId = null) => {
    const res = await api.patch(`/patient-history/${entryId}/archive`, {
      reason,
      target_status: targetStatus
    }, {
      params: patientId ? { patient_id: patientId } : {}
    });
    return res.data;
  },
  delete: async (entryId, reason = 'Draft removed', patientId = null) => {
    const res = await api.delete(`/patient-history/${entryId}`, {
      params: { reason, ...(patientId ? { patient_id: patientId } : {}) }
    });
    return res.data;
  },
};

// --- 3-Day Patient-Doctor Follow-Up Endpoints ---
export const followupAPI = {
  list: async (patientId = null) => {
    const res = await api.get('/followups', {
      params: patientId ? { patient_id: patientId } : {}
    });
    return res.data;
  },
  initiate: async (data) => {
    const res = await api.post('/followups/initiate', data);
    return res.data;
  },
  getThread: async (sessionId) => {
    const res = await api.get(`/followups/${sessionId}`);
    return res.data;
  },
  sendMessage: async (sessionId, data) => {
    const res = await api.post(`/followups/${sessionId}/messages`, data);
    return res.data;
  },
};

// --- Appointment Booking & QR Receipt Endpoints ---
export const appointmentAPI = {
  getDoctorsAndSlots: async (date = null, doctorId = null) => {
    const params = {};
    if (date) params.date = date;
    if (doctorId) params.doctor_id = doctorId;
    const res = await api.get('/appointments/doctors', { params });
    return res.data;
  },
  book: async (data) => {
    const res = await api.post('/appointments/book', data);
    return res.data;
  },
  list: async (params = {}) => {
    const res = await api.get('/appointments', { params });
    return res.data;
  },
  getReceipt: async (appointmentId) => {
    const res = await api.get(`/appointments/${appointmentId}/receipt`);
    return res.data;
  },
  verifyQR: async (qrData, markConfirmed = true) => {
    const res = await api.post('/appointments/verify-qr', {
      qr_data: qrData,
      mark_confirmed: markConfirmed,
      confirm_checkin: markConfirmed,
    });
    return res.data;
  },
  updateStatus: async (appointmentId, status, reason = null) => {
    const res = await api.patch(`/appointments/${appointmentId}/status`, {
      status,
      reason,
    });
    return res.data;
  },
};

// --- Audit & Dashboard Endpoints ---
export const auditAPI = {
  getPatientAudit: async (patientId) => {
    const res = await api.get(`/audit/${patientId}`);
    return res.data;
  },
  getAll: async () => {
    const res = await api.get('/audit');
    return res.data;
  },
  getMetrics: async () => {
    const res = await api.get('/dashboard/metrics');
    return res.data;
  },
};

export default api;

