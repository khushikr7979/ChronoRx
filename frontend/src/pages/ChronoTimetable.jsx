import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { scheduleAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import {
  Clock,
  Sun,
  Sunset,
  Moon,
  Coffee,
  Utensils,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const ChronoTimetable = () => {
  const navigate = useNavigate();
  const {
    selectedPatient,
    currentMedicines,
    currentSchedule,
    setCurrentSchedule,
  } = usePatient();

  const [timetable, setTimetable] = useState(() => {
    if (currentSchedule && currentSchedule.length > 0) {
      return currentSchedule;
    }
    // Default initial mock or generated items
    return [
      {
        drug_name: 'Omeprazole',
        dosage: '20 mg',
        route: 'Oral',
        frequency: 'Once daily',
        time_slot: '07:30 AM',
        timing_description: '30-60 min Before Breakfast',
        food_relation: 'Empty stomach before meal',
        chronopharmacology_rationale: 'Parietal proton pump synthesis occurs overnight; peak plasma level coincides with first meal pump activation.',
        clinician_approved: true
      },
      {
        drug_name: 'Lisinopril',
        dosage: '10 mg',
        route: 'Oral',
        frequency: 'Once daily',
        time_slot: '08:30 AM',
        timing_description: 'Morning - With/After breakfast',
        food_relation: 'After meal',
        chronopharmacology_rationale: 'Maintains daytime hemodynamic stability and prevents peak nocturnal hypotension in dippers.',
        clinician_approved: true
      },
      {
        drug_name: 'Aspirin',
        dosage: '81 mg',
        route: 'Oral',
        frequency: 'Once daily',
        time_slot: '08:30 AM',
        timing_description: 'After breakfast',
        food_relation: 'With meal',
        chronopharmacology_rationale: 'Post-prandial administration buffers gastric mucosa against ulceration.',
        clinician_approved: true
      },
      {
        drug_name: 'Atorvastatin',
        dosage: '20 mg',
        route: 'Oral',
        frequency: 'Once daily',
        time_slot: '10:00 PM',
        timing_description: 'Night - Bedtime',
        food_relation: 'At bedtime',
        chronopharmacology_rationale: 'Hepatic HMG-CoA reductase and endogenous cholesterol synthesis peak between midnight and 06:00 AM.',
        clinician_approved: true
      }
    ];
  });

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editItem, setEditItem] = useState(null);

  // If active medicines exist from OCR, allow one-click auto generation
  const handleAutoGenerate = async () => {
    if (!currentMedicines || currentMedicines.length === 0) return;
    setLoading(true);
    try {
      const res = await scheduleAPI.generate(
        currentMedicines,
        selectedPatient?.patient_id || 'DEMO-1001'
      );
      setTimetable(res.timetable);
      setRecommendations(res.chronopharmacology_recommendations || []);
      setCurrentSchedule(res.timetable);
    } catch (err) {
      console.error("Schedule generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (idx) => {
    setEditingIndex(idx);
    setEditItem({ ...timetable[idx] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const updated = [...timetable];
    updated[editingIndex] = editItem;
    setTimetable(updated);
    setCurrentSchedule(updated);
    setEditingIndex(null);
    setEditItem(null);
  };

  const handleRemove = (idx) => {
    const updated = timetable.filter((_, i) => i !== idx);
    setTimetable(updated);
    setCurrentSchedule(updated);
  };

  const handleAddMedication = () => {
    const newItem = {
      drug_name: 'New Medication',
      dosage: '50 mg',
      route: 'Oral',
      frequency: 'Once daily',
      time_slot: '08:00 AM',
      timing_description: 'Morning - Breakfast',
      food_relation: 'With meal',
      chronopharmacology_rationale: 'Evenly spaced dosing interval.',
      clinician_approved: false
    };
    const updated = [...timetable, newItem];
    setTimetable(updated);
    setCurrentSchedule(updated);
    handleEditClick(updated.length - 1);
  };

  const toggleApproval = (idx) => {
    const updated = [...timetable];
    updated[idx].clinician_approved = !updated[idx].clinician_approved;
    setTimetable(updated);
    setCurrentSchedule(updated);
  };

  const handleProceed = () => {
    setCurrentSchedule(timetable);
    navigate('/summary');
  };

  const getTimeIcon = (slot) => {
    const s = slot.toLowerCase();
    if (s.includes('am') && (s.includes('6') || s.includes('7') || s.includes('8') || s.includes('9'))) {
      return <Sun className="w-4 h-4 text-amber-500" />;
    }
    if (s.includes('pm') && (s.includes('12') || s.includes('1') || s.includes('2') || s.includes('3') || s.includes('4') || s.includes('5'))) {
      return <Sun className="w-4 h-4 text-orange-500" />;
    }
    if (s.includes('pm') && (s.includes('6') || s.includes('7') || s.includes('8'))) {
      return <Sunset className="w-4 h-4 text-indigo-500" />;
    }
    return <Moon className="w-4 h-4 text-slate-700" />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-teal-600" />
            ChronoRx Circadian Medication Timetable
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Module 5: Chronopharmacology-guided medication scheduling aligned with biological circadian rhythms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentMedicines?.length > 0 && (
            <button
              onClick={handleAutoGenerate}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              Re-sync Scanned Meds
            </button>
          )}
          <button
            onClick={handleProceed}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-teal-500/20 flex items-center gap-2 transition"
          >
            Generate Clinical Summary
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Circadian Biology Notice */}
      <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 text-xs text-teal-950 flex items-start gap-3">
        <Info className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Chronopharmacology Guardrail:</strong> The suggested times are evidence-based recommendations 
          derived from circadian pharmacokinetics (e.g., nocturnal statin administration for peak HMG-CoA reductase, 
          morning PPI administration for proton pump activation). 
          <strong> AI recommendations will never alter prescribed regimens without clinician sign-off.</strong>
        </div>
      </div>

      {/* Main Timetable Card List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Daily Administration Schedule for Patient {selectedPatient?.patient_id || 'DEMO-1001'}
          </span>
          <button
            onClick={handleAddMedication}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Medication Slot
          </button>
        </div>

        {/* Timetable Items */}
        <div className="space-y-3">
          {timetable.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition ${
                item.clinician_approved
                  ? 'bg-slate-50/60 border-slate-200'
                  : 'bg-amber-50/50 border-amber-300'
              }`}
            >
              {editingIndex === idx ? (
                /* Edit Mode */
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Time Slot</label>
                      <input
                        type="text"
                        value={editItem.time_slot}
                        onChange={(e) => setEditItem({ ...editItem, time_slot: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Drug Name</label>
                      <input
                        type="text"
                        value={editItem.drug_name}
                        onChange={(e) => setEditItem({ ...editItem, drug_name: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dosage</label>
                      <input
                        type="text"
                        value={editItem.dosage}
                        onChange={(e) => setEditItem({ ...editItem, dosage: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Timing Phase</label>
                      <input
                        type="text"
                        value={editItem.timing_description}
                        onChange={(e) => setEditItem({ ...editItem, timing_description: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Food Relation</label>
                    <input
                      type="text"
                      value={editItem.food_relation}
                      onChange={(e) => setEditItem({ ...editItem, food_relation: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                      placeholder="e.g. 30 min before breakfast / with meal"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Time Pill */}
                    <div className="flex flex-col items-center justify-center bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs min-w-[95px]">
                      <div className="flex items-center gap-1.5 font-bold font-mono text-sm text-slate-900">
                        {getTimeIcon(item.time_slot)}
                        <span>{item.time_slot}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Daily</span>
                    </div>

                    {/* Drug & Instructions */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{item.drug_name}</h4>
                        <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {item.dosage}
                        </span>
                        <span className="text-xs text-slate-400">({item.route})</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{item.timing_description}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Utensils className="w-3 h-3 text-slate-400" />
                          {item.food_relation}
                        </span>
                      </div>

                      {item.chronopharmacology_rationale && (
                        <p className="mt-1 text-[11px] text-teal-900/80 bg-teal-50/50 p-1.5 rounded border border-teal-100 max-w-2xl leading-relaxed">
                          <strong>Circadian Rationale:</strong> {item.chronopharmacology_rationale}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => toggleApproval(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        item.clinician_approved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {item.clinician_approved ? 'Approved' : 'Needs Approval'}
                    </button>
                    <button
                      onClick={() => handleEditClick(idx)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Timing"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remove Slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChronoTimetable;
