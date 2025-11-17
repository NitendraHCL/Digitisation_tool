import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  ArrowForward as ArrowIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AuditOverallSummary,
  AuditReportEntry,
  AuditParameterEntry,
  Report,
} from '../../types';

const AuditDashboard: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Helper function to format review time in HH:MM:SS or MM:SS format
  const formatReviewTime = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return '-';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AuditOverallSummary | null>(null);
  const [reports, setReports] = useState<AuditReportEntry[]>([]);
  const [topParameters, setTopParameters] = useState<AuditParameterEntry[]>([]);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalReports, setTotalReports] = useState(0);

  // Filters
  const [minAccuracy, setMinAccuracy] = useState('');
  const [maxAccuracy, setMaxAccuracy] = useState('');
  const [labFilter, setLabFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReportDetails, setSelectedReportDetails] = useState<Report | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, minAccuracy, maxAccuracy, labFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch summary
      const summaryRes = await api.get('/audit/summary');
      setSummary(summaryRes.data.data);

      // Fetch reports with filters
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
      });
      if (minAccuracy) params.append('minAccuracy', minAccuracy);
      if (maxAccuracy) params.append('maxAccuracy', maxAccuracy);
      if (labFilter) params.append('labName', labFilter);

      const reportsRes = await api.get(`/audit/reports?${params}`);
      setReports(reportsRes.data.data.reports);
      setTotalReports(reportsRes.data.data.pagination.total);

      // Fetch top edited parameters
      const paramsRes = await api.get('/audit/parameters?limit=10');
      setTopParameters(paramsRes.data.data);

    } catch (error: any) {
      console.error('Failed to fetch audit data:', error);
      enqueueSnackbar(error.response?.data?.message || 'Failed to load audit data', {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewReport = async (reportId: string) => {
    try {
      setLoadingDetails(true);
      setModalOpen(true);

      const response = await api.get(`/reports/${reportId}`);
      setSelectedReportDetails(response.data.data);
    } catch (error: any) {
      console.error('Failed to load report details:', error);
      enqueueSnackbar(error.response?.data?.message || 'Failed to load report details', {
        variant: 'error',
      });
      setModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedReportDetails(null);
  };

  const getFieldDisplayName = (field: string, report: Report) => {
    // Handle result fields like "results.0.value"
    const resultMatch = field.match(/results\.(\d+)\.(\w+)/);
    if (resultMatch) {
      const index = parseInt(resultMatch[1]);
      const property = resultMatch[2];
      const parameter = report.finalData?.results?.[index];
      if (parameter?.serviceItemName) {
        return `${parameter.serviceItemName} - ${property}`;
      }
      return `Parameter ${index + 1} - ${property}`;
    }

    // Handle meta fields like "meta.patient_age"
    if (field.startsWith('meta.')) {
      return field.replace('meta.', '').replace(/_/g, ' ').toUpperCase();
    }

    // Handle extractedData fields
    if (field.startsWith('extractedData.')) {
      return field.replace('extractedData.', '').replace(/([A-Z])/g, ' $1').trim();
    }

    return field;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return '#10B981';
    if (accuracy >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const getAccuracyBgColor = (accuracy: number) => {
    if (accuracy >= 90) return '#ECFDF5';
    if (accuracy >= 70) return '#FEF3C7';
    return '#FEE2E2';
  };

  if (loading && !summary) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: '#111827' }}>
          Audit & Accuracy Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '14px' }}>
          Track extraction accuracy and review quality across all reports
        </Typography>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AssessmentIcon sx={{ mr: 1, color: '#4361EE', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    Total Reports
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827' }}>
                  {summary.totalReports}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>
                  Reviewed & Completed
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CheckIcon sx={{ mr: 1, color: '#10B981', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    Avg Accuracy
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: getAccuracyColor(summary.avgAccuracy) }}>
                  {summary.avgAccuracy.toFixed(1)}%
                </Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>
                  Overall System Accuracy
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <EditIcon sx={{ mr: 1, color: '#F59E0B', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    Total Edits
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827' }}>
                  {summary.totalEdits}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>
                  Parameters Corrected
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUpIcon sx={{ mr: 1, color: '#8B5CF6', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                    High Accuracy
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827' }}>
                  {summary.reportsByAccuracy.find(r => r.range === '90-100%')?.count || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>
                  Reports ≥90% Accuracy
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Accuracy Distribution */}
      {summary && (
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Accuracy Distribution
          </Typography>
          <Grid container spacing={2}>
            {summary.reportsByAccuracy.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.range}>
                <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
                  <Typography variant="body2" sx={{ fontSize: '13px', color: '#6B7280', mb: 0.5 }}>
                    {item.range}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827' }}>
                    {item.count}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>
                    reports
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Most Edited Parameters */}
      {topParameters.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Most Edited Parameters
          </Typography>
          <Grid container spacing={1.5}>
            {topParameters.map((param, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={param.parameter}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
                  <Box sx={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: index < 3 ? '#EF4444' : '#6B7280',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {index + 1}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                      {param.parameter}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>
                      {param.count} edits
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Min Accuracy %"
              type="number"
              value={minAccuracy}
              onChange={(e) => setMinAccuracy(e.target.value)}
              sx={{ bgcolor: '#FFFFFF' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Max Accuracy %"
              type="number"
              value={maxAccuracy}
              onChange={(e) => setMaxAccuracy(e.target.value)}
              sx={{ bgcolor: '#FFFFFF' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Lab Name"
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              sx={{ bgcolor: '#FFFFFF' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setMinAccuracy('');
                setMaxAccuracy('');
                setLabFilter('');
              }}
              sx={{ height: '40px' }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Reports Table */}
      <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid #E5E7EB' }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Report Details
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#F9FAFB' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Lab Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Parameters</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Edited</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Accuracy</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Review Time</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Time/Param</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Reviewed By</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => (
                <TableRow
                  key={report.reportId}
                  sx={{ '&:hover': { bgcolor: '#F9FAFB' }, cursor: 'pointer' }}
                  onClick={() => handleViewReport(report.reportId)}
                >
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                    {report.orderId}
                  </TableCell>
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#6B7280' }}>
                    {report.labName}
                  </TableCell>
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#6B7280' }}>
                    {report.totalParameters}
                  </TableCell>
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#EF4444', fontWeight: 500 }}>
                    {report.editedParameters}
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Chip
                      label={`${report.accuracyPercentage.toFixed(1)}%`}
                      size="small"
                      sx={{
                        bgcolor: getAccuracyBgColor(report.accuracyPercentage),
                        color: getAccuracyColor(report.accuracyPercentage),
                        fontWeight: 600,
                        fontSize: '12px',
                        height: 24,
                        border: `1px solid ${getAccuracyColor(report.accuracyPercentage)}20`
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#1D4ED8', fontWeight: 500 }}>
                    {formatReviewTime(report.reviewDuration)}
                  </TableCell>
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#4F46E5', fontWeight: 500 }}>
                    {report.secondsPerParameter !== null && report.secondsPerParameter !== undefined
                      ? `${report.secondsPerParameter}s`
                      : '-'}
                  </TableCell>
                  <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#6B7280' }}>
                    {report.reviewedBy}
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Chip
                      label={report.status}
                      size="small"
                      sx={{
                        bgcolor: report.status === 'approved' ? '#D1FAE5' : '#FEE2E2',
                        color: report.status === 'approved' ? '#065F46' : '#991B1B',
                        fontWeight: 600,
                        fontSize: '11px',
                        height: 20
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1.75 }}>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewReport(report.reportId);
                      }}
                      sx={{ textTransform: 'none', fontSize: '12px' }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalReports}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>

      {/* Audit Details Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2.5, borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssessmentIcon sx={{ color: '#4361EE' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Audit Details - Order #{selectedReportDetails?.orderId || '...'}
              </Typography>
            </Box>
            <IconButton
              aria-label="close"
              onClick={handleCloseModal}
              sx={{ color: '#6B7280' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : selectedReportDetails ? (
            <Box>
              {/* Report Summary */}
              <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', mb: 1.5, textTransform: 'uppercase' }}>
                  Report Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>Order ID</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                      {selectedReportDetails.orderId}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>Lab Name</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                      {selectedReportDetails.extractedData?.labName || selectedReportDetails.finalData?.meta?.lab_name || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>Patient Name</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                      {selectedReportDetails.extractedData?.patientName || selectedReportDetails.finalData?.meta?.USER_CODE || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '11px' }}>Gender</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                      {selectedReportDetails.finalData?.meta?.gender || selectedReportDetails.extractedData?.patientGender || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Audit Statistics */}
              {selectedReportDetails.auditSummary && (
                <Paper sx={{ p: 2.5, mb: 2.5, border: '1px solid #E5E7EB' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', mb: 1.5, textTransform: 'uppercase' }}>
                    Audit Statistics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card sx={{ bgcolor: '#F3F4F6', boxShadow: 'none' }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '11px' }}>Total Parameters</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827' }}>
                            {selectedReportDetails.auditSummary.totalParameters}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card sx={{ bgcolor: '#FEE2E2', boxShadow: 'none' }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="caption" sx={{ color: '#991B1B', fontSize: '11px' }}>Edited Parameters</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#EF4444' }}>
                            {selectedReportDetails.auditSummary.editedParameters}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card sx={{ bgcolor: getAccuracyBgColor(selectedReportDetails.auditSummary.accuracyPercentage), boxShadow: 'none' }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="caption" sx={{ color: getAccuracyColor(selectedReportDetails.auditSummary.accuracyPercentage), fontSize: '11px' }}>Accuracy</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: getAccuracyColor(selectedReportDetails.auditSummary.accuracyPercentage) }}>
                            {selectedReportDetails.auditSummary.accuracyPercentage.toFixed(1)}%
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card sx={{ bgcolor: '#F3F4F6', boxShadow: 'none' }}>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '11px' }}>Reviewed By</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827', mt: 0.5 }}>
                            {selectedReportDetails.approvedBy?.name || selectedReportDetails.rejectedBy?.name || 'N/A'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    {selectedReportDetails.auditSummary.reviewDuration !== null && selectedReportDetails.auditSummary.reviewDuration !== undefined && (
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card sx={{ bgcolor: '#DBEAFE', boxShadow: 'none' }}>
                          <CardContent sx={{ p: 2 }}>
                            <Typography variant="caption" sx={{ color: '#1E40AF', fontSize: '11px' }}>Review Time</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1D4ED8' }}>
                              {formatReviewTime(selectedReportDetails.auditSummary.reviewDuration)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#3B82F6', fontSize: '10px', display: 'block', mt: 0.5 }}>
                              {selectedReportDetails.auditSummary.reviewDuration}s total
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                    {selectedReportDetails.auditSummary.secondsPerParameter !== null && selectedReportDetails.auditSummary.secondsPerParameter !== undefined && (
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card sx={{ bgcolor: '#E0E7FF', boxShadow: 'none' }}>
                          <CardContent sx={{ p: 2 }}>
                            <Typography variant="caption" sx={{ color: '#4338CA', fontSize: '11px' }}>Time Per Parameter</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#4F46E5' }}>
                              {selectedReportDetails.auditSummary.secondsPerParameter}s
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6366F1', fontSize: '10px', display: 'block', mt: 0.5 }}>
                              avg per parameter
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              )}

              {/* Edit History Table */}
              <Paper sx={{ border: '1px solid #E5E7EB' }}>
                <Box sx={{ p: 2.5, borderBottom: '1px solid #E5E7EB' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#111827', textTransform: 'uppercase' }}>
                    Edit History ({selectedReportDetails.editHistory?.length || 0} changes)
                  </Typography>
                </Box>
                {selectedReportDetails.editHistory && selectedReportDetails.editHistory.length > 0 ? (
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB' }}>Field</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB' }}>Original Value</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB', width: 40 }}></TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB' }}>New Value</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB' }}>Edited By</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB' }}>Edited At</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#6B7280', bgcolor: '#F9FAFB' }}>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedReportDetails.editHistory.map((edit, index) => (
                          <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: '#F9FAFB' } }}>
                            <TableCell sx={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>
                              {getFieldDisplayName(edit.field, selectedReportDetails)}
                            </TableCell>
                            <TableCell sx={{ fontSize: '13px' }}>
                              <Box component="span" sx={{
                                color: '#EF4444',
                                textDecoration: 'line-through',
                                bgcolor: '#FEE2E2',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                display: 'inline-block'
                              }}>
                                {typeof edit.originalValue === 'object' ? JSON.stringify(edit.originalValue) : String(edit.originalValue || 'N/A')}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <ArrowIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: '13px' }}>
                              <Box component="span" sx={{
                                color: '#10B981',
                                fontWeight: 600,
                                bgcolor: '#D1FAE5',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                display: 'inline-block'
                              }}>
                                {typeof edit.newValue === 'object' ? JSON.stringify(edit.newValue) : String(edit.newValue || 'N/A')}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: '13px' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: '12px', bgcolor: '#4361EE' }}>
                                  {edit.editedBy?.name?.charAt(0).toUpperCase() || 'U'}
                                </Avatar>
                                <Typography variant="body2" sx={{ fontSize: '13px', color: '#111827' }}>
                                  {edit.editedBy?.name || 'Unknown'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: '13px', color: '#6B7280' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TimeIcon sx={{ fontSize: 14, color: '#9CA3AF' }} />
                                {format(new Date(edit.editedAt), 'MMM dd, yyyy HH:mm')}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: '13px', color: '#6B7280' }}>
                              {edit.reason || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <CheckIcon sx={{ fontSize: 48, color: '#10B981', mb: 1 }} />
                    <Typography variant="body1" sx={{ color: '#6B7280', fontWeight: 500 }}>
                      No edits were made to this report
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                      All extracted data was accurate
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #E5E7EB' }}>
          <Button onClick={handleCloseModal} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          {selectedReportDetails && (
            <Button
              variant="outlined"
              onClick={() => {
                handleCloseModal();
                navigate(`/nurse/review/${selectedReportDetails._id}`);
              }}
              sx={{ textTransform: 'none' }}
            >
              View Full Report
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditDashboard;
