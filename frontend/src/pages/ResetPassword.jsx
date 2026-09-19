import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiBox, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import loginBg from '../assets/login background.mp4';
import './Auth.css';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.7;
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      toast.success('Password reset successful. You can now log in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <video
        className="auth-bg-video"
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        src={loginBg}
      />
      <div className="auth-bg-overlay" />
      <div className="auth-bg-grid" />

      <div className="auth-layout">
        {/* Left branding — desktop only */}
        <div className="auth-branding">
          <div className="auth-branding-icon">
            <FiBox size={28} />
          </div>
          <div className="auth-branding-title">
            InventoryHub
          </div>
          <div className="auth-branding-sub">
            Create a strong new password for your account to regain access.
          </div>
          <div className="auth-branding-features">
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Minimum 6 characters required
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Use a mix of letters and numbers
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Avoid common passwords
            </div>
          </div>
        </div>

        {/* Glass card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <FiLock size={22} />
            </div>
            <h1 className="auth-card-title">Reset password</h1>
            <p className="auth-card-subtitle">Enter your new password below</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error" key={error}>
                <span className="auth-error-icon">
                  <FiAlertCircle size={16} />
                </span>
                {error}
              </div>
            )}

            <div className="auth-input-group">
              <label className="auth-input-label" htmlFor="reset-password">New Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <FiLock size={16} />
                </span>
                <input
                  id="reset-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-input-label" htmlFor="reset-confirm">Confirm Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <FiLock size={16} />
                </span>
                <input
                  id="reset-confirm"
                  className="auth-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <button
              className="auth-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="auth-btn-loading">
                  <span className="auth-spinner" />
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          <div className="auth-back-link" style={{ marginTop: 20 }}>
            <Link to="/login">
              <FiArrowLeft size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
