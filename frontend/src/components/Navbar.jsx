import React, { useState, useRef, useEffect } from 'react';
import { useAuth, getRoleDisplayLabel } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import {
  Activity,
  User,
  LogOut,
  ChevronDown,
  UserCheck,
  Menu,
  Camera,
  Trash2,
} from 'lucide-react';
import MedicalDisclaimer from './MedicalDisclaimer';
import { UserAvatar, UserProfileModal } from './UserProfileCard';

const Navbar = ({ onToggleMobileMenu }) => {
  const { user, logout, openProfileModal, removeProfilePhoto } = useAuth();
  const { selectedPatient, patientsList, setSelectedPatient } = usePatient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const getRoleBadge = (role) => {
    const label = getRoleDisplayLabel(role);
    switch ((role || '').toLowerCase()) {
      case 'doctor':
        return <span className="bg-teal-100 text-teal-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-teal-200">{label}</span>;
      case 'admin':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-purple-200">{label}</span>;
      case 'patient':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">{label}</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">{label}</span>;
    }
  };

  const handleRemovePhotoFromDropdown = async () => {
    if (!user?.profile_photo || removingPhoto) return;
    try {
      setRemovingPhoto(true);
      await removeProfilePhoto();
      setDropdownOpen(false);
    } catch (err) {
      console.error('Failed to remove profile photo:', err);
    } finally {
      setRemovingPhoto(false);
    }
  };

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              {onToggleMobileMenu && (
                <button
                  type="button"
                  onClick={onToggleMobileMenu}
                  className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-slate-100 transition"
                  aria-label="Toggle Navigation Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900">
                    Chrono<span className="text-teal-600">Rx</span>
                  </span>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200">
                    Tech CDSS
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">Clinical Decision Support &amp; Chronopharmacology</p>
              </div>
            </div>

            {/* Active Patient Switcher & Clinical Bar (Staff only) */}
            <div className="hidden md:flex items-center gap-4">
              {user?.role !== 'patient' && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-medium text-slate-500">Active Patient:</span>
                  <select
                    value={selectedPatient?.patient_id || ''}
                    onChange={(e) => {
                      const p = patientsList.find(item => item.patient_id === e.target.value);
                      if (p) setSelectedPatient(p);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {patientsList.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.patient_id} ({p.gender}, {p.age}y, {p.weight}kg)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <MedicalDisclaimer compact={true} />
            </div>

            {/* User Profile & Dropdown */}
            <div className="flex items-center gap-2">
              {user && (
                <div className="relative flex items-center gap-2 pl-3 border-l border-slate-200" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-slate-50 transition text-left focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                    data-testid="navbar-profile-trigger"
                  >
                    <UserAvatar user={user} size="sm" />
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                        <span className="truncate max-w-[160px]">{user.full_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-medium text-slate-500">
                          {getRoleDisplayLabel(user.role)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                          {user.user_id}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        dropdownOpen ? 'rotate-180 text-teal-600' : ''
                      }`}
                    />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {dropdownOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl py-3 z-50"
                      data-testid="navbar-profile-dropdown"
                    >
                      {/* Profile Summary Header */}
                      <div className="px-4 pb-3 border-b border-slate-100 flex items-center gap-3">
                        <UserAvatar user={user} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {user.full_name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {getRoleBadge(user.role)}
                            <span className="font-mono text-[10px] font-bold text-teal-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {user.user_id}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Actions */}
                      <div className="py-1.5 px-2 space-y-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            openProfileModal(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition text-left"
                        >
                          <User className="w-4 h-4 text-teal-600" />
                          <span>View Profile</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            openProfileModal(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition text-left"
                        >
                          <Camera className="w-4 h-4 text-teal-600" />
                          <span>Change Photo</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRemovePhotoFromDropdown}
                          disabled={!user.profile_photo || removingPhoto}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-left"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          <span>{removingPhoto ? 'Removing Photo...' : 'Remove Photo'}</span>
                        </button>
                      </div>

                      <div className="pt-1.5 mt-1 px-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <UserProfileModal />
    </>
  );
};

export default Navbar;
