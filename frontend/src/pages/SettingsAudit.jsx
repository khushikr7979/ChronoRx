import React, { useState, useEffect } from 'react';
import { auditAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Settings,
  ShieldCheck,
  Server,
  Database,
  Cpu,
  RefreshCw,
  Search,
  Lock,
  FileCheck,
  Users,
  BadgeCheck,
  UserPlus,
  Stethoscope,
  Edit2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import DepartmentSelect from '../components/DepartmentSelect';

const SettingsAudit = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' or 'staff'
  const [logs, setLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [staffDeptFilter, setStaffDeptFilter] = useState('');
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingDeptVal, setEditingDeptVal] = useState('');
  const [savingDept, setSavingDept] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditAPI.getAll();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch audit trail:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const data = await authAPI.getStaff(null, staffDeptFilter || null);
      setStaffList(data);
    } catch (err) {
      console.error("Failed to fetch staff directory:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStaff();
  }, [staffDeptFilter]);

  const handleUpdateStaffDepartment = async (userId) => {
    if (!editingDeptVal) return;
    setSavingDept(true);
    setActionMsg(null);
    try {
      await authAPI.updateStaffDepartment(userId, editingDeptVal);
      await fetchStaff();
      await fetchLogs();
      setEditingStaffId(null);
      setActionMsg({
        type: 'success',
        text: `Successfully updated clinical department to "${editingDeptVal}".`,
      });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update staff department.',
      });
    } finally {
      setSavingDept(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      (l.patient_id && l.patient_id.toLowerCase().includes(q)) ||
      l.user_id.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  const filteredStaff = staffList.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.user_id.toLowerCase().includes(q) ||
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      (s.department && s.department.toLowerCase().includes(q));

    const matchesDept =
      !staffDeptFilter ||
      (s.department && s.department.toLowerCase() === staffDeptFilter.toLowerCase());

    return matchesSearch && matchesDept;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'doctor':
        return <span className="bg-teal-100 text-teal-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-teal-200">Doctor / Clinician</span>;
      case 'admin':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-purple-200">Administrator</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">Receptionist</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-teal-600" />
            System Architecture & Staff Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered medical staff directory with system IDs (DOC-100X, REC-100X, ADM-100X) & immutable audit trail.
          </p>
        </div>

        <button
          onClick={() => { fetchLogs(); fetchStaff(); }}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Records
        </button>
      </div>

      {/* System Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 rounded-lg text-teal-700">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">AI Model</span>
            <span className="text-xs font-bold text-slate-800">Ollama / NLP Heuristic</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">● Ready & Operational</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-700">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">OCR Engine</span>
            <span className="text-xs font-bold text-slate-800">Tesseract / Fallback</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">● Dual Mode Active</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-700">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">Medical APIs</span>
            <span className="text-xs font-bold text-slate-800">NIH RxNav & openFDA</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">● Authoritative Live</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 rounded-lg text-purple-700">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">RBAC & Isolation</span>
            <span className="text-xs font-bold text-slate-800">System User IDs</span>
            <span className="text-[10px] text-purple-600 font-semibold block mt-0.5">● Multi-Tenant Active</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('audit'); setSearch(''); }}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          System Audit Trail ({logs.length})
        </button>

        <button
          onClick={() => { setActiveTab('staff'); setSearch(''); }}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Directory ({staffList.length})
        </button>
      </div>

      {/* TAB 1: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Immutable Activity Trail ({filteredLogs.length} Events)
            </h3>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by action, subject, or user ID..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Subject ID</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-teal-800 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">
                      {log.patient_id || 'System'}
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                      {log.user_id}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {log.details}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                      No matching audit entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF DIRECTORY */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-5">
          {actionMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                actionMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionMsg.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{actionMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionMsg(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                System-Generated Staff Accounts ({filteredStaff.length} Members)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every user receives an auto-generated sequential ID (<code className="text-teal-700">DOC-100X</code>, <code className="text-teal-700">REC-100X</code>, <code className="text-teal-700">ADM-100X</code>).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="w-full sm:w-64">
                <DepartmentSelect
                  value={staffDeptFilter}
                  onChange={(dept) => setStaffDeptFilter(dept)}
                  onClear={() => setStaffDeptFilter('')}
                  placeholder="Filter by Department..."
                  showLabel={false}
                  compact
                />
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, name, email..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">System User ID</th>
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Registered At</th>
                  {user?.role === 'admin' && (
                    <th className="py-2.5 px-3 text-right">Admin Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-teal-800">
                      <span className="bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {staff.user_id}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {staff.full_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {staff.email}
                    </td>
                    <td className="py-2.5 px-3">
                      {getRoleBadge(staff.role)}
                    </td>
                    <td className="py-2.5 px-3">
                      {staff.role === 'doctor' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-900 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/90 shadow-2xs">
                          <Stethoscope className="w-3 h-3 text-teal-600 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {staff.department || 'General Medicine (Internal Medicine)'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Not Applicable</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <BadgeCheck className="w-3 h-3 text-emerald-600" />
                        Active
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(staff.created_at).toLocaleDateString()}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="py-2.5 px-3 text-right">
                        {staff.role === 'doctor' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaffId(staff.user_id);
                              setEditingDeptVal(staff.department || 'General Medicine (Internal Medicine)');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md text-[11px] font-semibold transition"
                          >
                            <Edit2 className="w-3 h-3 text-teal-600" />
                            <span>Edit Department</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 8 : 7} className="py-6 text-center text-slate-400 text-xs">
                      No staff members match the search query or department filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Admin Department Edit Modal */}
          {editingStaffId && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                    <h3 className="font-bold text-sm text-slate-900">Reassign Doctor Specialty</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingStaffId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Select an accredited hospital department for{' '}
                  <strong className="text-slate-900">
                    {staffList.find((s) => s.user_id === editingStaffId)?.full_name}
                  </strong>{' '}
                  ({editingStaffId}).
                </p>
                <DepartmentSelect
                  value={editingDeptVal}
                  onChange={(dept) => setEditingDeptVal(dept)}
                  label="Accredited Hospital Department *"
                />
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingStaffId(null)}
                    disabled={savingDept}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStaffDepartment(editingStaffId)}
                    disabled={savingDept || !editingDeptVal}
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                  >
                    {savingDept ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Save Department</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsAudit;
