import React, { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Eye, Pencil, Trash2, FileHeart, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Select, Input, Textarea } from '../../components/ui/FormField';
import useCollection from '../../hooks/useCollection';
import { todayISO, formatDate } from '../../utils/helpers';

const EMPTY_FORM = {
  patientId: '',
  doctorId: '',
  diagnosis: '',
  prescription: '',
  treatment: '',
  notes: '',
  date: todayISO(),
};

function MedicalRecords() {
  const { documents: records, loading } = useCollection('medical_records');
  const { documents: patients } = useCollection('patients');
  const { documents: doctors } = useCollection('doctors');

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [timelinePatient, setTimelinePatient] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (term && !r.patientName?.toLowerCase().includes(term)) return false;
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
      return true;
    });
  }, [records, search, fromDate, toDate]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      patientId: r.patientId || '',
      doctorId: r.doctorId || '',
      diagnosis: r.diagnosis || '',
      prescription: r.prescription || '',
      treatment: r.treatment || '',
      notes: r.notes || '',
      date: r.date || todayISO(),
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.patientId) errs.patientId = 'Please select a patient.';
    if (!form.doctorId) errs.doctorId = 'Please select a doctor.';
    if (!form.diagnosis.trim()) errs.diagnosis = 'Diagnosis is required.';
    if (!form.date) errs.date = 'Date is required.';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const patient = patients.find((p) => p.id === form.patientId);
    const doctor = doctors.find((d) => d.id === form.doctorId);
    if (!patient || !doctor) {
      toast.error('Selected patient or doctor no longer exists');
      return;
    }
    setSaving(true);
    try {
      const data = {
        patientId: patient.id,
        patientName: patient.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
        diagnosis: form.diagnosis.trim(),
        prescription: form.prescription.trim(),
        treatment: form.treatment.trim(),
        notes: form.notes.trim(),
        date: form.date,
      };
      if (editing) {
        await updateDoc(doc(db, 'medical_records', editing.id), data);
        toast.success('Record updated');
      } else {
        await addDoc(collection(db, 'medical_records'), { ...data, createdAt: serverTimestamp() });
        toast.success('Medical record added');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(editing ? 'Failed to update record' : 'Failed to add record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'medical_records', deleting.id));
      toast.success('Record deleted');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete record');
    } finally {
      setSaving(false);
    }
  };

  const timelineRecords = timelinePatient
    ? records
        .filter((r) => r.patientId === timelinePatient.patientId)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [];

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Medical Records</h2>
          <p className="text-sm text-slate-500">{records.length} records on file</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Record
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search records"
          />
        </div>
        <input
          type="date"
          className="input-field w-auto"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label="From date"
        />
        <span className="text-sm text-slate-400">to</span>
        <input
          type="date"
          className="input-field w-auto"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          aria-label="To date"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading records..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileHeart}
            title="No medical records found"
            message="Add a record or adjust your filters."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Add Record
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-head">Patient</th>
                  <th className="table-head">Doctor</th>
                  <th className="table-head">Diagnosis</th>
                  <th className="table-head">Date</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-900">{r.patientName}</td>
                    <td className="table-cell">{r.doctorName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-[280px] truncate">{r.diagnosis}</td>
                    <td className="table-cell">{formatDate(r.date)}</td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          aria-label="View record"
                          title="View"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimelinePatient(r)}
                          aria-label={`View ${r.patientName}'s history timeline`}
                          title="Patient timeline"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                        >
                          <History className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          aria-label="Edit record"
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(r)}
                          aria-label="Delete record"
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
        title={editing ? 'Edit Medical Record' : 'Add Medical Record'}
        subtitle="Diagnosis, prescription and treatment details"
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Patient" required name="patientId" value={form.patientId} onChange={handleChange} error={errors.patientId}>
              <option value="">Select patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patientId} — {p.name}
                </option>
              ))}
            </Select>
            <Select label="Doctor" required name="doctorId" value={form.doctorId} onChange={handleChange} error={errors.doctorId}>
              <option value="">Select doctor...</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialization}
                </option>
              ))}
            </Select>
            <Input label="Date" required type="date" name="date" value={form.date} onChange={handleChange} error={errors.date} />
            <div className="hidden sm:block" />
            <Textarea
              label="Diagnosis"
              required
              name="diagnosis"
              value={form.diagnosis}
              onChange={handleChange}
              error={errors.diagnosis}
              className="sm:col-span-2"
              placeholder="Primary diagnosis and findings..."
            />
            <Textarea
              label="Prescription"
              name="prescription"
              value={form.prescription}
              onChange={handleChange}
              className="sm:col-span-2"
              placeholder="Medications, dosage and duration..."
            />
            <Textarea
              label="Treatment"
              name="treatment"
              value={form.treatment}
              onChange={handleChange}
              className="sm:col-span-2"
              placeholder="Treatment plan and procedures..."
            />
            <Textarea
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="sm:col-span-2"
              placeholder="Additional observations..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Medical Record" subtitle={viewing?.patientName} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                ['Patient', viewing.patientName],
                ['Doctor', viewing.doctorName],
                ['Date', formatDate(viewing.date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {[
              ['Diagnosis', viewing.diagnosis],
              ['Prescription', viewing.prescription],
              ['Treatment', viewing.treatment],
              ['Notes', viewing.notes],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
                </div>
              ))}
          </div>
        )}
      </Modal>

      {/* Timeline modal */}
      <Modal
        open={!!timelinePatient}
        onClose={() => setTimelinePatient(null)}
        title="Medical History Timeline"
        subtitle={timelinePatient?.patientName}
        size="lg"
      >
        {timelineRecords.length === 0 ? (
          <p className="text-sm text-slate-500">No records found for this patient.</p>
        ) : (
          <ol className="relative border-l-2 border-slate-200 ml-3 space-y-6">
            {timelineRecords.map((r) => (
              <li key={r.id} className="ml-6">
                <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-blue-600 border-4 border-white" />
                <p className="text-xs text-slate-400">{formatDate(r.date)}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{r.diagnosis}</p>
                <p className="text-xs text-slate-500 mt-0.5">Attended by {r.doctorName}</p>
                {r.prescription && (
                  <p className="text-sm text-slate-600 mt-1.5">
                    <span className="font-medium">Rx:</span> {r.prescription}
                  </p>
                )}
                {r.treatment && <p className="text-sm text-slate-600 mt-1">{r.treatment}</p>}
              </li>
            ))}
          </ol>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete medical record?"
        message={`This will permanently remove ${deleting?.patientName}'s record dated ${formatDate(
          deleting?.date
        )}. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default MedicalRecords;
