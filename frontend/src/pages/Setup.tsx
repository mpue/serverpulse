import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSetupStatus, runSetup } from '../api/endpoints';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [appName, setAppName] = useState('ServerPulse');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    fetchSetupStatus()
      .then(({ data }) => {
        if (!data.setupRequired) navigate('/login');
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await runSetup({ username, email, password, appName, timezone });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading && step !== 2) {
    return (
      <div className="login-container">
        <div className="login-card"><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: 480, width: '100%' }}>
        <h1>ServerPulse Setup</h1>
        <p className="subtitle">
          {step === 0 && 'Step 1: Create Admin Account'}
          {step === 1 && 'Step 2: Application Settings'}
          {step === 2 && 'Setup Complete!'}
        </p>

        {error && <div className="error-text">{error}</div>}

        {step === 0 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(1); }}>
            <div className="form-group">
              <label>Username</label>
              <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={4} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password (min 12 chars, uppercase, number, special)</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
              Next →
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Application Name</label>
              <input className="form-input" value={appName} onChange={(e) => setAppName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <input className="form-input" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setStep(0)} style={{ flex: 1 }}>
                ← Back
              </button>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div>
            <p style={{ marginBottom: 16 }}>Your admin account has been created. You can now log in.</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
