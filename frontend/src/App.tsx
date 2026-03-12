import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Processes from './pages/Processes';
import Alerts from './pages/Alerts';
import Monitors from './pages/Monitors';
import Statistics from './pages/Statistics';
import Users from './pages/Users';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="processes" element={<Processes />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="monitors" element={<Monitors />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
