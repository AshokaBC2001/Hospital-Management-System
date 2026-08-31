import React, { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Eye, FlaskConical, ClipboardEdit, Trash2, ArrowRight } from 'lucide-react';
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
import { todayISO, formatDate } from '../../utils/helpers';

const LAB_STATUSES = ['Requested', 'Sample Collected', 'Processing', 'Completed'];
const TEST_TYPES = ['Blood Test', 'Urine Test', 'Imaging', 'Biopsy', 'Microbiology', 'Pathology', 'Other'];

const EMPTY_FORM = {
  patientId: '',
  testName: '',
  testType: TEST_TYPES[0],
  requestedBy: '',
  notes: '',
  date: todayISO(),
};

function nextStatus(status) {
  const idx = LAB_STATUSES.indexOf(status);
  return idx >= 0 && idx < LAB_STATUSES.length - 1 ? LAB_STATUSES[idx + 1] : null;
}

function Laboratory() {
  const { documents: tests, loading } = useCollection('lab_tests');
  const { documents: patients } = useCollection('patients');
  const { documents: doctors } = useCollection('doctors');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [resultFor, setResultFor] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resultForm, setResultForm] = useState({ result: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (term && !t.patientName?.toLowerCase().includes(term) && !t.testName?.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [tests, search, statusFilter]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
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
    const errs = {};
    if (!form.patientId) errs.patientId = 'Please select a patient.';
    if (!form.testName.trim()) errs.testName = 'Test name is required.';
    if (!form.requestedBy) errs.requestedBy = 'Please select the requesting doctor.';
    if (!form.date) errs.date = 'Date is required.';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const patient = patients.find((p) => p.id === form.patientId);
    const doctor = doctors.find((d) => d.id === form.requestedBy);
    if (!patient || !doctor) {
      toast.error('Selected patient or doctor no longer exists');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'lab_tests'), {
        patientId: patient.id,
        patientName: patient.name,
        testName: form.testName.trim(),
        testType: form.testType,
        requestedBy: doctor.name,
        requestedById: doctor.id,
        notes: form.notes.trim(),
        date: form.date,
        status: 'Requested',
        result: '',
        createdAt: serverTimestamp(),
      });
      toast.success('Test request created');
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create test request');
    } finally {
      setSaving(false);
    }
  };

  const advanceStatus = async (test) => {
    const next = nextStatus(test.status);
    if (!next) return;
    if (next === 'Completed' && !test.result) {
      // Completing requires a result: open the result entry modal instead.
      setResultFor(test);
      setResultForm({ result: test.result || '', notes: test.resultNotes || '' });
      return;
    }
    try {
      await updateDoc(doc(db, 'lab_tests', test.id), { status: next });
      toast.success(`Status updated to ${next}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleResultSubmit = async (e) => {
    e.preventDefault();
    if (!resultForm.result.trim()) {
      setErrors({ result: 'Result is required to complete the test.' });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'lab_tests', resultFor.id), {
        result: resultForm.result.trim(),
        resultNotes: resultForm.notes.trim(),
        status: 'Completed',
        completedAt: serverTimestamp(),
      });
      toast.success('Result saved — test completed');
      setResultFor(null);
      setErrors({});
    } catch (err) {
      console.error(err);
      toast.error('Failed to save result');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'lab_tests', deleting.id));
      toast.success('Test request deleted');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete test request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Laboratory</h2>
          <p className="text-sm text-slate-500">
            {tests.filter((t) => t.status !== 'Completed').length} tests in progress
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> New Test Request
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by patient or test name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search lab tests"
          />
        </div>
        <select
          className="input-field w-auto cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="All">All Statuses</option>
          {LAB_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading lab tests..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No lab tests found"
            message="Create a test request or adjust your filters."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" aria-hidden="true" /> New Test Request
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-head">Patient</th>
                  <th className="table-head">Test Name</th>
                  <th className="table-head">Type</th>
                  <th className="table-head">Requested By</th>
                  <th className="table-head">Date</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const next = nextStatus(t.status);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-medium text-slate-900">{t.patientName}</td>
                      <td className="table-cell">{t.testName}</td>
                      <td className="table-cell">{t.testType}</td>
                      <td className="table-cell">{t.requestedBy}</td>
                      <td className="table-cell">{formatDate(t.date)}</td>
                      <td className="table-cell">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="table-cell text-right">
                        <div className="inline-flex items-center gap-1">
                          {next && (
                            <button
                              type="button"
                              onClick={() => advanceStatus(t)}
                              title={`Advance to ${next}`}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {next} <ArrowRight className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}
                          {t.status === 'Completed' ? (
                            <button
                              type="button"
                              onClick={() => setViewing(t)}
                              aria-label="View result"
                              title="View result"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setResultFor(t);
                                setResultForm({ result: t.result || '', notes: t.resultNotes || '' });
                                setErrors({});
                              }}
                              aria-label="Enter result"
                              title="Enter result"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors cursor-pointer"
                            >
                              <ClipboardEdit className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleting(t)}
                            aria-label="Delete test"
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

      {/* New request modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Test Request"
        subtitle="Request a laboratory test for a patient"
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
            <Select
              label="Requested By"
              required
              name="requestedBy"
              value={form.requestedBy}
              onChange={handleChange}
              error={errors.requestedBy}
            >
              <option value="">Select doctor...</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialization}
                </option>
              ))}
            </Select>
            <Input
              label="Test Name"
              required
              name="testName"
              value={form.testName}
              onChange={handleChange}
              error={errors.testName}
              placeholder="e.g. Complete Blood Count"
            />
            <Select label="Test Type" required name="testType" value={form.testType} onChange={handleChange}>
              {TEST_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Input label="Date" required type="date" name="date" value={form.date} onChange={handleChange} error={errors.date} />
            <Textarea
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="sm:col-span-2"
              placeholder="Clinical indication, fasting status, urgency..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Submitting...' : 'Create Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Result entry modal */}
      <Modal
        open={!!resultFor}
        onClose={() => setResultFor(null)}
        title="Enter Test Result"
        subtitle={resultFor ? `${resultFor.testName} — ${resultFor.patientName}` : ''}
        size="lg"
      >
        <form onSubmit={handleResultSubmit} noValidate>
          <Textarea
            label="Result"
            required
            value={resultForm.result}
            onChange={(e) => {
              setResultForm((f) => ({ ...f, result: e.target.value }));
              setErrors({});
            }}
            error={errors.result}
            rows={5}
            placeholder="Enter test findings and values..."
          />
          <Textarea
            label="Notes"
            className="mt-4"
            value={resultForm.notes}
            onChange={(e) => setResultForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Interpretation, reference ranges, remarks..."
          />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setResultFor(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save & Complete Test'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View result modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Test Result" subtitle={viewing?.testName} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                ['Patient', viewing.patientName],
                ['Test Type', viewing.testType],
                ['Requested By', viewing.requestedBy],
                ['Date', formatDate(viewing.date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
                <div className="mt-1">
                  <StatusBadge status={viewing.status} />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Result</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewing.result || '—'}</p>
            </div>
            {viewing.resultNotes && (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewing.resultNotes}</p>
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
        title="Delete test request?"
        message={`This will permanently remove the ${deleting?.testName} request for ${deleting?.patientName}. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default Laboratory;
