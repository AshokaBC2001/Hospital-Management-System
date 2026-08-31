import React from 'react';

// Central color map for every status used across the system.
const STATUS_STYLES = {
  // General
  Active: 'bg-green-50 text-green-700 border-green-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  // Appointments
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Confirmed: 'bg-green-50 text-green-700 border-green-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
  // Laboratory
  Requested: 'bg-amber-50 text-amber-700 border-amber-200',
  'Sample Collected': 'bg-purple-50 text-purple-700 border-purple-200',
  Processing: 'bg-blue-50 text-blue-700 border-blue-200',
  // Pharmacy
  'In Stock': 'bg-green-50 text-green-700 border-green-200',
  'Low Stock': 'bg-amber-50 text-amber-700 border-amber-200',
  'Out of Stock': 'bg-red-50 text-red-700 border-red-200',
  // Billing
  Paid: 'bg-green-50 text-green-700 border-green-200',
  Partial: 'bg-blue-50 text-blue-700 border-blue-200',
  // Doctors
  Available: 'bg-green-50 text-green-700 border-green-200',
  Unavailable: 'bg-red-50 text-red-700 border-red-200',
  // Attendance
  Present: 'bg-green-50 text-green-700 border-green-200',
  Absent: 'bg-red-50 text-red-700 border-red-200',
  Leave: 'bg-amber-50 text-amber-700 border-amber-200',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${style}`}
    >
      {status}
    </span>
  );
}

export default StatusBadge;
