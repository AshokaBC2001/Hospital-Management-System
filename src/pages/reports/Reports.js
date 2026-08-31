import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Printer, Users, CalendarDays, DollarSign, Pill, FlaskConical, UserCog } from 'lucide-react';
import { format, subDays, startOfMonth, startOfWeek } from 'date-fns';
import Layout from '../../components/Layout';
import Spinner from '../../components/ui/Spinner';
import useCollection from '../../hooks/useCollection';
import { formatCurrency, medicineStatus, isExpiringSoon, formatDate, BLOOD_GROUPS } from '../../utils/helpers';

// Categorical palette validated for CVD separation and contrast (fixed order, never cycled).
const CAT = ['#2563eb', '#d97706', '#0d9488', '#7c3aed', '#db2777'];
// Reserved status colors (always paired with labels).
const STATUS = { good: '#16a34a', warn: '#d97706', bad: '#dc2626', neutral: '#64748b', info: '#2563eb' };

const TABS = [
  { key: 'patient', label: 'Patient', icon: Users },
  { key: 'appointment', label: 'Appointment', icon: CalendarDays },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
  { key: 'pharmacy', label: 'Pharmacy', icon: Pill },
  { key: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { key: 'staff', label: 'Staff', icon: UserCog },
];

const GRID = { stroke: '#e2e8f0', strokeDasharray: '3 3', vertical: false };
const AXIS = { stroke: '#94a3b8', fontSize: 12, tickLine: false, axisLine: { stroke: '#e2e8f0' } };

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`table-head ${i > 0 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="table-cell text-center text-slate-400 py-6">
                No data available
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={`table-cell ${j > 0 ? 'text-right' : 'font-medium text-slate-900'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function countBy(list, keyFn) {
  const map = {};
  list.forEach((item) => {
    const key = keyFn(item) || 'Unknown';
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function Reports() {
  const [tab, setTab] = useState('patient');
  const { documents: patients, loading: l1 } = useCollection('patients');
  const { documents: appointments, loading: l2 } = useCollection('appointments');
  const { documents: bills, loading: l3 } = useCollection('billing');
  const { documents: medicines, loading: l4 } = useCollection('medicines');
  const { documents: labTests, loading: l5 } = useCollection('lab_tests');
  const { documents: employees, loading: l6 } = useCollection('employees');

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // ---- Revenue: daily for last 30 days ----
  const dailyRevenue = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      const total = bills
        .filter((b) => b.date === key && b.paymentStatus !== 'Pending')
        .reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
      days.push({ day: format(d, 'dd MMM'), revenue: Math.round(total * 100) / 100 });
    }
    return days;
  }, [bills]);

  const paidBills = bills.filter((b) => b.paymentStatus !== 'Pending');
  const totalRevenue = paidBills.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const monthRevenue = paidBills.filter((b) => b.date >= monthStart).reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const weekRevenue = paidBills.filter((b) => b.date >= weekStart).reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);

  const handleExport = () => window.print();

  if (loading) {
    return (
      <Layout>
        <Spinner label="Aggregating reports..." />
      </Layout>
    );
  }

  const genderData = Object.entries(countBy(patients, (p) => p.gender)).map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(countBy(patients, (p) => p.status)).map(([name, value]) => ({ name, value }));
  const apptStatusData = Object.entries(countBy(appointments, (a) => a.status)).map(([name, value]) => ({ name, value }));
  const apptByDoctor = Object.entries(countBy(appointments, (a) => a.doctorName)).sort((a, b) => b[1] - a[1]);
  const payMethodData = Object.entries(countBy(paidBills, (b) => b.paymentMethod)).map(([name, value]) => ({ name, value }));
  const medsByCategory = Object.entries(countBy(medicines, (m) => m.category)).sort((a, b) => b[1] - a[1]);
  const expiringMeds = medicines.filter((m) => isExpiringSoon(m.expiryDate));
  const lowStock = medicines.filter((m) => medicineStatus(m.stock, m.reorderLevel) === 'Low Stock');
  const outOfStock = medicines.filter((m) => medicineStatus(m.stock, m.reorderLevel) === 'Out of Stock');
  const testsByStatus = Object.entries(countBy(labTests, (t) => t.status)).map(([name, value]) => ({ name, value }));
  const testsByType = Object.entries(countBy(labTests, (t) => t.testType)).sort((a, b) => b[1] - a[1]);
  const staffByDept = Object.entries(countBy(employees, (e) => e.department)).sort((a, b) => b[1] - a[1]);
  const staffByRole = Object.entries(countBy(employees, (e) => e.role)).sort((a, b) => b[1] - a[1]);

  const attendanceThisMonth = employees.reduce(
    (acc, emp) => {
      (emp.attendance || []).forEach((a) => {
        if (a.date >= monthStart) {
          if (a.status === 'Present') acc.present += 1;
          else if (a.status === 'Absent') acc.absent += 1;
          else if (a.status === 'Leave') acc.leave += 1;
        }
      });
      return acc;
    },
    { present: 0, absent: 0, leave: 0 }
  );

  const apptStatusColor = (name) =>
    name === 'Completed' || name === 'Confirmed'
      ? STATUS.good
      : name === 'Cancelled'
      ? STATUS.bad
      : name === 'Pending'
      ? STATUS.warn
      : STATUS.info;

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">Analytics aggregated in real time from live data</p>
        </div>
        <button type="button" className="btn-secondary" onClick={handleExport}>
          <Printer className="w-4 h-4" aria-hidden="true" /> Export / Print
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-1.5 mb-5 flex flex-wrap gap-1" role="tablist" aria-label="Report categories">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="w-4 h-4" aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <div className="print-area">
        {/* ---- PATIENT ---- */}
        {tab === 'patient' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Patients" value={patients.length} />
              <StatCard
                label="New This Month"
                value={
                  patients.filter((p) => {
                    const created = p.createdAt?.toDate ? format(p.createdAt.toDate(), 'yyyy-MM-dd') : null;
                    return created && created >= monthStart;
                  }).length
                }
              />
              <StatCard
                label="Active Patients"
                value={patients.filter((p) => p.status === 'Active').length}
                sub={`${patients.filter((p) => p.status === 'Inactive').length} inactive`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Patients by Gender">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                      {genderData.map((entry, i) => (
                        <Cell key={entry.name} fill={CAT[i % CAT.length]} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Active vs Inactive">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={statusData} barSize={48}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" name="Patients" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.name === 'Active' ? STATUS.good : STATUS.neutral} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <ChartCard title="Patients by Blood Group">
              <SimpleTable
                headers={['Blood Group', 'Patients']}
                rows={BLOOD_GROUPS.map((bg) => [bg, patients.filter((p) => p.bloodGroup === bg).length])}
              />
            </ChartCard>
          </div>
        )}

        {/* ---- APPOINTMENT ---- */}
        {tab === 'appointment' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Appointments" value={appointments.length} />
              <StatCard label="Completed" value={appointments.filter((a) => a.status === 'Completed').length} />
              <StatCard label="Cancelled" value={appointments.filter((a) => a.status === 'Cancelled').length} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Appointments by Status">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={apptStatusData} barSize={40}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} interval={0} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" name="Appointments" radius={[4, 4, 0, 0]}>
                      {apptStatusData.map((entry) => (
                        <Cell key={entry.name} fill={apptStatusColor(entry.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Appointments by Doctor">
                <SimpleTable headers={['Doctor', 'Appointments']} rows={apptByDoctor} />
              </ChartCard>
            </div>
          </div>
        )}

        {/* ---- REVENUE ---- */}
        {tab === 'revenue' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} sub="All paid & partial bills" />
              <StatCard label="Revenue This Month" value={formatCurrency(monthRevenue)} />
              <StatCard label="Revenue This Week" value={formatCurrency(weekRevenue)} />
            </div>
            <ChartCard title="Daily Revenue — Last 30 Days">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyRevenue}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="day" {...AXIS} interval={4} />
                  <YAxis {...AXIS} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={CAT[0]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Revenue by Payment Method">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={payMethodData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {payMethodData.map((entry, i) => (
                        <Cell key={entry.name} fill={CAT[i % CAT.length]} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <SimpleTable
                  headers={['Method', 'Bills', 'Amount']}
                  rows={['Cash', 'Card', 'Insurance'].map((m) => {
                    const list = paidBills.filter((b) => b.paymentMethod === m);
                    return [m, list.length, formatCurrency(list.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0))];
                  })}
                />
              </div>
            </ChartCard>
          </div>
        )}

        {/* ---- PHARMACY ---- */}
        {tab === 'pharmacy' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Medicines" value={medicines.length} />
              <StatCard label="Low Stock" value={lowStock.length} />
              <StatCard label="Out of Stock" value={outOfStock.length} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Medicines by Category">
                <SimpleTable headers={['Category', 'Medicines']} rows={medsByCategory} />
              </ChartCard>
              <ChartCard title="Expiring Within 30 Days">
                <SimpleTable
                  headers={['Medicine', 'Stock', 'Expiry Date']}
                  rows={expiringMeds.map((m) => [m.name, `${m.stock} ${m.unit || ''}`, formatDate(m.expiryDate)])}
                />
              </ChartCard>
            </div>
          </div>
        )}

        {/* ---- LABORATORY ---- */}
        {tab === 'laboratory' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Tests" value={labTests.length} />
              <StatCard label="Completed" value={labTests.filter((t) => t.status === 'Completed').length} />
              <StatCard label="Pending" value={labTests.filter((t) => t.status !== 'Completed').length} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Tests by Status">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={testsByStatus} barSize={40}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} interval={0} fontSize={11} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" name="Tests" radius={[4, 4, 0, 0]}>
                      {testsByStatus.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === 'Completed' ? STATUS.good : entry.name === 'Requested' ? STATUS.warn : STATUS.info}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Tests by Type">
                <SimpleTable headers={['Test Type', 'Tests']} rows={testsByType} />
              </ChartCard>
            </div>
          </div>
        )}

        {/* ---- STAFF ---- */}
        {tab === 'staff' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Staff" value={employees.length} />
              <StatCard label="Active" value={employees.filter((e) => e.status === 'Active').length} />
              <StatCard
                label="Attendance This Month"
                value={attendanceThisMonth.present}
                sub={`${attendanceThisMonth.absent} absent · ${attendanceThisMonth.leave} on leave`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Staff by Department">
                <SimpleTable headers={['Department', 'Staff']} rows={staffByDept} />
              </ChartCard>
              <ChartCard title="Staff by Role">
                <SimpleTable headers={['Role', 'Staff']} rows={staffByRole} />
              </ChartCard>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Reports;
