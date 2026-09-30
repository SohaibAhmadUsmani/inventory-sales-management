import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiBox, FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import loginBg from '../assets/login background.mp4';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (videoRef.current) {
      if (prefersReducedMotion) {
        videoRef.current.pause();
      } else {
        videoRef.current.playbackRate = 0.7;
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
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
        aria-hidden="true"
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
            Streamline your inventory, sales, and purchasing operations with a unified management platform.
          </div>
          <div className="auth-branding-features">
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Real-time inventory tracking
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Sales analytics and reporting
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Role-based access control
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Supplier and purchase management
            </div>
          </div>
        </div>

        {/* Glass card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <FiBox size={22} />
            </div>
            <h1 className="auth-card-title">Welcome back</h1>
            <p className="auth-card-subtitle">Sign in to your account</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error" key={error} role="alert" aria-live="assertive">
                <span className="auth-error-icon">
                  <FiAlertCircle size={16} />
                </span>
                {error}
              </div>
            )}

            <div className="auth-input-group">
              <label className="auth-input-label" htmlFor="login-email">Email</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <FiMail size={16} />
                </span>
                <input
                  id="login-email"
                  className="auth-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-input-label" htmlFor="login-password">Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <FiLock size={16} />
                </span>
                <input
                  id="login-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
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
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="auth-back-link">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </form>

          <div className="auth-footer">
            <p className="auth-footer-text">
              Admin & Staff Access Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
