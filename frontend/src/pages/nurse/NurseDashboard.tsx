import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  useTheme,
  Tooltip,
  Alert,
  Grid,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Assessment as StatsIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Schedule as PendingIcon,
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
  PlayCircle as ProcessIcon,
  Flag as FlagIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as ReportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Report } from '../../types';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';

const NurseDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    uploaded: 0,
    ready: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports');
      const reportsData = response.data.data || [];

      // Ensure reportsData is an array
      if (!Array.isArray(reportsData)) {
        console.error('[DASHBOARD] Reports data is not an array:', reportsData);
        setReports([]);
        enqueueSnackbar('Invalid data format received', { variant: 'error' });
        return;
      }

      setReports(reportsData);

      // Calculate stats
      setStats({
        total: reportsData.length,
        uploaded: reportsData.filter((r: Report) => r.status === 'uploaded').length,
        ready: reportsData.filter((r: Report) => r.status === 'ready').length,
        approved: reportsData.filter((r: Report) => r.status === 'approved').length,
        rejected: reportsData.filter((r: Report) => r.status === 'rejected').length,
        flagged: reportsData.filter((r: Report) => r.flags?.requiresAttention).length,
      });
    } catch (error: any) {
      console.error('[DASHBOARD] Failed to fetch reports:', error);
      setReports([]); // Ensure reports is always an array
      enqueueSnackbar(error.response?.data?.message || 'Failed to fetch reports', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (reportId: string) => {
    try {
      await api.post(`/reports/${reportId}/process`);
      enqueueSnackbar('Report processing started', { variant: 'info' });
      setTimeout(fetchReports, 2000); // Refresh after 2 seconds
    } catch (error) {
      enqueueSnackbar('Failed to process report', { variant: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, any> = {
      uploaded: 'default',
      processing: 'info',
      ready: 'warning',
      approved: 'success',
      rejected: 'error',
      error: 'error',
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <ApprovedIcon />;
      case 'rejected':
        return <RejectedIcon />;
      case 'ready':
        return <PendingIcon />;
      default:
        return null;
    }
  };

  const getFlagIndicator = (report: Report) => {
    if (!report.uiIndicators) return null;

    const colors: Record<string, string> = {
      green: theme.palette.success.main,
      yellow: theme.palette.warning.light,
      orange: theme.palette.warning.main,
      red: theme.palette.error.main,
    };

    return (
      <Tooltip title={report.flags?.summary || 'No issues'}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: colors[report.uiIndicators.color],
            display: 'inline-block',
            mr: 1,
          }}
        />
      </Tooltip>
    );
  };

  const statCards = [
    {
      title: 'Total Reports',
      value: stats.total,
      icon: <ReportIcon />,
      color: theme.palette.primary.main,
      trend: '+12%',
    },
    {
      title: 'Ready for Review',
      value: stats.ready,
      icon: <PendingIcon />,
      color: theme.palette.warning.main,
      trend: stats.ready > 0 ? `${stats.ready} pending` : 'All clear',
    },
    {
      title: 'Approved',
      value: stats.approved,
      icon: <ApprovedIcon />,
      color: theme.palette.success.main,
      trend: `${Math.round((stats.approved / (stats.total || 1)) * 100)}% approval rate`,
    },
    {
      title: 'Flagged',
      value: stats.flagged,
      icon: <FlagIcon />,
      color: theme.palette.error.main,
      trend: stats.flagged > 0 ? 'Needs attention' : 'No issues',
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Welcome back, {user?.name}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's your dashboard overview for today
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/nurse/upload')}
          size="large"
        >
          Upload New Report
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: stat.color }}>
                      {stat.trend}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: `${stat.color}20`, color: stat.color, width: 56, height: 56 }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions Alert */}
      {stats.ready > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/nurse/review')}>
              Review Now
            </Button>
          }
        >
          You have {stats.ready} report{stats.ready > 1 ? 's' : ''} ready for review
        </Alert>
      )}

      {/* Recent Reports Table */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Reports
          </Typography>
          <Button variant="text" onClick={() => navigate('/nurse/reports')}>
            View All
          </Button>
        </Box>

        {loading ? (
          <LinearProgress />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Flag</TableCell>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Upload Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Lab</TableCell>
                  <TableCell>Parameters</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.slice(0, 5).map((report) => {
                const statusIcon = getStatusIcon(report.status);
                return (
                  <TableRow key={report._id} hover>
                    <TableCell>{getFlagIndicator(report)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {report.orderId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.status}
                        color={getStatusColor(report.status)}
                        size="small"
                        {...(statusIcon && { icon: statusIcon })}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {report.extractedData?.labName || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {report.extractedData?.results?.length || 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {report.status === 'uploaded' && (
                          <Tooltip title="Process Report">
                            <IconButton
                              size="small"
                              onClick={() => handleProcess(report._id)}
                              color="primary"
                            >
                              <ProcessIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {report.status === 'ready' && (
                          <Tooltip title="Review Report">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/nurse/review/${report._id}`)}
                              color="warning"
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={() => window.open(`${api.defaults.baseURL}/reports/${report._id}/pdf`)}
                            color="default"
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default NurseDashboard;