import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiBox, FiMail, FiArrowLeft, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import loginBg from '../assets/login background.mp4';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [devNote, setDevNote] = useState('');
  const videoRef = useRef(null);

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
      const res = await api.post('/auth/forgot-password', { email: trimmedEmail });
      setEmail(trimmedEmail);
      setResetUrl(res.data?.resetUrl || '');
      setDevNote(res.data?.devNote || '');
      setSent(true);
      toast.success(res.data.message || 'If an account exists for this email, a password reset link has been generated.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send reset email';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPath = resetUrl.includes('/reset-password/')
    ? `/reset-password/${resetUrl.split('/reset-password/')[1]}`
    : resetUrl;

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
            Enter your registered email and we will send you a password reset link.
          </div>
          <div className="auth-branding-features">
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Reset link valid for 15 minutes
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Check your spam folder if not received
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Contact admin if you need assistance
            </div>
          </div>
        </div>

        {/* Glass card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <FiMail size={22} />
            </div>
            <h1 className="auth-card-title">Forgot password?</h1>
            <p className="auth-card-subtitle">
              {sent
                ? 'Check your email for the reset link'
                : "No worries — we'll send you a reset link"}
            </p>
          </div>

          {sent ? (
            <div className="auth-success" role="status" aria-live="polite" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="auth-success-icon">
                  <FiCheckCircle size={16} />
                </span>
                <span>
                  If an account exists for <strong>{email}</strong>, a reset link has been sent.
                </span>
              </div>
              {resetUrl && (
                <div style={{ width: '100%', paddingTop: 8, borderTop: '1px solid rgba(34, 197, 94, 0.25)', fontSize: 12.5 }}>
                  {devNote && <p style={{ marginBottom: 6, opacity: 0.9 }}>{devNote}</p>}
                  {resetPath.startsWith('/') ? (
                    <Link
                      to={resetPath}
                      style={{ color: '#bbf7d0', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                      Click here to reset your password ({resetUrl})
                    </Link>
                  ) : (
                    <a
                      href={resetUrl}
                      style={{ color: '#bbf7d0', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                      Click here to reset your password ({resetUrl})
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
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
                <label className="auth-input-label" htmlFor="forgot-email">Email address</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <FiMail size={16} />
                  </span>
                  <input
                    id="forgot-email"
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

              <button
                className="auth-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="auth-btn-loading">
                    <span className="auth-spinner" />
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}

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
