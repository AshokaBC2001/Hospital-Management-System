import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  CalendarDays,
  FlaskConical,
  DollarSign,
  UserPlus,
  CalendarPlus,
  ReceiptText,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/ui/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import useCollection from '../../hooks/useCollection';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/permissions';
import { formatCurrency, todayISO, medicineStatus, isExpiringSoon, formatDate } from '../../utils/helpers';

function StatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { documents: patients, loading: loadingPatients } = useCollection('patients');
  const { documents: appointments, loading: loadingAppointments } = useCollection('appointments');
  const { documents: labTests, loading: loadingLabs } = useCollection('lab_tests');
  const { documents: bills, loading: loadingBills } = useCollection('billing');
  const { documents: medicines, loading: loadingMeds } = useCollection('medicines');

  const loading = loadingPatients || loadingAppointments || loadingLabs || loadingBills || loadingMeds;
  const today = todayISO();

  const todaysAppointments = appointments.filter((a) => a.date === today);
  const pendingLabs = labTests.filter((t) => t.status !== 'Completed');
  const revenueToday = bills
    .filter((b) => b.date === today && b.paymentStatus === 'Paid')
    .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

  const recentAppointments = [...appointments]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''))
    .slice(0, 6);

  const pharmacyAlerts = medicines
    .map((m) => {
      const status = medicineStatus(m.stock, m.reorderLevel);
      const expiring = isExpiringSoon(m.expiryDate);
      return { ...m, derivedStatus: status, expiring };
    })
    .filter((m) => m.derivedStatus !== 'In Stock' || m.expiring)
    .slice(0, 6);

  const quickActions = [
    { label: 'New Patient', icon: UserPlus, to: '/patients', key: 'patients' },
    { label: 'New Appointment', icon: CalendarPlus, to: '/appointments', key: 'appointments' },
    { label: 'New Bill', icon: ReceiptText, to: '/billing', key: 'billing' },
  ].filter((a) => canAccess(userRole, a.key));

  if (loading) {
    return (
      <Layout>
        <Spinner label="Loading dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={patients.length}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={CalendarDays}
          label="Today's Appointments"
          value={todaysAppointments.length}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          icon={FlaskConical}
          label="Pending Lab Requests"
          value={pendingLabs.length}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue Today"
          value={formatCurrency(revenueToday)}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent appointments */}
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Recent Appointments</h2>
            {canAccess(userRole, 'appointments') && (
              <Link
                to="/appointments"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                View All <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
          {recentAppointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No appointments yet"
              message="Book your first appointment to see it here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-head">Patient</th>
                    <th className="table-head">Doctor</th>
                    <th className="table-head">Date</th>
                    <th className="table-head">Time</th>
                    <th className="table-head">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAppointments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-medium text-slate-900">{a.patientName}</td>
                      <td className="table-cell">{a.doctorName}</td>
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

        <div className="flex flex-col gap-5">
          {/* Quick actions */}
          {quickActions.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => navigate(action.to, { state: { openNew: true } })}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <action.icon className="w-4 h-4" aria-hidden="true" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pharmacy alerts */}
          <div className="card flex-1">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Pharmacy Alerts</h2>
            </div>
            {pharmacyAlerts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-slate-500">No stock or expiry alerts.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pharmacyAlerts.map((m) => (
                  <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <AlertTriangle
                      className={`w-4 h-4 flex-shrink-0 ${
                        m.derivedStatus === 'Out of Stock' ? 'text-red-500' : 'text-amber-500'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        {m.derivedStatus !== 'In Stock' ? m.derivedStatus : ''}
                        {m.derivedStatus !== 'In Stock' && m.expiring ? ' · ' : ''}
                        {m.expiring ? `Expires ${formatDate(m.expiryDate)}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={m.derivedStatus} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
