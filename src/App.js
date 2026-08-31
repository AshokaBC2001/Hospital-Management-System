import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Patients from './pages/patients/Patients';
import Doctors from './pages/doctors/Doctors';
import Appointments from './pages/appointments/Appointments';
import MedicalRecords from './pages/medical-records/MedicalRecords';
import Laboratory from './pages/laboratory/Laboratory';
import Pharmacy from './pages/pharmacy/Pharmacy';
import Billing from './pages/billing/Billing';
import Staff from './pages/staff/Staff';
import Reports from './pages/reports/Reports';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: '14px', borderRadius: '10px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/patients" element={<PrivateRoute><Patients /></PrivateRoute>} />
          <Route path="/doctors" element={<PrivateRoute><Doctors /></PrivateRoute>} />
          <Route path="/appointments" element={<PrivateRoute><Appointments /></PrivateRoute>} />
          <Route path="/medical-records" element={<PrivateRoute><MedicalRecords /></PrivateRoute>} />
          <Route path="/laboratory" element={<PrivateRoute><Laboratory /></PrivateRoute>} />
          <Route path="/pharmacy" element={<PrivateRoute><Pharmacy /></PrivateRoute>} />
          <Route path="/billing" element={<PrivateRoute><Billing /></PrivateRoute>} />
          <Route path="/staff" element={<PrivateRoute><Staff /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;