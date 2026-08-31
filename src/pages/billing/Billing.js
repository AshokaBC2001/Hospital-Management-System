import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Eye, Trash2, Receipt, Printer, CheckCircle2, X, HeartPulse } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/FormField';
import useCollection from '../../hooks/useCollection';
import { generateSequentialId, formatCurrency, todayISO, formatDate } from '../../utils/helpers';

const EMPTY_ITEM = { description: '', quantity: 1, unitPrice: '' };

function Billing() {
  const location = useLocation();
  const { documents: bills, loading } = useCollection('billing');
  const { documents: patients } = useCollection('patients');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [taxPercent, setTaxPercent] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('Pending');

  useEffect(() => {
    if (location.state?.openNew) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (statusFilter !== 'All' && b.paymentStatus !== statusFilter) return false;
      if (term && !b.patientName?.toLowerCase().includes(term) && !b.billId?.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [bills, search, statusFilter]);

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const tax = (subtotal * (Number(taxPercent) || 0)) / 100;
  const totalAmount = subtotal + tax;

  const openAdd = () => {
    setPatientId('');
    setItems([{ ...EMPTY_ITEM }]);
    setTaxPercent('0');
    setPaymentMethod('Cash');
    setPaymentStatus('Pending');
    setErrors({});
    setModalOpen(true);
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!patientId) errs.patientId = 'Please select a patient.';
    const validItems = items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
    );
    if (validItems.length === 0) errs.items = 'Add at least one bill item with description, quantity and price.';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      toast.error('Selected patient no longer exists');
      return;
    }
    setSaving(true);
    try {
      const billId = await generateSequentialId('billing', 'billId', 'B');
      await addDoc(collection(db, 'billing'), {
        billId,
        patientId: patient.id,
        patientName: patient.name,
        items: validItems.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          total: Number(it.quantity) * Number(it.unitPrice),
        })),
        subtotal,
        taxPercent: Number(taxPercent) || 0,
        tax,
        totalAmount,
        paymentStatus,
        paymentMethod,
        date: todayISO(),
        createdAt: serverTimestamp(),
      });
      toast.success(`Bill ${billId} generated`);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate bill');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (bill) => {
    try {
      await updateDoc(doc(db, 'billing', bill.id), { paymentStatus: 'Paid' });
      toast.success(`${bill.billId} marked as paid`);
      if (viewing?.id === bill.id) setViewing({ ...viewing, paymentStatus: 'Paid' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update payment status');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'billing', deleting.id));
      toast.success('Bill deleted');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Billing</h2>
          <p className="text-sm text-slate-500">{bills.length} bills issued</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Generate Bill
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by patient name or bill ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bills"
          />
        </div>
        <select
          className="input-field w-auto cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by payment status"
        >
          <option value="All">All Statuses</option>
          <option>Pending</option>
          <option>Paid</option>
          <option>Partial</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading bills..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No bills found"
            message="Generate a bill or adjust your filters."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Generate Bill
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-head">Bill ID</th>
                  <th className="table-head">Patient</th>
                  <th className="table-head">Date</th>
                  <th className="table-head">Total Amount</th>
                  <th className="table-head">Payment Status</th>
                  <th className="table-head">Method</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-blue-600">{b.billId}</td>
                    <td className="table-cell font-medium text-slate-900">{b.patientName}</td>
                    <td className="table-cell">{formatDate(b.date)}</td>
                    <td className="table-cell font-semibold">{formatCurrency(b.totalAmount)}</td>
                    <td className="table-cell">
                      <StatusBadge status={b.paymentStatus} />
                    </td>
                    <td className="table-cell">{b.paymentMethod}</td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-1">
                        {b.paymentStatus !== 'Paid' && (
                          <button
                            type="button"
                            onClick={() => markPaid(b)}
                            title="Mark as paid"
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Mark Paid
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setViewing(b)}
                          aria-label={`View invoice ${b.billId}`}
                          title="View invoice"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(b)}
                          aria-label={`Delete bill ${b.billId}`}
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

      {/* Generate bill modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Generate Bill" subtitle="Create an itemized invoice" size="xl">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <Select
              label="Patient"
              required
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setErrors((prev) => ({ ...prev, patientId: undefined }));
              }}
              error={errors.patientId}
            >
              <option value="">Select patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patientId} — {p.name}
                </option>
              ))}
            </Select>
            <Select label="Payment Method" required value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>Cash</option>
              <option>Card</option>
              <option>Insurance</option>
            </Select>
            <Select label="Payment Status" required value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option>Pending</option>
              <option>Paid</option>
              <option>Partial</option>
            </Select>
          </div>

          <p className="text-sm font-medium text-slate-700 mb-2">Bill Items</p>
          {errors.items && (
            <p className="text-xs text-red-600 mb-2" role="alert">
              {errors.items}
            </p>
          )}
          <div className="space-y-2 mb-3">
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  className="input-field flex-1 min-w-[160px]"
                  placeholder="Description (e.g. Consultation fee)"
                  value={it.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                  aria-label={`Item ${i + 1} description`}
                />
                <input
                  className="input-field w-20"
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  aria-label={`Item ${i + 1} quantity`}
                />
                <input
                  className="input-field w-28"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit price"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                  aria-label={`Item ${i + 1} unit price`}
                />
                <span className="w-24 text-sm font-medium text-slate-700 text-right whitespace-nowrap">
                  {formatCurrency((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  aria-label={`Remove item ${i + 1}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Item
          </button>

          <div className="mt-5 border-t border-slate-200 pt-4 flex flex-col items-end gap-2">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900 w-28 text-right">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="tax" className="text-slate-500">
                Tax %
              </label>
              <input
                id="tax"
                className="input-field w-20"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
              />
              <span className="font-medium text-slate-900 w-28 text-right">{formatCurrency(tax)}</span>
            </div>
            <div className="flex items-center gap-6 text-base border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-blue-600 w-28 text-right">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Generating...' : 'Generate Bill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Invoice" subtitle={viewing?.billId} size="lg">
        {viewing && (
          <div>
            <div className="print-area border border-slate-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                    <HeartPulse className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">HMS</p>
                    <p className="text-xs text-slate-500">123 Health Avenue, Medical District</p>
                    <p className="text-xs text-slate-500">contact@medicarehms.com · +1 555 0100</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">INVOICE</p>
                  <p className="text-sm text-slate-500">{viewing.billId}</p>
                  <p className="text-xs text-slate-500">{formatDate(viewing.date)}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Billed To</p>
                <p className="text-sm font-semibold text-slate-900">{viewing.patientName}</p>
                <p className="text-xs text-slate-500">Patient ID: {viewing.patientId}</p>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="table-head pl-0">Description</th>
                      <th className="table-head text-right">Qty</th>
                      <th className="table-head text-right">Unit Price</th>
                      <th className="table-head text-right pr-0">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewing.items || []).map((it, i) => (
                      <tr key={i}>
                        <td className="table-cell pl-0">{it.description}</td>
                        <td className="table-cell text-right">{it.quantity}</td>
                        <td className="table-cell text-right">{formatCurrency(it.unitPrice)}</td>
                        <td className="table-cell text-right pr-0">{formatCurrency(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="flex gap-8">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-900 w-28 text-right">{formatCurrency(viewing.subtotal)}</span>
                </div>
                <div className="flex gap-8">
                  <span className="text-slate-500">Tax ({viewing.taxPercent || 0}%)</span>
                  <span className="font-medium text-slate-900 w-28 text-right">{formatCurrency(viewing.tax)}</span>
                </div>
                <div className="flex gap-8 border-t border-slate-300 pt-2 mt-1">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-bold text-slate-900 w-28 text-right">{formatCurrency(viewing.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Payment Status:</span>
                  <StatusBadge status={viewing.paymentStatus} />
                </div>
                <p className="text-xs text-slate-500">Method: {viewing.paymentMethod}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              {viewing.paymentStatus !== 'Paid' && (
                <button type="button" className="btn-secondary" onClick={() => markPaid(viewing)}>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Mark as Paid
                </button>
              )}
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                <Printer className="w-4 h-4" aria-hidden="true" /> Print Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete bill?"
        message={`This will permanently remove bill ${deleting?.billId} for ${deleting?.patientName}. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default Billing;
