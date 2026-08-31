import React, { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Plus, Search, Eye, Pencil, Trash2, UserCog, CalendarCheck, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Select, Input, Textarea } from '../../components/ui/FormField';
import useCollection from '../../hooks/useCollection';
import { generateSequentialId, DEPARTMENTS, todayISO, formatDate } from '../../utils/helpers';

const STAFF_ROLES = ['Doctor', 'Nurse', 'Receptionist', 'Lab Staff', 'Pharmacist', 'Accountant', 'Admin'];
const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity', 'Unpaid Leave'];

const EMPTY_FORM = {
  name: '',
  role: STAFF_ROLES[0],
  department: DEPARTMENTS[0],
  contact: '',
  email: '',
  address: '',
  joinDate: todayISO(),
  status: 'Active',
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Employee name is required.';
  if (!form.contact.trim()) errors.contact = 'Contact number is required.';
  else if (!/^[\d+\-() ]{7,20}$/.test(form.contact.trim())) errors.contact = 'Enter a valid phone number.';
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.joinDate) errors.joinDate = 'Join date is required.';
  return errors;
}

function Staff() {
  const { documents: employees, loading } = useCollection('employees');

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [leaveFor, setLeaveFor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [leaveForm, setLeaveForm] = useState({ startDate: todayISO(), endDate: todayISO(), type: LEAVE_TYPES[0], reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (departmentFilter !== 'All' && emp.department !== departmentFilter) return false;
      if (roleFilter !== 'All' && emp.role !== roleFilter) return false;
      if (term && !emp.name?.toLowerCase().includes(term) && !emp.employeeId?.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [employees, search, departmentFilter, roleFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      name: emp.name || '',
      role: emp.role || STAFF_ROLES[0],
      department: emp.department || DEPARTMENTS[0],
      contact: emp.contact || '',
      email: emp.email || '',
      address: emp.address || '',
      joinDate: emp.joinDate || todayISO(),
      status: emp.status || 'Active',
    });
    setErrors({});
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        name: form.name.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      };
      if (editing) {
        await updateDoc(doc(db, 'employees', editing.id), data);
        toast.success('Employee updated');
      } else {
        const employeeId = await generateSequentialId('employees', 'employeeId', 'E');
        await addDoc(collection(db, 'employees'), {
          ...data,
          employeeId,
          attendance: [],
          leaveRecords: [],
          createdAt: serverTimestamp(),
        });
        toast.success(`Employee registered (${employeeId})`);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(editing ? 'Failed to update employee' : 'Failed to register employee');
    } finally {
      setSaving(false);
    }
  };

  const markAttendance = async (emp, status) => {
    const today = todayISO();
    const existing = (emp.attendance || []).find((a) => a.date === today);
    if (existing) {
      toast.error(`Attendance already marked ${existing.status} for today`);
      return;
    }
    try {
      await updateDoc(doc(db, 'employees', emp.id), {
        attendance: arrayUnion({ date: today, status }),
      });
      toast.success(`${emp.name} marked ${status} for today`);
      if (viewing?.id === emp.id) {
        setViewing({ ...viewing, attendance: [...(viewing.attendance || []), { date: today, status }] });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark attendance');
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!leaveForm.startDate) errs.startDate = 'Start date is required.';
    if (!leaveForm.endDate) errs.endDate = 'End date is required.';
    if (leaveForm.startDate && leaveForm.endDate && leaveForm.endDate < leaveForm.startDate)
      errs.endDate = 'End date must be after start date.';
    if (!leaveForm.reason.trim()) errs.reason = 'Reason is required.';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const record = {
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        type: leaveForm.type,
        reason: leaveForm.reason.trim(),
      };
      await updateDoc(doc(db, 'employees', leaveFor.id), { leaveRecords: arrayUnion(record) });
      toast.success('Leave record added');
      setLeaveFor(null);
      setErrors({});
    } catch (err) {
      console.error(err);
      toast.error('Failed to add leave record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'employees', deleting.id));
      toast.success('Employee removed');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete employee');
    } finally {
      setSaving(false);
    }
  };

  const attendanceSummary = (emp) => {
    const list = emp?.attendance || [];
    return {
      present: list.filter((a) => a.status === 'Present').length,
      absent: list.filter((a) => a.status === 'Absent').length,
      leave: list.filter((a) => a.status === 'Leave').length,
    };
  };

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Staff</h2>
          <p className="text-sm text-slate-500">{employees.length} employees</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Employee
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by name or employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search staff"
          />
        </div>
        <select
          className="input-field w-auto cursor-pointer"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="All">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          className="input-field w-auto cursor-pointer"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="All">All Roles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading staff..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No employees found"
            message="Register an employee or adjust your filters."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Add Employee
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-head">ID</th>
                  <th className="table-head">Name</th>
                  <th className="table-head">Role</th>
                  <th className="table-head">Department</th>
                  <th className="table-head">Contact</th>
                  <th className="table-head">Join Date</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Attendance Today</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => {
                  const todayMark = (emp.attendance || []).find((a) => a.date === todayISO());
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-medium text-blue-600">{emp.employeeId}</td>
                      <td className="table-cell font-medium text-slate-900">{emp.name}</td>
                      <td className="table-cell">{emp.role}</td>
                      <td className="table-cell">{emp.department}</td>
                      <td className="table-cell">{emp.contact}</td>
                      <td className="table-cell">{formatDate(emp.joinDate)}</td>
                      <td className="table-cell">
                        <StatusBadge status={emp.status} />
                      </td>
                      <td className="table-cell">
                        {todayMark ? (
                          <StatusBadge status={todayMark.status} />
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {['Present', 'Absent', 'Leave'].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => markAttendance(emp, s)}
                                title={`Mark ${s}`}
                                className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                                  s === 'Present'
                                    ? 'text-green-700 border-green-200 hover:bg-green-50'
                                    : s === 'Absent'
                                    ? 'text-red-700 border-red-200 hover:bg-red-50'
                                    : 'text-amber-700 border-amber-200 hover:bg-amber-50'
                                }`}
                              >
                                {s[0]}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setLeaveFor(emp);
                              setLeaveForm({ startDate: todayISO(), endDate: todayISO(), type: LEAVE_TYPES[0], reason: '' });
                              setErrors({});
                            }}
                            aria-label={`Add leave for ${emp.name}`}
                            title="Add leave record"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewing(emp)}
                            aria-label={`View ${emp.name}`}
                            title="View"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(emp)}
                            aria-label={`Edit ${emp.name}`}
                            title="Edit"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(emp)}
                            aria-label={`Delete ${emp.name}`}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Employee' : 'Register Employee'}
        subtitle="Employee profile details"
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" required name="name" value={form.name} onChange={handleChange} error={errors.name} placeholder="e.g. Jane Smith" />
            <Select label="Role" required name="role" value={form.role} onChange={handleChange}>
              {STAFF_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Select label="Department" required name="department" value={form.department} onChange={handleChange}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Input label="Contact Number" required name="contact" value={form.contact} onChange={handleChange} error={errors.contact} placeholder="e.g. +1 555 0123" />
            <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} placeholder="employee@hospital.com" />
            <Input label="Join Date" required name="joinDate" type="date" value={form.joinDate} onChange={handleChange} error={errors.joinDate} />
            <Textarea label="Address" name="address" value={form.address} onChange={handleChange} className="sm:col-span-2" rows={2} placeholder="Street, city, state" />
            <Select label="Status" required name="status" value={form.status} onChange={handleChange}>
              <option>Active</option>
              <option>Inactive</option>
            </Select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Employee' : 'Register Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Employee Profile" subtitle={viewing?.employeeId} size="lg">
        {viewing && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                ['Name', viewing.name],
                ['Role', viewing.role],
                ['Department', viewing.department],
                ['Contact', viewing.contact],
                ['Email', viewing.email || '—'],
                ['Join Date', formatDate(viewing.joinDate)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 break-words">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
                <div className="mt-1">
                  <StatusBadge status={viewing.status} />
                </div>
              </div>
            </div>
            {viewing.address && (
              <div className="mb-6">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Address</p>
                <p className="text-sm text-slate-700 mt-0.5">{viewing.address}</p>
              </div>
            )}

            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" aria-hidden="true" /> Attendance Summary
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(() => {
                const s = attendanceSummary(viewing);
                return [
                  ['Present', s.present, 'text-green-700 bg-green-50 border-green-200'],
                  ['Absent', s.absent, 'text-red-700 bg-red-50 border-red-200'],
                  ['Leave', s.leave, 'text-amber-700 bg-amber-50 border-amber-200'],
                ].map(([label, count, style]) => (
                  <div key={label} className={`rounded-lg border p-3 text-center ${style}`}>
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs font-medium">{label}</p>
                  </div>
                ));
              })()}
            </div>

            <h3 className="text-sm font-semibold text-slate-900 mb-3">Leave Records</h3>
            {(viewing.leaveRecords || []).length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">No leave records.</p>
            ) : (
              <ul className="space-y-2">
                {viewing.leaveRecords.map((l, i) => (
                  <li key={i} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{l.type}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(l.startDate)} — {formatDate(l.endDate)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 max-w-[240px] truncate">{l.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* Leave modal */}
      <Modal open={!!leaveFor} onClose={() => setLeaveFor(null)} title="Add Leave Record" subtitle={leaveFor?.name} size="sm">
        <form onSubmit={handleLeaveSubmit} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              required
              type="date"
              value={leaveForm.startDate}
              onChange={(e) => {
                setLeaveForm((f) => ({ ...f, startDate: e.target.value }));
                setErrors((prev) => ({ ...prev, startDate: undefined }));
              }}
              error={errors.startDate}
            />
            <Input
              label="End Date"
              required
              type="date"
              value={leaveForm.endDate}
              onChange={(e) => {
                setLeaveForm((f) => ({ ...f, endDate: e.target.value }));
                setErrors((prev) => ({ ...prev, endDate: undefined }));
              }}
              error={errors.endDate}
            />
          </div>
          <Select
            label="Leave Type"
            required
            className="mt-4"
            value={leaveForm.type}
            onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value }))}
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Textarea
            label="Reason"
            required
            className="mt-4"
            value={leaveForm.reason}
            onChange={(e) => {
              setLeaveForm((f) => ({ ...f, reason: e.target.value }));
              setErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            error={errors.reason}
            rows={2}
            placeholder="Reason for leave..."
          />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setLeaveFor(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Add Leave'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete employee?"
        message={`This will permanently remove ${deleting?.name} (${deleting?.employeeId}) from the system. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default Staff;
