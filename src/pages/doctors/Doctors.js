import React, { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Eye, Pencil, Trash2, Stethoscope, CalendarDays, Phone, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/FormField';
import useCollection from '../../hooks/useCollection';
import { getInitials, DEPARTMENTS, formatDate } from '../../utils/helpers';

const EMPTY_FORM = {
  name: '',
  specialization: '',
  department: DEPARTMENTS[0],
  contact: '',
  email: '',
  qualification: '',
  schedule: '',
  availability: 'Available',
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Doctor name is required.';
  if (!form.specialization.trim()) errors.specialization = 'Specialization is required.';
  if (!form.contact.trim()) errors.contact = 'Contact number is required.';
  else if (!/^[\d+\-() ]{7,20}$/.test(form.contact.trim())) errors.contact = 'Enter a valid phone number.';
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.qualification.trim()) errors.qualification = 'Qualification is required.';
  return errors;
}

function Doctors() {
  const { documents: doctors, loading } = useCollection('doctors');
  const { documents: appointments } = useCollection('appointments');

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return doctors.filter((d) => {
      const matchesSearch =
        !term ||
        d.name?.toLowerCase().includes(term) ||
        d.specialization?.toLowerCase().includes(term) ||
        d.department?.toLowerCase().includes(term);
      const matchesDept = departmentFilter === 'All' || d.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [doctors, search, departmentFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      name: d.name || '',
      specialization: d.specialization || '',
      department: d.department || DEPARTMENTS[0],
      contact: d.contact || '',
      email: d.email || '',
      qualification: d.qualification || '',
      schedule: d.schedule || '',
      availability: d.availability || 'Available',
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
        specialization: form.specialization.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        qualification: form.qualification.trim(),
        schedule: form.schedule.trim(),
      };
      if (editing) {
        await updateDoc(doc(db, 'doctors', editing.id), data);
        toast.success('Doctor updated successfully');
      } else {
        await addDoc(collection(db, 'doctors'), { ...data, createdAt: serverTimestamp() });
        toast.success('Doctor added successfully');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(editing ? 'Failed to update doctor' : 'Failed to add doctor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'doctors', deleting.id));
      toast.success('Doctor removed');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete doctor');
    } finally {
      setSaving(false);
    }
  };

  const doctorAppointments = viewing
    ? appointments.filter((a) => a.doctorId === viewing.id || a.doctorName === viewing.name).slice(0, 8)
    : [];

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Doctors</h2>
          <p className="text-sm text-slate-500">{doctors.length} doctors on staff</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Doctor
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by name, specialization or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search doctors"
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
      </div>

      {loading ? (
        <div className="card">
          <Spinner label="Loading doctors..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Stethoscope}
            title={search || departmentFilter !== 'All' ? 'No matching doctors' : 'No doctors yet'}
            message={
              search || departmentFilter !== 'All'
                ? 'Try adjusting your search or filter.'
                : 'Add your first doctor to get started.'
            }
            action={
              !search && departmentFilter === 'All' ? (
                <button type="button" className="btn-primary" onClick={openAdd}>
                  <Plus className="w-4 h-4" aria-hidden="true" /> Add Doctor
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div key={d.id} className="card p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600 font-semibold">
                  {getInitials(d.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{d.name}</p>
                  <p className="text-xs text-blue-600 font-medium truncate">{d.specialization}</p>
                  <p className="text-xs text-slate-500 truncate">{d.department}</p>
                </div>
                <StatusBadge status={d.availability} />
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" /> {d.contact}
                </p>
                {d.email && (
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /> {d.email}
                  </p>
                )}
                {d.schedule && (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> {d.schedule}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setViewing(d)}
                  aria-label={`View ${d.name}`}
                  title="View"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(d)}
                  aria-label={`Edit ${d.name}`}
                  title="Edit"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(d)}
                  aria-label={`Delete ${d.name}`}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Doctor' : 'Add New Doctor'}
        subtitle="Enter the doctor's professional details"
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              name="name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="e.g. Dr. Sarah Chen"
            />
            <Input
              label="Specialization"
              required
              name="specialization"
              value={form.specialization}
              onChange={handleChange}
              error={errors.specialization}
              placeholder="e.g. Cardiologist"
            />
            <Select label="Department" required name="department" value={form.department} onChange={handleChange}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Input
              label="Qualification"
              required
              name="qualification"
              value={form.qualification}
              onChange={handleChange}
              error={errors.qualification}
              placeholder="e.g. MBBS, MD"
            />
            <Input
              label="Contact Number"
              required
              name="contact"
              value={form.contact}
              onChange={handleChange}
              error={errors.contact}
              placeholder="e.g. +1 555 0123"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="doctor@hospital.com"
            />
            <Input
              label="Schedule"
              name="schedule"
              value={form.schedule}
              onChange={handleChange}
              placeholder="e.g. Mon–Fri, 9:00 AM – 5:00 PM"
            />
            <Select label="Availability" required name="availability" value={form.availability} onChange={handleChange}>
              <option>Available</option>
              <option>Unavailable</option>
            </Select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Doctor' : 'Add Doctor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Doctor Profile" size="lg">
        {viewing && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
                {getInitials(viewing.name)}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{viewing.name}</p>
                <p className="text-sm text-blue-600">{viewing.specialization}</p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={viewing.availability} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                ['Department', viewing.department],
                ['Qualification', viewing.qualification],
                ['Contact', viewing.contact],
                ['Email', viewing.email || '—'],
                ['Schedule', viewing.schedule || '—'],
                ['Joined', formatDate(viewing.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 break-words">{value}</p>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Appointments</h3>
            {doctorAppointments.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">No appointments found.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="table-head">Patient</th>
                      <th className="table-head">Date</th>
                      <th className="table-head">Time</th>
                      <th className="table-head">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctorAppointments.map((a) => (
                      <tr key={a.id}>
                        <td className="table-cell font-medium text-slate-900">{a.patientName}</td>
                        <td className="table-cell">{formatDate(a.date)}</td>
                        <td className="table-cell">{a.time}</td>
                        <td className="table-cell">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete doctor?"
        message={`This will permanently remove ${deleting?.name} from the system. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default Doctors;
