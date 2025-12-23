import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LinearProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { theme } from '../../styles/theme';
import CustomInput from '../../components/ui/CustomInput';
import CustomButton from '../../components/ui/CustomButton';
import Logo from '../../components/ui/Logo';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      enqueueSnackbar('Login successful!', { variant: 'success' });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      enqueueSnackbar(err.message || 'Login failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: theme.typography.fontFamily,
        padding: `${theme.spacing['3xl']} ${theme.spacing.md}`,
      }}
    >
      {/* HCL Healthcare Logo */}
      <div style={{ marginBottom: theme.spacing.md }}>
        <img
          src="/hcl-healthcare-logo.png"
          alt="HCL Healthcare"
          style={{ width: '280px', height: 'auto' }}
        />
      </div>

      {/* Lab Digitizer Logo */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <Logo size="medium" centered />
      </div>

      {/* Login Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          boxShadow: theme.shadows.md,
        }}
      >
        {/* Loading Bar */}
        {loading && <LinearProgress sx={{ mb: 3, borderRadius: '4px' }} />}

        {/* Heading */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h1
            style={{
              fontSize: theme.typography.sizes.heading,
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.textPrimary,
              margin: 0,
              marginBottom: theme.spacing.xs,
              lineHeight: theme.typography.lineHeights.tight,
            }}
          >
            Welcome Back
          </h1>
          <p
            style={{
              fontSize: theme.typography.sizes.body,
              fontWeight: theme.typography.weights.normal,
              color: theme.colors.textSecondary,
              margin: 0,
              lineHeight: theme.typography.lineHeights.normal,
            }}
          >
            Sign in to continue to your dashboard
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: theme.spacing.sm,
              backgroundColor: '#FEE2E2',
              border: `1px solid ${theme.colors.error}`,
              borderRadius: theme.radius.sm,
              marginBottom: theme.spacing.md,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: theme.spacing.xs,
              }}
            >
              <span style={{ color: theme.colors.error, fontSize: '18px' }}>⚠️</span>
              <div>
                <div
                  style={{
                    fontSize: theme.typography.sizes.small,
                    color: theme.colors.error,
                    fontWeight: theme.typography.weights.medium,
                  }}
                >
                  {error}
                </div>
                <button
                  onClick={() => setError('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.colors.error,
                    fontSize: theme.typography.sizes.small,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: '4px',
                    fontFamily: theme.typography.fontFamily,
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <CustomInput
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            autoComplete="email"
          />

          <CustomInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            showPasswordToggle
          />

          {/* Sign In Button */}
          <CustomButton
            type="submit"
            variant="primary"
            fullWidth
            disabled={loading || !email || !password}
            loading={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </CustomButton>
        </form>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: theme.spacing.xl,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: theme.typography.sizes.small,
            color: theme.colors.textSecondary,
            margin: 0,
          }}
        >
          © 2025 Lab Digitizer. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
