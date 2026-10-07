import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Upload,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth, getUserInitials, getRoleDisplayLabel } from '../context/AuthContext';
import { getFullAssetUrl } from '../services/api';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export const getRoleTheme = (role) => {
  switch ((role || '').toLowerCase()) {
    case 'doctor':
      return {
        avatarGradient: 'from-teal-600 to-emerald-700',
        ring: 'ring-teal-500/30 border-teal-200',
        badge: 'bg-teal-50 text-teal-800 border-teal-200',
      };
    case 'receptionist':
      return {
        avatarGradient: 'from-blue-600 to-indigo-700',
        ring: 'ring-blue-500/30 border-blue-200',
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
      };
    case 'patient':
      return {
        avatarGradient: 'from-emerald-600 to-teal-700',
        ring: 'ring-emerald-500/30 border-emerald-200',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'admin':
      return {
        avatarGradient: 'from-purple-600 to-indigo-800',
        ring: 'ring-purple-500/30 border-purple-200',
        badge: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    default:
      return {
        avatarGradient: 'from-teal-600 to-slate-700',
        ring: 'ring-teal-500/30 border-slate-200',
        badge: 'bg-slate-100 text-slate-800 border-slate-200',
      };
  }
};

export const UserAvatar = ({
  user,
  previewUrl = null,
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const rawPhoto = previewUrl || user?.profile_photo || null;
  const resolvedUrl = rawPhoto ? getFullAssetUrl(rawPhoto) : '';

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedUrl]);

  const fullName = user?.full_name || user?.name || 'User';
  const initials = user?.initials || getUserInitials(fullName);
  const theme = getRoleTheme(user?.role);

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-xl',
    xl: 'w-24 h-24 text-2xl',
  }[size] || 'w-10 h-10 text-xs';

  const showImage = Boolean(resolvedUrl) && !imgFailed;

  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center font-extrabold select-none flex-shrink-0 border-2 ring-2 ${theme.ring} ${sizeClasses} ${
        showImage ? 'bg-slate-100' : `bg-gradient-to-br ${theme.avatarGradient} text-white shadow-sm`
      } ${className}`}
      title={`${fullName} (${user?.user_id || user?.system_id || ''})`}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={fullName}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="tracking-wider">{initials}</span>
      )}
    </div>
  );
};

export const UserProfileCard = ({
  compact = false,
  autoTriggerPicker = false,
  onTriggerConsumed = null,
  onClose = null,
}) => {
  const { user, uploadProfilePhoto, removeProfilePhoto } = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (autoTriggerPicker && fileInputRef.current) {
      const timer = setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
        if (onTriggerConsumed) onTriggerConsumed();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [autoTriggerPicker, onTriggerConsumed]);

  if (!user) return null;

  const displayName = user.full_name || user.name;
  const displayRole = user.role_label || getRoleDisplayLabel(user.role);
  const displaySystemId = user.user_id || user.system_id;
  const hasPhoto = Boolean(user.profile_photo);
  const theme = getRoleTheme(user.role);

  const clearPendingSelection = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenFilePicker = () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = (file.name || '').toLowerCase();
    const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
    const hasAllowedMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!hasAllowedExt || !hasAllowedMime) {
      setErrorMsg('Invalid image format. Only JPG, JPEG, PNG, and WEBP photos are permitted.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size <= 0) {
      setErrorMsg('Selected image file is empty.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setErrorMsg('Image exceeds maximum allowed size of 5 MB. Please choose a smaller photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await uploadProfilePhoto(selectedFile, selectedFile.name);
      clearPendingSelection();
      setSuccessMsg('Profile photo updated successfully.');
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Failed to upload profile photo. Your previous photo has been preserved.';
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to upload profile photo.');
      clearPendingSelection();
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!hasPhoto && !selectedFile) return;
    if (selectedFile) {
      clearPendingSelection();
      return;
    }
    setRemoving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await removeProfilePhoto();
      setSuccessMsg('Profile photo removed. Default initials avatar restored.');
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Failed to remove profile photo.';
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to remove profile photo.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm ${
        compact ? 'p-4' : 'p-6'
      } relative`}
      data-testid="user-profile-card"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          aria-label="Close Profile Modal"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Select Profile Photo"
      />

      <div className={`flex ${compact ? 'flex-col sm:flex-row items-center gap-4' : 'flex-col items-center text-center gap-3'}`}>
        {/* Profile Photo / Default Initials Avatar */}
        <div className="relative group">
          <UserAvatar
            user={user}
            previewUrl={previewUrl}
            size={compact ? 'lg' : 'xl'}
          />
          <button
            type="button"
            onClick={handleOpenFilePicker}
            disabled={uploading || removing}
            title="Change Profile Photo"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-md flex items-center justify-center border-2 border-white transition"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Verified Identity Metadata: Name, Role, System ID */}
        <div className={compact ? 'text-center sm:text-left flex-1 min-w-0' : 'space-y-1'}>
          <div className="text-base font-extrabold text-slate-900 leading-snug" data-testid="profile-user-name">
            {displayName}
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${theme.badge}`}
              data-testid="profile-user-role"
            >
              {displayRole}
            </span>
            <span
              className="font-mono text-xs font-bold text-teal-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200"
              data-testid="profile-system-id"
            >
              {displaySystemId}
            </span>
          </div>
          {user.role === 'patient' && user.patient_id && (
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center sm:justify-start gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Linked Clinical Record:</span>
              <span className="font-mono font-bold text-slate-700">{user.patient_id}</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Change Photo & Remove Photo */}
        <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? '' : 'w-full pt-2'}`}>
          <button
            type="button"
            onClick={handleOpenFilePicker}
            disabled={uploading || removing}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Change Photo</span>
          </button>

          <button
            type="button"
            onClick={handleRemovePhoto}
            disabled={(!hasPhoto && !selectedFile) || uploading || removing}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            {removing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Photo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Image Preview & Upload Confirmation Box */}
      {selectedFile && previewUrl && (
        <div className="mt-4 p-3.5 bg-teal-50/80 border border-teal-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="truncate font-semibold text-teal-950">
              Selected: <span className="font-mono">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
            <span className="text-[10px] uppercase font-bold text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
              Preview Ready
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearPendingSelection}
              disabled={uploading}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={uploading}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading Photo...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Save Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {errorMsg && (
        <div
          role="alert"
          className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {!compact && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Accepted: JPG, PNG, WEBP (Max 5 MB)</span>
          </span>
          <span>Zero AI/LLM Exposure</span>
        </div>
      )}
    </div>
  );
};

export const UserProfileModal = () => {
  const { profileModalState, closeProfileModal, openProfileModal } = useAuth();

  if (!profileModalState?.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={closeProfileModal}
    >
      <div
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <UserProfileCard
          compact={false}
          autoTriggerPicker={profileModalState.autoTriggerPicker}
          onTriggerConsumed={() => openProfileModal(false)}
          onClose={closeProfileModal}
        />
      </div>
    </div>
  );
};

export default UserProfileCard;
