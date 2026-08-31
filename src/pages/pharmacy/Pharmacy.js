import React, { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Pencil, Trash2, Pill, PackagePlus, AlertTriangle } from 'lucide-react';
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
import { medicineStatus, isExpiringSoon, isExpired, formatCurrency, formatDate } from '../../utils/helpers';

const CATEGORIES = [
  'Antibiotic',
  'Analgesic',
  'Antipyretic',
  'Antihistamine',
  'Antacid',
  'Antiseptic',
  'Cardiovascular',
  'Diabetes',
  'Respiratory',
  'Vitamin & Supplement',
  'Other',
];
const UNITS = ['Tablets', 'Capsules', 'Syrup', 'Injection', 'Drops', 'Cream', 'Inhaler', 'Sachets'];

const EMPTY_FORM = {
  name: '',
  genericName: '',
  category: CATEGORIES[0],
  manufacturer: '',
  stock: '',
  unit: UNITS[0],
  price: '',
  expiryDate: '',
  reorderLevel: '',
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Medicine name is required.';
  if (!form.genericName.trim()) errors.genericName = 'Generic name is required.';
  if (!form.manufacturer.trim()) errors.manufacturer = 'Manufacturer is required.';
  if (form.stock === '' || Number(form.stock) < 0) errors.stock = 'Enter a valid stock quantity.';
  if (form.price === '' || Number(form.price) < 0) errors.price = 'Enter a valid price.';
  if (!form.expiryDate) errors.expiryDate = 'Expiry date is required.';
  if (form.reorderLevel === '' || Number(form.reorderLevel) < 0) errors.reorderLevel = 'Enter a reorder level.';
  return errors;
}

