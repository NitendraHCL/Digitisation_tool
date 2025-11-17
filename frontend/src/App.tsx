import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import theme from './theme';

// Components
import Layout from './components/common/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth Pages
import Login from './pages/auth/Login';

// Nurse Pages
import NurseDashboard from './pages/nurse/NurseDashboard';
import UploadReport from './pages/nurse/UploadReport';
import ReviewReport from './pages/nurse/ReviewReport';
import ReportsList from './pages/nurse/ReportsList';
import AllReportsList from './pages/nurse/AllReportsList';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ConfigurationManagement from './pages/admin/ConfigurationManagement';
import AuditDashboard from './pages/admin/AuditDashboard';
import ParameterMasterManagement from './pages/admin/ParameterMasterManagement';


function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        autoHideDuration={3000}
      >
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes with Layout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                {/* Root redirect based on role */}
                <Route index element={<RoleBasedRedirect />} />

                {/* Nurse Routes */}
                <Route
                  path="nurse/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['nurse', 'admin', 'super_admin']}>
                      <NurseDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="nurse/upload"
                  element={
                    <ProtectedRoute allowedRoles={['nurse', 'admin', 'super_admin']}>
                      <UploadReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="nurse/review/:id"
                  element={
                    <ProtectedRoute allowedRoles={['nurse', 'admin', 'super_admin']}>
                      <ReviewReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="nurse/review"
                  element={
                    <ProtectedRoute allowedRoles={['nurse', 'admin', 'super_admin']}>
                      <ReportsList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="nurse/reports"
                  element={
                    <ProtectedRoute allowedRoles={['nurse', 'admin', 'super_admin']}>
                      <AllReportsList />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/reports"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <AllReportsList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/config"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <ConfigurationManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/audit"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <AuditDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/parameter-master"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <ParameterMasterManagement />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

// Component to redirect based on user role
function RoleBasedRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role
  switch (user.role) {
    case 'super_admin':
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'nurse':
      return <Navigate to="/nurse/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default App;
