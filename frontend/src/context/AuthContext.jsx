import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, profileAPI } from '../services/api';

const AuthContext = createContext(null);

const HONORIFIC_SET = new Set([
  'dr', 'dr.', 'prof', 'prof.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.',
  'md', 'm.d.', 'phd', 'ph.d.', 'do', 'd.o.', 'rn', 'r.n.'
]);

export const getUserInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) return 'U';
  const cleaned = fullName.replace(/\([^)]*\)/g, ' ').split(',')[0].trim();
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/^[.,-]+|[.,-]+$/g, ''))
    .filter((t) => t && !HONORIFIC_SET.has(t.toLowerCase()));
  const fallbackTokens = fullName
    .split(/\s+/)
    .map((t) => t.replace(/^[.,-]+|[.,-]+$/g, ''))
    .filter(Boolean);
  const active = tokens.length > 0 ? tokens : fallbackTokens;
  if (active.length === 0) return 'U';
  if (active.length === 1) return active[0].slice(0, 2).toUpperCase();
  return `${active[0][0]}${active[1][0]}`.toUpperCase();
};

export const getRoleDisplayLabel = (role) => {
  switch ((role || '').toLowerCase()) {
    case 'doctor':
      return 'Doctor / Clinician';
    case 'receptionist':
      return 'Receptionist / Intake';
    case 'patient':
      return 'Patient';
    case 'admin':
      return 'Admin';
    default:
      return 'Staff';
  }
};

const normalizeUserObject = (rawUser, profileData = null) => {
  if (!rawUser && !profileData) return null;
  const merged = { ...(rawUser || {}), ...(profileData || {}) };
  const fullName = merged.full_name || merged.name || 'Authorized User';
  const systemId = merged.user_id || merged.system_id || '';
  const role = (merged.role || 'doctor').toLowerCase();
  const profilePhoto = merged.profile_photo || null;
  return {
    ...merged,
    name: fullName,
    full_name: fullName,
    system_id: systemId,
    user_id: systemId,
    role,
    role_label: merged.role_label || getRoleDisplayLabel(role),
    profile_photo: profilePhoto,
    has_photo: Boolean(profilePhoto),
    initials: merged.initials || getUserInitials(fullName),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('chronorx_user');
      return stored ? normalizeUserObject(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('chronorx_token'));
  const [loading, setLoading] = useState(true);
  const [profileModalState, setProfileModalState] = useState({
    open: false,
    autoTriggerPicker: false,
  });

  const openProfileModal = useCallback((autoTriggerPicker = false) => {
    setProfileModalState({ open: true, autoTriggerPicker: Boolean(autoTriggerPicker) });
  }, []);

  const closeProfileModal = useCallback(() => {
    setProfileModalState({ open: false, autoTriggerPicker: false });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const [me, prof] = await Promise.all([
        authAPI.getMe(),
        profileAPI.getMe().catch(() => null),
      ]);
      const normalized = normalizeUserObject(me, prof);
      setUser(normalized);
      localStorage.setItem('chronorx_user', JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('chronorx_token');
      const storedUser = localStorage.getItem('chronorx_user');

      if (storedToken && storedUser) {
        try {
          setUser(normalizeUserObject(JSON.parse(storedUser)));
          await refreshProfile();
        } catch (err) {
          console.error('Auth initialization failed:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshProfile]);

  const login = async (username, password) => {
    const data = await authAPI.login(username, password);
    localStorage.setItem('chronorx_token', data.access_token);
    setToken(data.access_token);

    let prof = null;
    try {
      prof = await profileAPI.getMe();
    } catch {
      prof = null;
    }
    const normalized = normalizeUserObject(data.user, prof);
    setUser(normalized);
    localStorage.setItem('chronorx_user', JSON.stringify(normalized));
    return normalized;
  };

  const uploadProfilePhoto = useCallback(async (fileBlob, filename = null) => {
    const prof = await profileAPI.uploadPhoto(fileBlob, filename);
    setUser((prev) => {
      const updated = normalizeUserObject(prev, prof);
      localStorage.setItem('chronorx_user', JSON.stringify(updated));
      return updated;
    });
    return prof;
  }, []);

  const removeProfilePhoto = useCallback(async () => {
    const prof = await profileAPI.deletePhoto();
    setUser((prev) => {
      const updated = normalizeUserObject({ ...(prev || {}), profile_photo: null }, prof);
      localStorage.setItem('chronorx_user', JSON.stringify(updated));
      return updated;
    });
    return prof;
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    setProfileModalState({ open: false, autoTriggerPicker: false });
    localStorage.removeItem('chronorx_token');
    localStorage.removeItem('chronorx_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loading,
        isAuthenticated: !!token,
        refreshProfile,
        uploadProfilePhoto,
        removeProfilePhoto,
        profileModalState,
        openProfileModal,
        closeProfileModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
