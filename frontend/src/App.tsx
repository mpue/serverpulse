import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { fetchSetupStatus } from './api/endpoints';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Processes from './pages/Processes';
import Alerts from './pages/Alerts';
import Monitors from './pages/Monitors';
import Statistics from './pages/Statistics';
import Users from './pages/Users';
import Servers from './pages/Servers';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import Webhooks from './pages/Webhooks';
import Settings from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function OperatorRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'viewer') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SetupRedirect({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    fetchSetupStatus()
      .then(({ data }) => setNeedsSetup(data.setupRequired))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<SetupRedirect><Login /></SetupRedirect>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="processes" element={<Processes />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="monitors" element={<Monitors />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="servers" element={<AdminRoute><Servers /></AdminRoute>} />
          <Route path="maintenance" element={<OperatorRoute><Maintenance /></OperatorRoute>} />
          <Route path="reports" element={<Reports />} />
          <Route path="webhooks" element={<AdminRoute><Webhooks /></AdminRoute>} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
