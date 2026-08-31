import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Pencil, XCircle, CalendarDays } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Input, Textarea } from '../../components/ui/FormField';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useCollection from '../../hooks/useCollection';
import { todayISO, formatDate } from '../../utils/helpers';

const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];

const EMPTY_FORM = {
  patientId: '',
  doctorId: '',
  date: todayISO(),
  time: '09:00',
  notes: '',
};

function Appointments() {
  const location = useLocation();
  const { documents: appointments, loading } = useCollection('appointments');
  const { documents: patients } = useCollection('patients');
  const { documents: doctors } = useCollection('doctors');

  const [dateFilter, setDateFilter] = useState('All');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location.state?.openNew) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = todayISO();
    const now = new Date();

    return appointments
      .filter((a) => {
        if (statusFilter !== 'All' && a.status !== statusFilter) return false;
        if (term && !a.patientName?.toLowerCase().includes(term) && !a.doctorName?.toLowerCase().includes(term))
          return false;

        if (dateFilter === 'All') return true;
        const d = a.date ? parseISO(a.date) : null;
        if (!d || !isValid(d)) return false;
        if (dateFilter === 'Today') return a.date === today;
        if (dateFilter === 'This Week') return d >= startOfWeek(now, { weekStartsOn: 1 }) && d <= endOfWeek(now, { weekStartsOn: 1 });
        if (dateFilter === 'This Month') return d >= startOfMonth(now) && d <= endOfMonth(now);
        if (dateFilter === 'Custom') {
          if (customFrom && a.date < customFrom) return false;
          if (customTo && a.date > customTo) return false;
          return true;
        }
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
  }, [appointments, statusFilter, search, dateFilter, customFrom, customTo]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      patientId: a.patientId || '',
      doctorId: a.doctorId || '',
      date: a.date || todayISO(),
      time: a.time || '09:00',
      notes: a.notes || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.patientId) errs.patientId = 'Please select a patient.';
    if (!form.doctorId) errs.doctorId = 'Please select a doctor.';
    if (!form.date) errs.date = 'Please choose a date.';
    if (!form.time) errs.time = 'Please choose a time.';
    return errs;
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
        department: doctor.department || '',
        date: form.date,
        time: form.time,
        notes: form.notes.trim(),
      };
      if (editing) {
        await updateDoc(doc(db, 'appointments', editing.id), data);
        toast.success('Appointment updated');
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...data,
          status: 'Pending',
          createdAt: serverTimestamp(),
        });
        toast.success('Appointment booked');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(editing ? 'Failed to update appointment' : 'Failed to book appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (appointment, status) => {
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), { status });
      toast.success(`Appointment marked ${status}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleCancel = async () => {
    if (!cancelling) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'appointments', cancelling.id), { status: 'Cancelled' });
      toast.success('Appointment cancelled');
      setCancelling(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Appointments</h2>
          <p className="text-sm text-slate-500">{appointments.length} total appointments</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Book Appointment
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by patient or doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search appointments"
          />
        </div>
        <select
          className="input-field w-auto cursor-pointer"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter by date"
        >
          <option>All</option>
          <option>Today</option>
          <option>This Week</option>
          <option>This Month</option>
          <option>Custom</option>
        </select>
        {dateFilter === 'Custom' && (
          <>
            <input
              type="date"
              className="input-field w-auto"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="From date"
            />
            <span className="text-sm text-slate-400">to</span>
            <input
              type="date"
              className="input-field w-auto"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="To date"
            />
          </>
        )}
        <select
          className="input-field w-auto cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading appointments..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No appointments found"
            message="Try adjusting the filters, or book a new appointment."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Book Appointment
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
                  <th className="table-head">Department</th>
                  <th className="table-head">Date</th>
                  <th className="table-head">Time</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-900">{a.patientName}</td>
                    <td className="table-cell">{a.doctorName}</td>
                    <td className="table-cell">{a.department || '—'}</td>
                    <td className="table-cell">{formatDate(a.date)}</td>
                    <td className="table-cell">{a.time}</td>
                    <td className="table-cell">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <select
                          className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white cursor-pointer focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={a.status}
                          onChange={(e) => handleStatusChange(a, e.target.value)}
                          disabled={a.status === 'Cancelled'}
                          aria-label={`Update status for ${a.patientName}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          aria-label="Reschedule appointment"
                          title="Reschedule / Edit"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelling(a)}
                          aria-label="Cancel appointment"
                          title="Cancel"
                          disabled={a.status === 'Cancelled' || a.status === 'Completed'}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-4 h-4" aria-hidden="true" />
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

      {/* Book / Reschedule modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Reschedule Appointment' : 'Book Appointment'}
        subtitle={editing ? `${editing.patientName} with ${editing.doctorName}` : 'Schedule a new appointment'}
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Patient"
              required
              error={errors.patientId}
              placeholder="Select patient..."
              emptyMessage="No patients found"
              value={form.patientId}
              onChange={(val) => {
                setForm((f) => ({ ...f, patientId: val }));
                setErrors((prev) => ({ ...prev, patientId: undefined }));
              }}
              options={patients.map((p) => ({ value: p.id, label: p.name, hint: p.patientId }))}
            />
            <SearchableSelect
              label="Doctor"
              required
              error={errors.doctorId}
              placeholder="Select doctor..."
              emptyMessage="No doctors found"
              value={form.doctorId}
              onChange={(val) => {
                setForm((f) => ({ ...f, doctorId: val }));
                setErrors((prev) => ({ ...prev, doctorId: undefined }));
              }}
              options={doctors.map((d) => ({
                value: d.id,
                label: d.name,
                hint: [d.specialization, d.department].filter(Boolean).join(' · '),
              }))}
            />
            <Input
              label="Date"
              required
              type="date"
              value={form.date}
              onChange={(e) => {
                setForm((f) => ({ ...f, date: e.target.value }));
                setErrors((prev) => ({ ...prev, date: undefined }));
              }}
              error={errors.date}
            />
            <Input
              label="Time"
              required
              type="time"
              value={form.time}
              onChange={(e) => {
                setForm((f) => ({ ...f, time: e.target.value }));
                setErrors((prev) => ({ ...prev, time: undefined }));
              }}
              error={errors.time}
            />
            <Textarea
              label="Notes"
              className="sm:col-span-2"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Reason for visit, symptoms, special instructions..."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Appointment' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={handleCancel}
        loading={saving}
        title="Cancel appointment?"
        confirmLabel="Cancel Appointment"
        message={`Cancel ${cancelling?.patientName}'s appointment with ${cancelling?.doctorName} on ${formatDate(
          cancelling?.date
        )} at ${cancelling?.time}?`}
      />
    </Layout>
  );
}

export default Appointments;
