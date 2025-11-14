import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  LinearProgress,
  Container,
  Paper,
  useTheme,
  Link,
  Grid,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Science as LabIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

const Login: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      enqueueSnackbar('Login successful!', { variant: 'success' });

      // Navigate based on role (will be handled by protected routes)
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

    // Update form fields for visual feedback
    setEmail(creds.email);
    setPassword(creds.password);
    setError('');
    setLoading(true);

    try {
      // Pass credentials directly to avoid async state issues
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
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.secondary.light} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          {/* Left side - Branding */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ color: '#fff', textAlign: { xs: 'center', md: 'left' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' }, mb: 3 }}>
                <LabIcon sx={{ fontSize: 64, mr: 2 }} />
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    Lab Digitizer
                  </Typography>
                  <Typography variant="h6" sx={{ opacity: 0.9 }}>
                    Medical Report Digitization System
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h5" sx={{ mb: 2, fontWeight: 500 }}>
                Transform Lab Reports with AI
              </Typography>

              <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
                Upload PDF lab reports and let AI extract and digitize the data automatically.
                Review, edit, and approve reports with complete audit trails.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff' }}>95%</Typography>
                  <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9 }}>Accuracy Rate</Typography>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff' }}>60s</Typography>
                  <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9 }}>Avg Processing</Typography>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff' }}>100%</Typography>
                  <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9 }}>Audit Trail</Typography>
                </Paper>
              </Box>
            </Box>
          </Grid>

          {/* Right side - Login Form */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ maxWidth: 480, mx: 'auto', boxShadow: 5 }}>
              <CardContent sx={{ p: 4 }}>
                {loading && <LinearProgress sx={{ mb: 2 }} />}

                <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
                  Welcome Back
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Sign in to continue to your dashboard
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="email"
                    autoFocus
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="current-password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 3 }}>
                    <Link href="#" variant="body2" sx={{ textDecoration: 'none' }}>
                      Forgot password?
                    </Link>
                  </Box>

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading || !email || !password}
                    sx={{ mb: 2 }}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                      Quick Demo Access
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => handleDemoLogin('admin')}
                          disabled={loading}
                        >
                          Admin Demo
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => handleDemoLogin('nurse')}
                          disabled={loading}
                        >
                          Nurse Demo
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Login;