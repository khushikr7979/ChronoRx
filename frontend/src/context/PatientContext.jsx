import React, { createContext, useContext, useState, useEffect } from 'react';
import { patientAPI } from '../services/api';

const PatientContext = createContext(null);

export const PatientProvider = ({ children }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientsList, setPatientsList] = useState([]);
  const [doctorQueue, setDoctorQueue] = useState([]);
  const [activeScan, setActiveScan] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [currentMedicines, setCurrentMedicines] = useState([]);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [currentInteractions, setCurrentInteractions] = useState([]);
  const [clinicianNotes, setClinicianNotes] = useState('');

  const refreshPatients = async () => {
    try {
      const list = await patientAPI.list();
      setPatientsList(list);
      // Auto-select first patient if none selected
      if (!selectedPatient && list.length > 0) {
        setSelectedPatient(list[0]);
        if (list[0].diagnosis) setDiagnosis(list[0].diagnosis);
        if (list[0].clinical_notes) setClinicianNotes(list[0].clinical_notes);
      }
      // Also refresh doctor queue
      const queue = await patientAPI.getQueue();
      setDoctorQueue(queue);
    } catch (err) {
      console.error("Failed to load patients list/queue:", err);
    }
  };

  useEffect(() => {
    refreshPatients();
  }, []);

  const selectPatientById = async (patientId) => {
    try {
      const p = await patientAPI.get(patientId);
      setSelectedPatient(p);
      if (p.diagnosis) setDiagnosis(p.diagnosis);
      if (p.clinical_notes) setClinicianNotes(p.clinical_notes);
      return p;
    } catch (err) {
      console.error("Failed to get patient:", err);
      return null;
    }
  };

  const updatePatientStatus = async (status, diag = null, notes = null) => {
    if (!selectedPatient) return null;
    try {
      const updated = await patientAPI.updateStatus(selectedPatient.patient_id, {
        status,
        diagnosis: diag !== null ? diag : diagnosis,
        clinical_notes: notes !== null ? notes : clinicianNotes,
      });
      setSelectedPatient(updated);
      await refreshPatients();
      return updated;
    } catch (err) {
      console.error("Failed to update patient status:", err);
      throw err;
    }
  };

  const openPatientForConsultation = async (patient) => {
    try {
      const updated = await patientAPI.updateStatus(patient.patient_id, {
        status: 'IN_CONSULTATION',
        diagnosis: patient.diagnosis || diagnosis,
        clinical_notes: patient.clinical_notes || clinicianNotes,
      });
      setSelectedPatient(updated);
      setDiagnosis(updated.diagnosis || '');
      setClinicianNotes(updated.clinical_notes || '');
      await refreshPatients();
      return updated;
    } catch (err) {
      console.error("Failed to open patient for consultation:", err);
      setSelectedPatient(patient);
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
