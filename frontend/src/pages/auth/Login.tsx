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

  const handleDemoLogin = async (role: 'admin' | 'nurse') => {
    const credentials = {
      admin: { email: 'admin@labdigital.com', password: 'Admin@123' },
      nurse: { email: 'nurse1@hospital.com', password: 'Nurse@123' },
    };

    const creds = credentials[role];
    setEmail(creds.email);
    setPassword(creds.password);
    setError('');
    setLoading(true);

    try {
      await login(creds);
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
      {/* Logo */}
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

          {/* Forgot Password Link */}
          <div style={{ marginBottom: theme.spacing.lg, textAlign: 'right' }}>
            <a
              href="#"
              style={{
                fontSize: theme.typography.sizes.small,
                color: theme.colors.accent,
                textDecoration: 'none',
                fontWeight: theme.typography.weights.medium,
                transition: theme.transitions.fast,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.colors.accentHover;
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.colors.accent;
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Forgot password?
            </a>
          </div>

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

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: `${theme.spacing.lg} 0`,
          }}
        >
          <div
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: theme.colors.divider,
            }}
          />
          <span
            style={{
              padding: `0 ${theme.spacing.sm}`,
              fontSize: theme.typography.sizes.small,
              color: theme.colors.textSecondary,
            }}
          >
            Quick Demo Access
          </span>
          <div
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: theme.colors.divider,
            }}
          />
        </div>

        {/* Demo Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: theme.spacing.sm,
          }}
        >
          <CustomButton
            variant="secondary"
            onClick={() => handleDemoLogin('admin')}
            disabled={loading}
          >
            Admin Demo
          </CustomButton>
          <CustomButton
            variant="secondary"
            onClick={() => handleDemoLogin('nurse')}
            disabled={loading}
          >
            Nurse Demo
          </CustomButton>
        </div>
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
