import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PatientProvider } from './context/PatientContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientDashboard from './pages/PatientDashboard';
import PatientRegistration from './pages/PatientRegistration';
import PatientDirectory from './pages/PatientDirectory';
import PatientProfile from './pages/PatientProfile';
import ScanPrescription from './pages/ScanPrescription';
import OCRReview from './pages/OCRReview';
import MedicationAnalysis from './pages/MedicationAnalysis';
import InteractionChecker from './pages/InteractionChecker';
import ChronoTimetable from './pages/ChronoTimetable';
import ClinicalSummary from './pages/ClinicalSummary';
import PDFPrescription from './pages/PDFPrescription';
import DoctorConsultation from './pages/DoctorConsultation';
import SettingsAudit from './pages/SettingsAudit';
import ClinicOperations from './pages/ClinicOperations';

const ProtectedLayout = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
        Initializing ChronoRx Tech CDSS...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen medical-clinical-bg flex flex-col">
      <Navbar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const HomeRoute = () => {
  const { user } = useAuth();
  if (user?.role === 'patient') {
    return <PatientDashboard />;
  }
  return <Dashboard />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <PatientProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route
              path="/"
              element={
                <ProtectedLayout>
                  <HomeRoute />
                </ProtectedLayout>
              }
            />
            <Route
              path="/patient-portal"
              element={
                <ProtectedLayout allowedRoles={['patient']}>
                  <PatientDashboard />
                </ProtectedLayout>
              }
            />
            <Route
              path="/patients/register"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <PatientRegistration />
                </ProtectedLayout>
              }
            />
            <Route
              path="/patients"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <PatientDirectory />
                </ProtectedLayout>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <PatientProfile />
                </ProtectedLayout>
              }
            />
            <Route
              path="/scan"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <ScanPrescription />
                </ProtectedLayout>
              }
            />
            <Route
              path="/ocr-review"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <OCRReview />
                </ProtectedLayout>
              }
            />
            <Route
              path="/dose-support"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'admin']}>
                  <MedicationAnalysis />
                </ProtectedLayout>
              }
            />
            <Route
              path="/interactions"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'admin']}>
                  <InteractionChecker />
                </ProtectedLayout>
              }
            />
            <Route
              path="/timetable"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'admin']}>
                  <ChronoTimetable />
                </ProtectedLayout>
              }
            />
            <Route
              path="/summary"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'admin']}>
                  <ClinicalSummary />
                </ProtectedLayout>
              }
            />
            <Route
              path="/prescription"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'admin']}>
                  <PDFPrescription />
                </ProtectedLayout>
              }
            />
            <Route
              path="/consultation"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'admin']}>
                  <DoctorConsultation />
                </ProtectedLayout>
              }
            />
            <Route
              path="/clinic-operations"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <ClinicOperations />
                </ProtectedLayout>
              }
            />
            <Route
              path="/followups"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <ClinicOperations />
                </ProtectedLayout>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <ClinicOperations />
                </ProtectedLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedLayout allowedRoles={['doctor', 'receptionist', 'admin']}>
                  <SettingsAudit />
                </ProtectedLayout>
              }
            />

            {/* Fallback to Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PatientProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
