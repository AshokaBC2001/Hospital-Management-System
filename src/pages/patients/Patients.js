import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Eye, Pencil, Trash2, Users, FileHeart } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/FormField';
import useCollection from '../../hooks/useCollection';
import { generateSequentialId, BLOOD_GROUPS, formatDate } from '../../utils/helpers';

const EMPTY_FORM = {
  name: '',
  age: '',
  gender: 'Male',
  contact: '',
  email: '',
  address: '',
  bloodGroup: 'O+',
  status: 'Active',
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Patient name is required.';
  if (!form.age || Number(form.age) <= 0 || Number(form.age) > 150) errors.age = 'Enter a valid age (1–150).';
  if (!form.contact.trim()) errors.contact = 'Contact number is required.';
  else if (!/^[\d+\-() ]{7,20}$/.test(form.contact.trim())) errors.contact = 'Enter a valid phone number.';
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.address.trim()) errors.address = 'Address is required.';
  return errors;
}

function Patients() {
  const location = useLocation();
  const { documents: patients, loading } = useCollection('patients');
  const { documents: records } = useCollection('medical_records');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // patient being edited, or null for add
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location.state?.openNew) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesSearch =
        !term ||
        p.name?.toLowerCase().includes(term) ||
        p.patientId?.toLowerCase().includes(term) ||
        p.contact?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [patients, search, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (patient) => {
    setEditing(patient);
    setForm({
      name: patient.name || '',
      age: patient.age || '',
      gender: patient.gender || 'Male',
      contact: patient.contact || '',
      email: patient.email || '',
      address: patient.address || '',
      bloodGroup: patient.bloodGroup || 'O+',
      status: patient.status || 'Active',
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
        age: Number(form.age),
        contact: form.contact.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      };
      if (editing) {
        await updateDoc(doc(db, 'patients', editing.id), data);
        toast.success('Patient updated successfully');
      } else {
        const patientId = await generateSequentialId('patients', 'patientId', 'P');
        await addDoc(collection(db, 'patients'), {
          ...data,
          patientId,
          createdAt: serverTimestamp(),
        });
        toast.success(`Patient registered (${patientId})`);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(editing ? 'Failed to update patient' : 'Failed to register patient');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'patients', deleting.id));
      toast.success('Patient deleted');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete patient');
    } finally {
      setSaving(false);
    }
  };

  const patientHistory = viewing
    ? records.filter((r) => r.patientId === viewing.id || r.patientName === viewing.name)
    : [];

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Patients</h2>
          <p className="text-sm text-slate-500">{patients.length} registered patients</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Patient
        </button>
      </div>

      {/* Toolbar */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by name, ID or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search patients"
          />
        </div>
        <select
          className="input-field w-auto cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading patients..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter !== 'All' ? 'No matching patients' : 'No patients yet'}
            message={
              search || statusFilter !== 'All'
                ? 'Try adjusting your search or filter.'
                : 'Register your first patient to get started.'
            }
            action={
              !search && statusFilter === 'All' ? (
                <button type="button" className="btn-primary" onClick={openAdd}>
                  <Plus className="w-4 h-4" aria-hidden="true" /> Add Patient
                </button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-head">ID</th>
                  <th className="table-head">Name</th>
                  <th className="table-head">Age</th>
                  <th className="table-head">Gender</th>
                  <th className="table-head">Blood Group</th>
                  <th className="table-head">Contact</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-blue-600">{p.patientId}</td>
                    <td className="table-cell font-medium text-slate-900">{p.name}</td>
                    <td className="table-cell">{p.age}</td>
                    <td className="table-cell">{p.gender}</td>
                    <td className="table-cell">{p.bloodGroup}</td>
                    <td className="table-cell">{p.contact}</td>
                    <td className="table-cell">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(p)}
                          aria-label={`View ${p.name}`}
                          title="View"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.name}`}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(p)}
                          aria-label={`Delete ${p.name}`}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Patient' : 'Register New Patient'}
        subtitle={editing ? `Updating ${editing.patientId}` : 'Fill in the patient details below'}
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
              placeholder="e.g. John Doe"
            />
            <Input
              label="Age"
              required
              name="age"
              type="number"
              min="1"
              max="150"
              value={form.age}
              onChange={handleChange}
              error={errors.age}
              placeholder="e.g. 34"
            />
            <Select label="Gender" required name="gender" value={form.gender} onChange={handleChange}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </Select>
            <Select label="Blood Group" required name="bloodGroup" value={form.bloodGroup} onChange={handleChange}>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg}>{bg}</option>
              ))}
            </Select>
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
              placeholder="patient@example.com"
            />
            <Textarea
              label="Address"
              required
              name="address"
              value={form.address}
              onChange={handleChange}
              error={errors.address}
              placeholder="Street, city, state"
              className="sm:col-span-2"
              rows={2}
            />
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
              {saving ? 'Saving...' : editing ? 'Update Patient' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Patient Details"
        subtitle={viewing?.patientId}
        size="lg"
      >
        {viewing && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                ['Name', viewing.name],
                ['Age', viewing.age],
                ['Gender', viewing.gender],
                ['Blood Group', viewing.bloodGroup],
                ['Contact', viewing.contact],
                ['Email', viewing.email || '—'],
                ['Registered', formatDate(viewing.createdAt)],
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
            <div className="mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Address</p>
              <p className="text-sm text-slate-700 mt-0.5">{viewing.address}</p>
            </div>

            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileHeart className="w-4 h-4 text-blue-600" aria-hidden="true" /> Medical History
            </h3>
            {patientHistory.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">
                No medical records found for this patient.
              </p>
            ) : (
              <ul className="space-y-3">
                {patientHistory.map((r) => (
                  <li key={r.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{r.diagnosis}</p>
                      <p className="text-xs text-slate-500">{formatDate(r.date)}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Attended by {r.doctorName}</p>
                    {r.treatment && <p className="text-sm text-slate-600 mt-2">{r.treatment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete patient?"
        message={`This will permanently remove ${deleting?.name} (${deleting?.patientId}) from the system. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default Patients;
