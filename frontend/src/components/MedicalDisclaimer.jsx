import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const MedicalDisclaimer = ({ compact = false, customText = null }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
        <span>AI-assisted reference information — verify with an authorized healthcare professional.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3 text-amber-900 shadow-sm flex items-start gap-3">
      <div className="p-1.5 bg-amber-100 rounded-md text-amber-700 flex-shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="text-xs leading-relaxed">
        <div className="font-semibold text-amber-950 flex items-center gap-1.5">
          <span>CLINICAL DECISION SUPPORT SYSTEM (CDSS) PROTOTYPE NOTICE</span>
          <span className="bg-amber-200 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-mono uppercase">Non-Autonomous</span>
        </div>
        <p className="mt-0.5 text-amber-800">
          {customText || (
            <>
              This system is an AI-assisted clinical reference tool for informational support only. 
              <strong> Never consider AI output as an autonomous prescription or definitive medical diagnosis.</strong> 
              All medications, doses, interactions, and schedules must be independently reviewed and formally verified by a licensed, authorized healthcare professional.
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default MedicalDisclaimer;
