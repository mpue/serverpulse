import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import NotificationCenter from '../NotificationCenter/NotificationCenter';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="ServerPulse" style={{ width: 32, height: 32, marginRight: 8, verticalAlign: 'middle' }} />
          ServerPulse
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/processes" className={({ isActive }) => isActive ? 'active' : ''}>
            Processes
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => isActive ? 'active' : ''}>
            Alerts
          </NavLink>
          <NavLink to="/monitors" className={({ isActive }) => isActive ? 'active' : ''}>
            Monitors
          </NavLink>
          <NavLink to="/statistics" className={({ isActive }) => isActive ? 'active' : ''}>
            Statistics
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/servers" className={({ isActive }) => isActive ? 'active' : ''}>
              Servers
            </NavLink>
          )}
          {user?.role !== 'viewer' && (
            <NavLink to="/maintenance" className={({ isActive }) => isActive ? 'active' : ''}>
              Maintenance
            </NavLink>
          )}
          <NavLink to="/reports" className={({ isActive }) => isActive ? 'active' : ''}>
            Reports
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/webhooks" className={({ isActive }) => isActive ? 'active' : ''}>
              Webhooks
            </NavLink>
          )}
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
            Settings
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
              Users
            </NavLink>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="flex-between">
            <div>
              <div>{user?.username}</div>
              <div style={{ fontSize: '0.75rem' }}>{user?.role}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm mt-16" onClick={handleLogout} style={{ width: '100%' }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
