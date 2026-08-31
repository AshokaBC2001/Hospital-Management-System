import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../utils/permissions';

// Maps a pathname to its module key for role-based access control.
function moduleKeyForPath(pathname) {
  if (pathname === '/') return 'dashboard';
  return pathname.replace(/^\//, '').split('/')[0];
}

function Layout({ children }) {
  const { userRole } = useAuth();
  const location = useLocation();
  const moduleKey = moduleKeyForPath(location.pathname);

  // Redirect unauthorized module access back to the dashboard.
  if (!canAccess(userRole, moduleKey)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <TopBar />
      <main className="ml-[220px] pt-[52px] min-h-screen">
        <div className="px-6 py-5">{children}</div>
      </main>
    </div>
  );
}

export default Layout;
