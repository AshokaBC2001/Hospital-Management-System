// Role-based access control map.
// Each role lists the route keys it may access. Admin gets everything.

export const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'lab_staff', label: 'Lab Staff' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'accountant', label: 'Accountant' },
];

const ALL_MODULES = [
  'dashboard',
  'patients',
  'doctors',
  'appointments',
  'medical-records',
  'laboratory',
  'pharmacy',
  'billing',
  'staff',
  'reports',
];

export const ROLE_PERMISSIONS = {
  admin: ALL_MODULES,
  doctor: ['dashboard', 'patients', 'appointments', 'medical-records', 'laboratory'],
  nurse: ['dashboard', 'patients', 'appointments'],
  receptionist: ['dashboard', 'patients', 'appointments', 'billing'],
  lab_staff: ['dashboard', 'laboratory'],
  pharmacist: ['dashboard', 'pharmacy'],
  accountant: ['dashboard', 'billing', 'reports'],
};

export function canAccess(role, moduleKey) {
  const permissions = ROLE_PERMISSIONS[role] || ['dashboard'];
  return permissions.includes(moduleKey);
}

export function getRoleLabel(role) {
  const found = ROLES.find((r) => r.value === role);
  return found ? found.label : 'Staff';
}
