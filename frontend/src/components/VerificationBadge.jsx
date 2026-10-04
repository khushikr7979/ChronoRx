import React from 'react';
import { CheckCircle2, AlertCircle, Clock, ShieldAlert } from 'lucide-react';

const VerificationBadge = ({ status, confidence, verified = false }) => {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Clinician Verified
      </span>
    );
  }

  if (status === 'manual_verification_required' || (confidence !== undefined && confidence < 0.75)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
        <ShieldAlert className="w-3 h-3 text-red-600" />
        Manual Verification Required
      </span>
    );
  }

  if (confidence !== undefined && confidence >= 0.75) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-300">
        <CheckCircle2 className="w-3 h-3 text-teal-600" />
        RxNorm Matched ({Math.round(confidence * 100)}%)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
      <Clock className="w-3 h-3 text-amber-600" />
      Pending Clinician Review
    </span>
  );
};

export default VerificationBadge;