function Pharmacy() {
  const { documents: medicines, loading } = useCollection('medicines');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockFor, setStockFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stockForm, setStockForm] = useState({ type: 'add', quantity: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const enriched = useMemo(
    () =>
      medicines.map((m) => ({
        ...m,
        derivedStatus: medicineStatus(m.stock, m.reorderLevel),
        expiring: isExpiringSoon(m.expiryDate),
        expired: isExpired(m.expiryDate),
      })),
    [medicines]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enriched.filter((m) => {
      if (statusFilter !== 'All' && m.derivedStatus !== statusFilter) return false;
      if (
        term &&
        !m.name?.toLowerCase().includes(term) &&
        !m.category?.toLowerCase().includes(term) &&
        !m.genericName?.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [enriched, search, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name || '',
      genericName: m.genericName || '',
      category: m.category || CATEGORIES[0],
      manufacturer: m.manufacturer || '',
      stock: m.stock ?? '',
      unit: m.unit || UNITS[0],
      price: m.price ?? '',
      expiryDate: m.expiryDate || '',
      reorderLevel: m.reorderLevel ?? '',
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
      const stock = Number(form.stock);
      const reorderLevel = Number(form.reorderLevel);
      const data = {
        name: form.name.trim(),
        genericName: form.genericName.trim(),
        category: form.category,
        manufacturer: form.manufacturer.trim(),
        stock,
        unit: form.unit,
        price: Number(form.price),
        expiryDate: form.expiryDate,
        reorderLevel,
        status: medicineStatus(stock, reorderLevel),
      };
      if (editing) {
        await updateDoc(doc(db, 'medicines', editing.id), data);
        toast.success('Medicine updated');
      } else {
        await addDoc(collection(db, 'medicines'), { ...data, createdAt: serverTimestamp() });
        toast.success('Medicine added to inventory');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(editing ? 'Failed to update medicine' : 'Failed to add medicine');
    } finally {
      setSaving(false);
    }
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(stockForm.quantity);
    if (!qty || qty <= 0) {
      setErrors({ quantity: 'Enter a quantity greater than zero.' });
      return;
    }
    const current = Number(stockFor.stock) || 0;
    const newStock = stockForm.type === 'add' ? current + qty : current - qty;
    if (newStock < 0) {
      setErrors({ quantity: `Cannot reduce below zero (current stock: ${current}).` });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'medicines', stockFor.id), {
        stock: newStock,
        status: medicineStatus(newStock, stockFor.reorderLevel),
        lastStockUpdate: {
          type: stockForm.type,
          quantity: qty,
          reason: stockForm.reason.trim(),
          at: new Date().toISOString(),
        },
      });
      toast.success(`Stock ${stockForm.type === 'add' ? 'increased' : 'reduced'} to ${newStock}`);
      setStockFor(null);
      setErrors({});
    } catch (err) {
      console.error(err);
      toast.error('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'medicines', deleting.id));
      toast.success('Medicine removed');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete medicine');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pharmacy</h2>
          <p className="text-sm text-slate-500">{medicines.length} medicines in inventory</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Medicine
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Search by name, generic name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search medicines"
          />
        </div>
        <select
          className="input-field w-auto cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by stock status"
        >
          <option value="All">All Statuses</option>
          <option>In Stock</option>
          <option>Low Stock</option>
          <option>Out of Stock</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner label="Loading inventory..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No medicines found"
            message="Add medicines to the inventory or adjust your filters."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Add Medicine
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-head">Name</th>
                  <th className="table-head">Category</th>
                  <th className="table-head">Generic Name</th>
                  <th className="table-head">Stock</th>
                  <th className="table-head">Unit</th>
                  <th className="table-head">Price</th>
                  <th className="table-head">Expiry Date</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      m.derivedStatus === 'Out of Stock'
                        ? 'bg-red-50/50 hover:bg-red-50'
                        : m.expiring || m.expired
                        ? 'bg-amber-50/50 hover:bg-amber-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="table-cell font-medium text-slate-900">{m.name}</td>
                    <td className="table-cell">{m.category}</td>
                    <td className="table-cell">{m.genericName}</td>
                    <td className="table-cell font-medium">{m.stock}</td>
                    <td className="table-cell">{m.unit}</td>
                    <td className="table-cell">{formatCurrency(m.price)}</td>
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        {formatDate(m.expiryDate)}
                        {(m.expiring || m.expired) && (
                          <AlertTriangle
                            className={`w-3.5 h-3.5 ${m.expired ? 'text-red-500' : 'text-amber-500'}`}
                            aria-label={m.expired ? 'Expired' : 'Expiring within 30 days'}
                          />
                        )}
                      </span>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={m.derivedStatus} />
                    </td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStockFor(m);
                            setStockForm({ type: 'add', quantity: '', reason: '' });
                            setErrors({});
                          }}
                          aria-label={`Update stock for ${m.name}`}
                          title="Update stock"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors cursor-pointer"
                        >
                          <PackagePlus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          aria-label={`Edit ${m.name}`}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(m)}
                          aria-label={`Delete ${m.name}`}
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
        title={editing ? 'Edit Medicine' : 'Add Medicine'}
        subtitle="Inventory details for this medicine"
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Medicine Name" required name="name" value={form.name} onChange={handleChange} error={errors.name} placeholder="e.g. Amoxil 500mg" />
            <Input label="Generic Name" required name="genericName" value={form.genericName} onChange={handleChange} error={errors.genericName} placeholder="e.g. Amoxicillin" />
            <Select label="Category" required name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Input label="Manufacturer" required name="manufacturer" value={form.manufacturer} onChange={handleChange} error={errors.manufacturer} placeholder="e.g. Pfizer" />
            <Input label="Stock Quantity" required name="stock" type="number" min="0" value={form.stock} onChange={handleChange} error={errors.stock} placeholder="e.g. 250" />
            <Select label="Unit" required name="unit" value={form.unit} onChange={handleChange}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
            <Input label="Price per Unit" required name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} error={errors.price} placeholder="e.g. 2.50" />
            <Input label="Expiry Date" required name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} error={errors.expiryDate} />
            <Input label="Reorder Level" required name="reorderLevel" type="number" min="0" value={form.reorderLevel} onChange={handleChange} error={errors.reorderLevel} placeholder="Alert when stock falls below" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Medicine' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock update modal */}
      <Modal
        open={!!stockFor}
        onClose={() => setStockFor(null)}
        title="Update Stock"
        subtitle={stockFor ? `${stockFor.name} — current stock: ${stockFor.stock} ${stockFor.unit}` : ''}
        size="sm"
      >
        <form onSubmit={handleStockSubmit} noValidate>
          <Select
            label="Adjustment Type"
            required
            value={stockForm.type}
            onChange={(e) => setStockForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="add">Add stock (restock)</option>
            <option value="reduce">Reduce stock (dispense / damage)</option>
          </Select>
          <Input
            label="Quantity"
            required
            type="number"
            min="1"
            className="mt-4"
            value={stockForm.quantity}
            onChange={(e) => {
              setStockForm((f) => ({ ...f, quantity: e.target.value }));
              setErrors({});
            }}
            error={errors.quantity}
            placeholder="e.g. 50"
          />
          <Textarea
            label="Reason"
            className="mt-4"
            value={stockForm.reason}
            onChange={(e) => setStockForm((f) => ({ ...f, reason: e.target.value }))}
            rows={2}
            placeholder="e.g. Monthly restock, prescription dispensed..."
          />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setStockFor(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Updating...' : 'Update Stock'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete medicine?"
        message={`This will permanently remove ${deleting?.name} from the inventory. This action cannot be undone.`}
      />
    </Layout>
  );
}

export default Pharmacy;
