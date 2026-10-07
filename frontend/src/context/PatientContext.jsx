import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { patientAPI } from '../services/api';
import { useAuth } from './AuthContext';

const PatientContext = createContext(null);

export const PatientProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientsList, setPatientsList] = useState([]);
  const [doctorQueue, setDoctorQueue] = useState([]);
  const [activeScan, setActiveScan] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [currentMedicines, setCurrentMedicines] = useState([]);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [currentInteractions, setCurrentInteractions] = useState([]);
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [consultationContext, setConsultationContext] = useState(null);

  const refreshPatients = useCallback(async () => {
    const activeToken = token || localStorage.getItem('chronorx_token');
    if (!activeToken) return [];

    try {
      const list = await patientAPI.list();
      setPatientsList(list);

      setSelectedPatient((prev) => {
        if (prev && prev.patient_id) {
          const refreshed = list.find((p) => p.patient_id === prev.patient_id);
          return refreshed || prev;
        }
        if (list.length > 0) {
          const initial = list.find((p) => p.patient_id === 'DEMO-1001') || list[0];
          setDiagnosis((d) => d || initial.diagnosis || '');
          setClinicianNotes((n) => n || initial.clinical_notes || '');
          return initial;
        }
        return null;
      });

      if (user?.role !== 'patient') {
        try {
          const queue = await patientAPI.getQueue();
          setDoctorQueue(queue);
        } catch (qErr) {
          console.error('Failed to load doctor queue:', qErr);
        }
      }
      return list;
    } catch (err) {
      console.error('Failed to load patients list/queue:', err);
      return [];
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (token) {
      refreshPatients();
    } else {
      setSelectedPatient(null);
      setPatientsList([]);
      setDoctorQueue([]);
      setConsultationContext(null);
    }
  }, [token, user?.user_id, refreshPatients]);

  const selectPatientById = async (patientId) => {
    try {
      const p = await patientAPI.get(patientId);
      setSelectedPatient(p);
      setDiagnosis(p.diagnosis || '');
      setClinicianNotes(p.clinical_notes || '');
      setConsultationContext({
        consultation_id: p.consultation_id || p.consultation_ref || `CON-${p.patient_id}`,
        consultation_ref: p.consultation_ref || p.consultation_id || `CON-${p.patient_id}`,
        patient_id: p.patient_id,
        doctor_id: p.doctor_id || p.assigned_doctor_id || user?.user_id,
        status: p.status,
        diagnosis: p.diagnosis || '',
        clinical_notes: p.clinical_notes || '',
      });
      return p;
    } catch (err) {
      console.error('Failed to get patient:', err);
      return null;
    }
  };

  const updatePatientStatus = async (status, diag = null, notes = null, options = {}) => {
    const targetPatient = options.patient || selectedPatient;
    if (!targetPatient || !targetPatient.patient_id) {
      throw new Error('Please select a valid patient before saving consultation details.');
    }

    const nextDiagnosis = diag !== null ? diag : diagnosis;
    const nextNotes = notes !== null ? notes : clinicianNotes;

    try {
      const updated = await patientAPI.updateStatus(targetPatient.patient_id, {
        status,
        diagnosis: nextDiagnosis,
        clinical_notes: nextNotes,
        doctor_id: user?.user_id || undefined,
        consultation_id: consultationContext?.consultation_id || targetPatient.consultation_id || undefined,
        open_only: Boolean(options.openOnly),
      });

      setSelectedPatient(updated);
      if (updated.diagnosis !== undefined && updated.diagnosis !== null) {
        setDiagnosis(updated.diagnosis);
      }
      if (updated.clinical_notes !== undefined && updated.clinical_notes !== null) {
        setClinicianNotes(updated.clinical_notes);
      }

      const nextContext = {
        consultation_id: updated.consultation_id || updated.consultation_ref || `CON-${updated.patient_id}`,
        consultation_ref: updated.consultation_ref || updated.consultation_id || `CON-${updated.patient_id}`,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id || updated.assigned_doctor_id || user?.user_id,
        status: updated.status,
        diagnosis: updated.diagnosis || nextDiagnosis || '',
        clinical_notes: updated.clinical_notes ?? nextNotes ?? '',
        consultation_started_at: updated.consultation_started_at,
        saved_at: new Date().toISOString(),
      };
      setConsultationContext(nextContext);

      setPatientsList((prev) =>
        prev.some((p) => p.patient_id === updated.patient_id)
          ? prev.map((p) => (p.patient_id === updated.patient_id ? updated : p))
          : [updated, ...prev]
      );
      setDoctorQueue((prev) =>
        prev.some((p) => p.patient_id === updated.patient_id)
          ? prev.map((p) => (p.patient_id === updated.patient_id ? updated : p))
          : prev
      );

      return updated;
    } catch (err) {
      console.error('Failed to update patient status:', err);
      throw err;
    }
  };

  const openPatientForConsultation = async (patient) => {
    try {
      const updated = await patientAPI.updateStatus(patient.patient_id, {
        status: 'IN_CONSULTATION',
        diagnosis: patient.diagnosis || '',
        clinical_notes: patient.clinical_notes || '',
        open_only: true,
      });
      setSelectedPatient(updated);
      setDiagnosis(updated.diagnosis || '');
      setClinicianNotes(updated.clinical_notes || '');
      setConsultationContext({
        consultation_id: updated.consultation_id || updated.consultation_ref || `CON-${updated.patient_id}`,
        consultation_ref: updated.consultation_ref || updated.consultation_id || `CON-${updated.patient_id}`,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id || updated.assigned_doctor_id || user?.user_id,
        status: updated.status,
        diagnosis: updated.diagnosis || '',
        clinical_notes: updated.clinical_notes || '',
        consultation_started_at: updated.consultation_started_at,
      });
      await refreshPatients();
      return updated;
    } catch (err) {
      console.error('Failed to open patient for consultation:', err);
      setSelectedPatient(patient);
      setDiagnosis(patient.diagnosis || '');
      setClinicianNotes(patient.clinical_notes || '');
      return patient;
    }
  };

  return (
    <PatientContext.Provider
      value={{
        selectedPatient,
        setSelectedPatient,
        patientsList,
        doctorQueue,
        refreshPatients,
        selectPatientById,
        updatePatientStatus,
        openPatientForConsultation,
        activeScan,
        setActiveScan,
        diagnosis,
        setDiagnosis,
        currentMedicines,
        setCurrentMedicines,
        currentSchedule,
        setCurrentSchedule,
        currentInteractions,
        setCurrentInteractions,
        clinicianNotes,
        setClinicianNotes,
        consultationContext,
        setConsultationContext,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
};
