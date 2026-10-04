import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import {
  Activity,
  Lock,
  User,
  Mail,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  BadgeInfo
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('sarah.jenkins@chronorx.tech');
  const [loginPassword, setLoginPassword] = useState('ClinicianPass2026!');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('doctor');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Success / Feedback state
  const [registeredUser, setRegisteredUser] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Handle Sign In (supports Email or System User ID like DOC-1001)
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!loginIdentifier.trim()) {
      setError('Please enter your Email or System User ID (e.g. DOC-1001).');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(loginIdentifier.trim(), loginPassword);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Invalid credentials. Please verify your Email or System User ID and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Registration of a new custom user (Doctor, Receptionist, or Admin)
  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');
    setRegisteredUser(null);

    if (!regFullName.trim()) {
      setError('Please provide your Full Legal Name.');
      return;
    }
    if (!regEmail.trim()) {
      setError('Please enter an official Email address.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const newUser = await authAPI.register({
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        full_name: regFullName.trim(),
        role: regRole,
      });

      setRegisteredUser(newUser);
      setSuccessMsg(`Registration Successful! Allocated System User ID: ${newUser.user_id}`);

      // Automatically sign in with newly created account
      await login(newUser.user_id, regPassword);
      setTimeout(() => {
        navigate('/');
      }, 1400);

    } catch (err) {
      console.error("Registration error:", err);
      // Strictly displays the exact message: "This email is already registered. Please sign in or use another email."
      setError(
        err.response?.data?.detail ||
        'Registration failed. Please check the details provided.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setTestCredentials = (identifier, pass) => {
    setLoginIdentifier(identifier);
    setLoginPassword(pass);
    setError('');
    setMode('login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-xl shadow-teal-500/30">
            <Activity className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight">
          Chrono<span className="text-teal-400">Rx</span> Tech
        </h2>
        <p className="mt-1 text-center text-xs text-slate-300">
          Clinical Decision Support System (CDSS) • Role-Based Authentication
        </p>
      </div>

      {/* Main Container */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100 space-y-6">
          
          {/* Tab Switcher: Sign In vs Create Account */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register Staff Account
            </button>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-3 rounded-lg text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
              {error.includes("already registered") && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginIdentifier(regEmail);
                    setError('');
                  }}
                  className="mt-1 text-teal-700 hover:text-teal-900 underline font-bold block"
                >
                  Click here to switch to Sign In with this email →
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-lg text-xs space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>Account Created Successfully!</span>
              </div>
              {registeredUser && (
                <div className="bg-white/80 p-2.5 rounded border border-emerald-200 space-y-1 font-mono text-[11px]">
                  <div>Assigned User ID: <strong className="text-emerald-900 text-xs">{registeredUser.user_id}</strong></div>
                  <div>Official Role: <strong className="text-slate-800 uppercase">{registeredUser.role}</strong></div>
                  <div>Staff Name: <strong className="text-slate-800">{registeredUser.full_name}</strong></div>
                </div>
              )}
              <div className="text-[11px] text-emerald-700 flex items-center gap-1 pt-1 font-sans">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Logging into {registeredUser?.role} portal automatically...
              </div>
            </div>
          )}

          {/* TAB 1: SIGN IN */}
          {mode === 'login' && (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Email or System User ID *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="e.g. DOC-1001 or sarah.jenkins@chronorx.tech"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Accepts either your official Email or your system-generated ID (<code className="text-teal-700">DOC-1001</code>, <code className="text-teal-700">REC-1001</code>, <code className="text-teal-700">ADM-1001</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Enter account password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Authenticating...' : 'Sign In to Portal'}
              </button>

              {/* Initialized Medical Staff Directory Card */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Initialized Staff Accounts:
                  </span>
                  <span className="text-[10px] text-teal-700 font-mono font-medium">1-Click Test</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setTestCredentials('DOC-1001', 'ClinicianPass2026!')}
                    className="w-full p-2 bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-200 rounded-lg flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>🩺 Dr. Sarah Jenkins, M.D.</span>
                        <span className="bg-teal-200 text-teal-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold">DOC-1001</span>
                      </div>
                      <span className="text-[11px] text-teal-700 block font-mono">sarah.jenkins@chronorx.tech</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-200/70 text-teal-950 uppercase">Clinician</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestCredentials('REC-1001', 'ReceptionPass2026!')}
                    className="w-full p-2 bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 rounded-lg flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>📋 Alex Rivera</span>
                        <span className="bg-blue-200 text-blue-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold">REC-1001</span>
                      </div>
                      <span className="text-[11px] text-blue-700 block font-mono">alex.rivera@chronorx.tech</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-200/70 text-blue-950 uppercase">Intake</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestCredentials('ADM-1001', 'AdminSecure2026!')}
                    className="w-full p-2 bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-200 rounded-lg flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>⚙️ David Vance</span>
                        <span className="bg-purple-200 text-purple-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold">ADM-1001</span>
                      </div>
                      <span className="text-[11px] text-purple-700 block font-mono">david.vance@chronorx.tech</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200/70 text-purple-950 uppercase">Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestCredentials('PAT-1001', 'PatientSecure2026!')}
                    className="w-full p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 rounded-lg flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>👤 Emma Watson (Demo Patient)</span>
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold">PAT-1001</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 block font-mono">emma.watson@chronorx.tech</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/70 text-emerald-950 uppercase">Patient</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER NEW STAFF USER */}
          {mode === 'register' && (
            <form className="space-y-3.5" onSubmit={handleRegisterSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Role Assignment *
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
                >
                  <option value="doctor">🩺 Doctor / Clinician (Generates DOC-100X)</option>
                  <option value="receptionist">📋 Receptionist (Generates REC-100X)</option>
                  <option value="admin">⚙️ Administrator (Generates ADM-100X)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Role automatically determines your generated System ID sequence and access permissions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Full Legal Name & Title *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="e.g. Dr. Marcus Brody, M.D. or Clara Higgins"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Official Email Address *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="e.g. marcus.brody@hospital.org"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Must be unique. Duplicate emails are strictly rejected.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="Create a secure password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Informational Callout regarding system-generated ID */}
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-xs flex items-start gap-2">
                <BadgeInfo className="w-4 h-4 text-teal-700 mt-0.5 flex-shrink-0" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Automatic ID Allocation:</strong> The database generates your permanent ID (e.g.{' '}
                  <span className="font-mono font-bold text-teal-800">
                    {regRole === 'doctor' ? 'DOC-1002' : regRole === 'receptionist' ? 'REC-1002' : 'ADM-1002'}
                  </span>
                  ). Passwords are securely hashed via bcrypt.
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Allocating System ID & Registering...' : 'Register Staff Account'}
              </button>
            </form>
          )}

        </div>

        {/* Legal Medical Disclaimer */}
        <div className="mt-6">
          <MedicalDisclaimer />
        </div>
      </div>
    </div>
  );
};

export default Login;
