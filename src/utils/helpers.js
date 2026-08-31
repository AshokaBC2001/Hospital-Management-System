import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { format, parseISO, isValid } from 'date-fns';

// Generate a sequential display ID like P-001 / B-001 / E-001 by scanning
// the existing values of `field` in `collectionName`.
export async function generateSequentialId(collectionName, field, prefix) {
  const snapshot = await getDocs(collection(db, collectionName));
  let max = 0;
  snapshot.forEach((docSnap) => {
    const value = docSnap.data()[field];
    if (typeof value === 'string' && value.startsWith(`${prefix}-`)) {
      const num = parseInt(value.split('-')[1], 10);
      if (!Number.isNaN(num) && num > max) max = num;
    }
  });
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
}

export function formatDate(value, pattern = 'dd MMM yyyy') {
  if (!value) return '—';
  let date = value;
  if (typeof value === 'string') {
    date = parseISO(value);
  } else if (value.toDate) {
    date = value.toDate();
  }
  if (!isValid(date)) return '—';
  return format(date, pattern);
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

// Medicine status derived from stock vs reorder level
export function medicineStatus(stock, reorderLevel) {
  const s = Number(stock) || 0;
  const r = Number(reorderLevel) || 0;
  if (s <= 0) return 'Out of Stock';
  if (s <= r) return 'Low Stock';
  return 'In Stock';
}

export function isExpiringSoon(expiryDate, days = 30) {
  if (!expiryDate) return false;
  const expiry = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate;
  if (!isValid(expiry)) return false;
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + days);
  return expiry >= now && expiry <= limit;
}

export function isExpired(expiryDate) {
  if (!expiryDate) return false;
  const expiry = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate;
  if (!isValid(expiry)) return false;
  return expiry < new Date();
}

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const DEPARTMENTS = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Gynecology',
  'Dermatology',
  'Radiology',
  'Emergency',
  'Surgery',
  'ENT',
  'Ophthalmology',
];
