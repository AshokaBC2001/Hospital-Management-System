import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  FileHeart,
  FlaskConical,
  Pill,
  Receipt,
  UserCog,
  BarChart3,
  LogOut,
  HeartPulse,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { canAccess, getRoleLabel } from '../utils/permissions';
import { getInitials } from '../utils/helpers';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { key: 'dashboard', to: '/', name: 'Dashboard', icon: LayoutDashboard },
      { key: 'patients', to: '/patients', name: 'Patients', icon: Users },
      { key: 'doctors', to: '/doctors', name: 'Doctors', icon: Stethoscope },
      { key: 'appointments', to: '/appointments', name: 'Appointments', icon: CalendarDays },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { key: 'medical-records', to: '/medical-records', name: 'Medical Records', icon: FileHeart },
      { key: 'laboratory', to: '/laboratory', name: 'Laboratory', icon: FlaskConical },
      { key: 'pharmacy', to: '/pharmacy', name: 'Pharmacy', icon: Pill },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'billing', to: '/billing', name: 'Billing', icon: Receipt },
      { key: 'staff', to: '/staff', name: 'Staff', icon: UserCog },
      { key: 'reports', to: '/reports', name: 'Reports', icon: BarChart3 },
    ],
  },
];

function Sidebar() {
  const { userData, userRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] bg-sidebar flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <HeartPulse className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">HMS</p>
          <p className="text-[10px] text-white/50 leading-tight truncate">Hospital Management System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter((item) => canAccess(userRole, item.key));
          if (visible.length === 0) return null;
          return (
            <div key={section.label} className="mb-2">
              <p className="px-4 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {section.label}
              </p>
              {visible.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-r-2 ${
                      isActive
                        ? 'bg-blue-600 text-white border-white'
                        : 'text-white/70 border-transparent hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
          {getInitials(userData?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{userData?.name || 'User'}</p>
          <p className="text-[10px] text-white/50 truncate">{getRoleLabel(userRole)}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
