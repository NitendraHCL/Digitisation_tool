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
  Avatar,
  Pagination,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  GetApp as DownloadIcon,
  Delete as DeleteIcon,
  Schedule as PendingIcon,
  Description as ReportIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { Report } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

const ReportsList: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAdmin } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports');
      const reportsData = response.data.data;

      // Filter to only show pending review reports (status: 'ready')
      const pendingReports = reportsData.filter((r: Report) => r.status === 'ready');
      setReports(pendingReports);
      setPendingCount(pendingReports.length);
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
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await api.delete(`/reports/${reportId}`);
      enqueueSnackbar('Report deleted successfully', { variant: 'success' });
      fetchReports();
    } catch (error) {
      enqueueSnackbar('Failed to delete report', { variant: 'error' });
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
      error: 'Error',
    };
    return labels[status] || status;
  };

  // Filter reports based on search (all reports are already filtered to 'ready' status)
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === '' ||
      report.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.extractedData?.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.extractedData?.labName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
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
    <Box sx={{ p: 0 }}>
      {/* Modern Header */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4
      }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Pending Review
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

      {/* Pending Review Count Card */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                {pendingCount}
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
        {/* Search */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          px: 3,
          pt: 2,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ReportIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {report.orderId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
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
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

export default ReportsList;
