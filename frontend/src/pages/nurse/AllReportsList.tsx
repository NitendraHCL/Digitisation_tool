import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Tooltip,
  LinearProgress,
  Card,
  CardContent,
  useTheme,
  Grid,
  Tabs,
  Tab,
  Avatar,
  Pagination,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  GetApp as DownloadIcon,
  Delete as DeleteIcon,
  Schedule as PendingIcon,
  Description as ReportIcon,
  TrendingUp,
  HourglassEmpty,
  Error as ErrorIcon,
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { Report } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

const AllReportsList: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user, isAdmin } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    uploaded: 0,
    processing: 0,
    ready: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    error: 0,
  });
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports');
      const reportsData = response.data.data;
      setReports(reportsData);

      // Debug: Log report statuses
      console.log('[AllReportsList] Fetched reports:', reportsData.length);
      const statusBreakdown = reportsData.reduce((acc: any, r: Report) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      console.log('[AllReportsList] Status breakdown:', statusBreakdown);

      // Check for incomplete reports
      const incompleteReports = reportsData.filter((r: Report) =>
        !r.orderId || (r.status === 'processing' && !r.extractedData)
      );
      if (incompleteReports.length > 0) {
        console.warn('[AllReportsList] Found incomplete reports:', incompleteReports.length);
        incompleteReports.forEach((r: Report) => {
          console.warn('[AllReportsList] Incomplete report:', {
            id: r._id,
            orderId: r.orderId || 'MISSING',
            status: r.status,
            hasExtractedData: !!r.extractedData
          });
        });
      }

      // Calculate stats
      setStats({
        total: reportsData.length,
        uploaded: reportsData.filter((r: Report) => r.status === 'uploaded').length,
        processing: reportsData.filter((r: Report) => r.status === 'processing').length,
        ready: reportsData.filter((r: Report) => r.status === 'ready').length,
        approved: reportsData.filter((r: Report) => r.status === 'approved').length,
        rejected: reportsData.filter((r: Report) => r.status === 'rejected').length,
        published: reportsData.filter((r: Report) => r.status === 'published').length,
        error: reportsData.filter((r: Report) => r.status === 'error').length,
      });
    } catch (error) {
      enqueueSnackbar('Failed to fetch reports', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (reportId: string) => {
    try {
      await api.post(`/reports/${reportId}/process`);
      enqueueSnackbar('Report processing started', { variant: 'info' });
      setTimeout(fetchReports, 2000);
    } catch (error) {
      enqueueSnackbar('Failed to process report', { variant: 'error' });
    }
  };

  const handleDelete = async (reportId: string) => {
    const report = reports.find(r => r._id === reportId);
    const confirmMessage = `Are you sure you want to delete this report?\n\nThis will permanently delete:\n• The PDF file\n• All audit logs\n• The report record\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await api.delete(`/reports/${reportId}`);
      enqueueSnackbar('Report, PDF file, and audit logs deleted successfully', { variant: 'success' });

      // Optimistic update: Immediately update local state
      const updatedReports = reports.filter(r => r._id !== reportId);
      setReports(updatedReports);

      // Recalculate stats from updated local state
      setStats({
        total: updatedReports.length,
        uploaded: updatedReports.filter((r: Report) => r.status === 'uploaded').length,
        processing: updatedReports.filter((r: Report) => r.status === 'processing').length,
        ready: updatedReports.filter((r: Report) => r.status === 'ready').length,
        approved: updatedReports.filter((r: Report) => r.status === 'approved').length,
        rejected: updatedReports.filter((r: Report) => r.status === 'rejected').length,
        published: updatedReports.filter((r: Report) => r.status === 'published').length,
        error: updatedReports.filter((r: Report) => r.status === 'error').length,
      });

      // Delayed refetch to ensure DB consistency
      setTimeout(fetchReports, 500);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete report';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const handleReprocess = async (reportId: string) => {
    try {
      setReprocessingId(reportId);
      await api.post(`/reports/${reportId}/reprocess`);
      enqueueSnackbar('Report reprocessing started', { variant: 'info' });
      // Poll for updates
      setTimeout(fetchReports, 3000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to reprocess report';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setReprocessingId(null);
    }
  };

  const handleChangePage = (event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
      uploaded: 'default',
      processing: 'info',
      ready: 'warning',
      approved: 'success',
      rejected: 'error',
      published: 'success',
      error: 'error',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      processing: 'Processing',
      ready: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      published: 'Published',
      error: 'Error',
    };
    return labels[status] || status;
  };

  // Filter reports based on search and status
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === '' ||
      report.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.extractedData?.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.extractedData?.labName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Paginate filtered results
  const paginatedReports = filteredReports.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Box>
      {/* Modern Header */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4
      }}>
        <Typography sx={{ fontSize: '32px', fontWeight: 700, color: 'text.primary' }}>
          Reports
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/nurse/upload')}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            boxShadow: 'none',
            px: 3,
            '&:hover': {
              boxShadow: 'none'
            }
          }}
        >
          New Report
        </Button>
      </Box>

      {/* Modern Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              transition: 'all 0.3s',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HourglassEmpty sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                  Processing
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {stats.processing}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last update: {format(new Date(), 'MMM dd')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              transition: 'all 0.3s',
              '&:hover': {
                borderColor: 'success.main',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ color: 'success.main', mr: 1 }} />
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                  Approved
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {stats.approved}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last update: {format(new Date(), 'MMM dd')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              transition: 'all 0.3s',
              '&:hover': {
                borderColor: 'warning.main',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PendingIcon sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                  Pending Review
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {stats.ready}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last update: {format(new Date(), 'MMM dd')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              transition: 'all 0.3s',
              '&:hover': {
                borderColor: 'error.main',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ErrorIcon sx={{ color: 'error.main', mr: 1 }} />
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                  Rejected
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {stats.rejected}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last update: {format(new Date(), 'MMM dd')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Modern Table Container */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        {/* Tab-based Filters and Search */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          pt: 2,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Tabs
            value={statusFilter}
            onChange={(e, newValue) => {
              setStatusFilter(newValue);
              setPage(1);
            }}
            sx={{
              minHeight: 42,
              '& .MuiTab-root': {
                textTransform: 'none',
                minHeight: 42,
                fontWeight: 600,
                fontSize: '0.875rem'
              }
            }}
          >
            <Tab label="All" value="all" />
            <Tab label="Processing" value="processing" />
            <Tab label="Pending Review" value="ready" />
            <Tab label="Approved" value="approved" />
            <Tab label="Published" value="published" />
            <Tab label="Rejected" value="rejected" />
            <Tab label="Error" value="error" />
          </Tabs>

          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              size="small"
              sx={{
                width: 280,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'background.default'
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </Box>

        {loading ? (
          <LinearProgress />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      REPORT ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      ORDER ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      PROCESSED ON
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      ASSIGNED STAFF
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      SERVICES
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      PARAMETERS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      PROCESSING TIME
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      TOKENS USED
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedReports.map((report, index) => (
                    <TableRow
                      key={report._id}
                      hover
                      onClick={() => navigate(`/nurse/review/${report._id}`)}
                      sx={{
                        bgcolor: index % 2 === 0 ? 'background.paper' : 'background.default',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                    >
                      <TableCell>
                        <Tooltip title={report._id}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {report._id.slice(-8)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ReportIcon fontSize="small" color="action" />
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              color: report.orderId ? 'text.primary' : 'error.main',
                              fontStyle: report.orderId ? 'normal' : 'italic'
                            }}
                          >
                            {report.orderId || '[No Order ID]'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip
                            label={getStatusLabel(report.status)}
                            color={getStatusColor(report.status)}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              borderRadius: 1.5,
                              height: 24,
                              fontSize: '0.75rem'
                            }}
                          />
                          {report.status === 'processing' && !report.extractedData && (
                            <Tooltip title="Report may be stuck in processing. Contact admin if this persists.">
                              <ErrorIcon fontSize="small" color="warning" />
                            </Tooltip>
                          )}
                          {report.processingIssues?.hasIncompleteProcessing && (
                            <Tooltip title={`Incomplete processing: ${report.processingIssues.message}. Click Reprocess to retry.`}>
                              <WarningIcon fontSize="small" color="warning" />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '0.75rem',
                              bgcolor: 'primary.main'
                            }}
                          >
                            {report.uploadedBy?.name ? getInitials(report.uploadedBy.name) : 'U'}
                          </Avatar>
                          <Typography variant="body2">
                            {report.uploadedBy?.name || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {report.extractedData?.labName || 'Lab Report'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {report.extractedData?.results?.length || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {report.processingMetadata?.totalProcessingTime
                            ? `${report.processingMetadata.totalProcessingTime.toFixed(2)}s`
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {report.processingMetadata?.totalTokens
                            ? report.processingMetadata.totalTokens.toLocaleString()
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Download PDF">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`${api.defaults.baseURL}/reports/${report._id}/pdf`, '_blank');
                              }}
                              sx={{
                                '&:hover': {
                                  bgcolor: 'primary.light',
                                  color: 'primary.main'
                                }
                              }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Reprocess button - show when processing is incomplete or has error */}
                          {(report.processingIssues?.hasIncompleteProcessing || report.status === 'error') && (
                            <Tooltip title={report.processingIssues?.hasIncompleteProcessing
                              ? `Reprocess (${report.processingIssues.message})`
                              : "Reprocess report"}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReprocess(report._id);
                                }}
                                disabled={reprocessingId === report._id}
                                sx={{
                                  '&:hover': {
                                    bgcolor: 'warning.light',
                                    color: 'warning.main'
                                  }
                                }}
                              >
                                {reprocessingId === report._id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <RefreshIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Only show delete button if report is not approved/published AND (user is admin OR owns the report) */}
                          {report.status !== 'approved' && report.status !== 'published' && (isAdmin || report.uploadedBy.id === user?.id) && (
                            <Tooltip title="Delete Report">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(report._id);
                                }}
                                sx={{
                                  '&:hover': {
                                    bgcolor: 'error.light',
                                    color: 'error.main'
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {paginatedReports.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No reports found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {statusFilter !== 'all'
                      ? `No reports with status "${getStatusLabel(statusFilter)}" found.`
                      : searchTerm
                        ? 'Try adjusting your search terms.'
                        : 'Upload your first report to get started.'}
                  </Typography>
                </Box>
              )}
            </TableContainer>

            {/* Modern Pagination */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="body2" color="text.secondary">
                Showing {((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, filteredReports.length)} of {filteredReports.length} entries
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handleChangePage}
                shape="rounded"
                showFirstButton
                showLastButton
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 1.5
                  }
                }}
              />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default AllReportsList;
