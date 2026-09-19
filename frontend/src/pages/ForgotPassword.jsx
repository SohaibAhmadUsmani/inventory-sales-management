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
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.7;
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success(res.data.message || 'If an account exists for this email, a password reset link has been generated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset email');
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
            <div className="auth-success">
              <span className="auth-success-icon">
                <FiCheckCircle size={16} />
              </span>
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
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
