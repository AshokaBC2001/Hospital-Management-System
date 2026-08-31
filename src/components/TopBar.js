import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Settings } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/helpers';
import Modal from './ui/Modal';
import { Input } from './ui/FormField';

const PAGE_META = {
  '/': { title: 'Dashboard', subtitle: 'Overview of hospital operations' },
  '/patients': { title: 'Patients', subtitle: 'Manage patient records' },
  '/doctors': { title: 'Doctors', subtitle: 'Manage doctors and specializations' },
  '/appointments': { title: 'Appointments', subtitle: 'Schedule and track appointments' },
  '/medical-records': { title: 'Medical Records', subtitle: 'Electronic medical records' },
  '/laboratory': { title: 'Laboratory', subtitle: 'Test requests and results' },
  '/pharmacy': { title: 'Pharmacy', subtitle: 'Medicine inventory and stock' },
  '/billing': { title: 'Billing', subtitle: 'Invoices and payments' },
  '/staff': { title: 'Staff', subtitle: 'Employee management' },
  '/reports': { title: 'Reports', subtitle: 'Analytics and insights' },
};

function TopBar() {
  const location = useLocation();
  const { userData, changePassword } = useAuth();
  const meta = PAGE_META[location.pathname] || { title: 'HMS', subtitle: '' };
  const today = format(new Date(), 'EEEE, dd MMMM yyyy');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.current) errs.current = 'Current password is required.';
    if (!pwForm.next || pwForm.next.length < 6) errs.next = 'New password must be at least 6 characters.';
    if (pwForm.next !== pwForm.confirm) errs.confirm = 'Passwords do not match.';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      toast.success('Password updated successfully');
      setSettingsOpen(false);
      setPwForm({ current: '', next: '', confirm: '' });
      setErrors({});
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setErrors({ current: 'Current password is incorrect.' });
      } else {
        toast.error('Failed to update password. Try signing in again first.');
      }
    } finally {
      setSaving(false);
    }
  };

  const iconBtn =
    'p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer';

  return (
    <header className="fixed top-0 left-[220px] right-0 h-[52px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30">
      <div className="flex items-baseline gap-3 min-w-0">
        <h1 className="text-[15px] font-semibold text-slate-900 whitespace-nowrap">{meta.title}</h1>
        <p className="text-xs text-slate-400 truncate hidden sm:block">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-1">
        <p className="text-xs text-slate-500 mr-3 hidden md:block whitespace-nowrap">{today}</p>
        <button type="button" className={iconBtn} aria-label="Search">
          <Search className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
        <button type="button" className={iconBtn} aria-label="Notifications">
          <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={iconBtn}
          aria-label="Settings — change password"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
        <div
          className="ml-2 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold"
          title={userData?.name}
        >
          {getInitials(userData?.name)}
        </div>
      </div>

      {/* Change password modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Change Password"
        subtitle="Update your account password"
        size="sm"
      >
        <form onSubmit={handlePasswordChange} noValidate>
          <Input
            label="Current Password"
            required
            type="password"
            autoComplete="current-password"
            value={pwForm.current}
            onChange={(e) => {
              setPwForm((f) => ({ ...f, current: e.target.value }));
              setErrors((prev) => ({ ...prev, current: undefined }));
            }}
            error={errors.current}
          />
          <Input
            label="New Password"
            required
            type="password"
            autoComplete="new-password"
            className="mt-4"
            value={pwForm.next}
            onChange={(e) => {
              setPwForm((f) => ({ ...f, next: e.target.value }));
              setErrors((prev) => ({ ...prev, next: undefined }));
            }}
            error={errors.next}
          />
          <Input
            label="Confirm New Password"
            required
            type="password"
            autoComplete="new-password"
            className="mt-4"
            value={pwForm.confirm}
            onChange={(e) => {
              setPwForm((f) => ({ ...f, confirm: e.target.value }));
              setErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            error={errors.confirm}
          />
          <p className="mt-3 text-xs text-slate-500">
            Note: password change applies to email/password accounts. Google sign-in accounts manage their
            password with Google.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </header>
  );
}

export default TopBar;
