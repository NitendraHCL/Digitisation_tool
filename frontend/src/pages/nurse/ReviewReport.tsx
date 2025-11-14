import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Tooltip,
  useTheme,
  FormControlLabel,
  Checkbox,
  TextareaAutosize,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  InputAdornment,
  Grid,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as ApproveIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Flag as FlagIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Person as PersonIcon,
  CalendarToday as DateIcon,
  Description as ReportIcon,
  LocalHospital as LabIcon,
  TrendingUp,
  TrendingDown,
  Remove as NormalIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { Report, TestParameter, TestResult, EditHistory } from '../../types';
import PDFViewer from '../../components/common/PDFViewer';

import JsonOutputView from '../../components/JsonOutputView';
// Using EditHistory from types

const ReviewReport: React.FC = () => {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});
  const [editedValues, setEditedValues] = useState<{ [key: string]: any }>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [editingOrderId, setEditingOrderId] = useState(false);
  const [tempOrderId, setTempOrderId] = useState('');
  const [savingOrderId, setSavingOrderId] = useState(false);
  const [showRepeatReview, setShowRepeatReview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [parameterToDelete, setParameterToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
  const [mismatchReason, setMismatchReason] = useState('');
  const [orderData, setOrderData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [hasValidationWarnings, setHasValidationWarnings] = useState(false);
  const [loadingValidation, setLoadingValidation] = useState(false);

  useEffect(() => {
    console.log('[REVIEW] 1. Component mounted, report ID from URL:', id);
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    console.log('[REVIEW] 2. fetchReport called for ID:', id);
    try {
      setLoading(true);
      console.log('[REVIEW] 3. Fetching report from /reports/' + id);

      const response = await api.get(`/reports/${id}`);

      console.log('[REVIEW] 4. Response received:', response);
      console.log('[REVIEW] 5. Response status:', response.status);
      console.log('[REVIEW] 6. Response data:', response.data);
      console.log('[REVIEW] 7. Response success:', response.data.success);
      console.log('[REVIEW] 8. Response data.data:', response.data.data);

      if (response.data.data) {
        const reportData = response.data.data;
        console.log('[REVIEW] 9. Report data structure:', {
          _id: reportData._id,
          orderId: reportData.orderId,
          status: reportData.status,
          hasExtractedData: !!reportData.extractedData,
          extractedDataKeys: reportData.extractedData ? Object.keys(reportData.extractedData) : [],
        });

        if (reportData.extractedData) {
          console.log('[REVIEW] 10. Extracted data:', reportData.extractedData);
          console.log('[REVIEW] 11. Lab name:', reportData.extractedData.labName);
          console.log('[REVIEW] 12. Has results:', !!reportData.extractedData.results);
          console.log('[REVIEW] 13. Results count:', reportData.extractedData.results?.length || 0);
          console.log('[REVIEW] 14. Results array:', reportData.extractedData.results);

          if (reportData.extractedData.results && Array.isArray(reportData.extractedData.results)) {
            console.log('[REVIEW] 15. First 3 results:', reportData.extractedData.results.slice(0, 3));
          } else {
            console.error('[REVIEW] ERROR: Results is not an array:', reportData.extractedData.results);
          }
        } else {
          console.warn('[REVIEW] WARNING: No extractedData in report');
        }

        console.log('[REVIEW] 16. Setting report state');
        setReport(response.data.data);
      } else {
        console.error('[REVIEW] ERROR: No data in response.data.data');
      }
    } catch (error: any) {
      console.error('[REVIEW] ERROR: Failed to load report:', error);
      console.error('[REVIEW] ERROR: Response data:', error.response?.data);
      console.error('[REVIEW] ERROR: Status:', error.response?.status);
      console.error('[REVIEW] ERROR: Message:', error.message);
      enqueueSnackbar('Failed to load report', { variant: 'error' });
      navigate('/nurse/reports');
    } finally {
      setLoading(false);
      console.log('[REVIEW] 17. Loading complete');
    }
  };

  const handleEditToggle = (parameterId: string) => {
    setEditMode(prev => ({
      ...prev,
      [parameterId]: !prev[parameterId]
    }));

    if (!editMode[parameterId]) {
      const parameter = report?.extractedData?.results?.find(p => p._id === parameterId);
      if (parameter) {
        const range = parameter.referenceRange || parameter.normalRange;
        setEditedValues(prev => ({
          ...prev,
          [`${parameterId}_value`]: parameter.value,
          [`${parameterId}_unit`]: parameter.unit,
          [`${parameterId}_refLow`]: range?.low ?? (range as any)?.min ?? '',
          [`${parameterId}_refHigh`]: range?.high ?? (range as any)?.max ?? '',
          [`${parameterId}_refRange`]: (range as any)?.referenceRange ?? '',
        }));
      }
    }
  };

  const handleSaveEdit = async (parameterId: string) => {
    console.log('========== SAVE EDIT DEBUG START ==========');
    console.log('[SAVE EDIT] Function called with parameterId:', parameterId);
    console.log('[SAVE EDIT] Report ID:', id);

    if (!report) {
      console.log('[SAVE EDIT] ✗ No report available');
      return;
    }

    setSaving(true);
    try {
      // First, find the parameter in the currently displayed results (could be page-wise or full list)
      const currentResults = hasPageWiseData && report.extractedData?.pageWiseData?.[currentPage - 1]?.results
        ? report.extractedData.pageWiseData[currentPage - 1].results
        : report.extractedData?.results || [];

      const currentParameter = currentResults.find(p => p._id === parameterId);
      console.log('[SAVE EDIT] Current parameter (from displayed list):', currentParameter);

      if (!currentParameter) {
        console.log('[SAVE EDIT] ✗ Parameter not found in current results');
        console.log('[SAVE EDIT] Available parameters:', currentResults.map(p => ({ id: p._id, name: p.serviceItemName })));
        enqueueSnackbar('Parameter not found', { variant: 'error' });
        return;
      }

      // Now find the same parameter in extractedData.results by serviceItemName (the stable identifier)
      const parameterName = currentParameter.serviceItemName;
      const parameter = report.extractedData?.results?.find(p => p.serviceItemName === parameterName);
      console.log('[SAVE EDIT] Parameter found in extractedData.results:', parameter);

      if (!parameter) {
        console.log('[SAVE EDIT] ✗ Parameter not found in extractedData.results by serviceItemName:', parameterName);
        console.log('[SAVE EDIT] Available parameters:', report.extractedData?.results?.map(p => ({ id: p._id, name: p.serviceItemName })));
        enqueueSnackbar('Parameter not found in main results', { variant: 'error' });
        return;
      }

      console.log('[SAVE EDIT] Parameter name:', parameterName);
      console.log('[SAVE EDIT] Current parameter values:', {
        value: parameter.value,
        unit: parameter.unit,
        referenceRange: parameter.referenceRange,
        normalRange: parameter.normalRange
      });

      // Log all edited values for this parameter
      const relevantEditedValues = {
        value: editedValues[`${parameterId}_value`],
        unit: editedValues[`${parameterId}_unit`],
        refLow: editedValues[`${parameterId}_refLow`],
        refHigh: editedValues[`${parameterId}_refHigh`],
        refRange: editedValues[`${parameterId}_refRange`]
      };
      console.log('[SAVE EDIT] Edited values:', relevantEditedValues);

      // Prepare updates - we'll send multiple requests if multiple fields changed
      const updates: Array<{ field: string; newValue: any }> = [];

      // Check if value changed
      if (editedValues[`${parameterId}_value`] !== undefined &&
          editedValues[`${parameterId}_value`] !== parameter.value) {
        console.log('[SAVE EDIT] Value changed:', {
          from: parameter.value,
          to: editedValues[`${parameterId}_value`]
        });
        updates.push({ field: 'value', newValue: editedValues[`${parameterId}_value`] });
      }

      // Check if unit changed
      if (editedValues[`${parameterId}_unit`] !== undefined &&
          editedValues[`${parameterId}_unit`] !== parameter.unit) {
        console.log('[SAVE EDIT] Unit changed:', {
          from: parameter.unit,
          to: editedValues[`${parameterId}_unit`]
        });
        updates.push({ field: 'unit', newValue: editedValues[`${parameterId}_unit`] });
      }

      // Check if reference range changed
      const range = parameter.referenceRange || parameter.normalRange;
      let currentLow: number | null = null;
      let currentHigh: number | null = null;
      let currentRangeText = '';

      if (range) {
        if ('low' in range) {
          currentLow = range.low;
        } else if ('min' in range) {
          currentLow = (range as any).min;
        }

        if ('high' in range) {
          currentHigh = range.high;
        } else if ('max' in range) {
          currentHigh = (range as any).max;
        }

        if ('referenceRange' in range && typeof (range as any).referenceRange === 'string') {
          currentRangeText = (range as any).referenceRange;
        }
      }

      const newLow = editedValues[`${parameterId}_refLow`] ? parseFloat(editedValues[`${parameterId}_refLow`]) : null;
      const newHigh = editedValues[`${parameterId}_refHigh`] ? parseFloat(editedValues[`${parameterId}_refHigh`]) : null;
      const newRangeText = editedValues[`${parameterId}_refRange`] || '';

      console.log('[SAVE EDIT] Reference range comparison:', {
        current: { low: currentLow, high: currentHigh, text: currentRangeText },
        new: { low: newLow, high: newHigh, text: newRangeText }
      });

      // If reference range changed, send the entire referenceRange object
      if (newLow !== currentLow || newHigh !== currentHigh || newRangeText !== currentRangeText) {
        console.log('[SAVE EDIT] Reference range changed');
        updates.push({
          field: 'referenceRange',
          newValue: {
            low: newLow,
            high: newHigh,
            referenceRange: newRangeText
          }
        });
      }

      console.log('[SAVE EDIT] Total updates to send:', updates.length);
      console.log('[SAVE EDIT] Updates array:', JSON.stringify(updates, null, 2));

      // If no changes, just exit edit mode
      if (updates.length === 0) {
        console.log('[SAVE EDIT] No changes detected, exiting edit mode');
        setEditMode(prev => ({ ...prev, [parameterId]: false }));
        enqueueSnackbar('No changes to save', { variant: 'info' });
        return;
      }

      // Send each update separately
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        const payload = {
          parameterName: parameterName,
          field: update.field,
          newValue: update.newValue,
          reason: 'Manual correction by nurse'
        };

        console.log(`[SAVE EDIT] Sending update ${i + 1}/${updates.length}:`, JSON.stringify(payload, null, 2));
        console.log(`[SAVE EDIT] API URL: /review/${id}/parameter`);

        try {
          const response = await api.put(`/review/${id}/parameter`, payload);
          console.log(`[SAVE EDIT] ✓ Update ${i + 1} successful:`, response.data);
        } catch (updateError: any) {
          console.error(`[SAVE EDIT] ✗ Update ${i + 1} failed:`, {
            status: updateError.response?.status,
            statusText: updateError.response?.statusText,
            data: updateError.response?.data,
            message: updateError.message,
            fullError: updateError
          });
          throw updateError; // Re-throw to be caught by outer catch
        }
      }

      console.log('[SAVE EDIT] All updates sent successfully, refreshing report...');

      // Refresh the report to get updated data
      await fetchReport();
      console.log('[SAVE EDIT] Report refreshed successfully');

      setEditMode(prev => ({ ...prev, [parameterId]: false }));
      enqueueSnackbar('Parameter updated successfully', { variant: 'success' });
      console.log('[SAVE EDIT] ✓ Save completed successfully');

    } catch (error: any) {
      console.error('[SAVE EDIT] ✗ ERROR OCCURRED:');
      console.error('[SAVE EDIT] Error type:', error.constructor.name);
      console.error('[SAVE EDIT] Error message:', error.message);
      console.error('[SAVE EDIT] Error response status:', error.response?.status);
      console.error('[SAVE EDIT] Error response data:', error.response?.data);
      console.error('[SAVE EDIT] Error response headers:', error.response?.headers);
      console.error('[SAVE EDIT] Full error object:', error);
      console.error('[SAVE EDIT] Error stack:', error.stack);

      const errorMessage = error.response?.data?.message || 'Failed to update parameter';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      console.error('Edit parameter error:', error.response?.data);
    } finally {
      setSaving(false);
      console.log('========== SAVE EDIT DEBUG END ==========');
    }
  };

  const fetchValidationData = async () => {
    try {
      setLoadingValidation(true);
      const response = await api.get(`/review/${id}/validation`);

      if (response.data.success) {
        setOrderData(response.data.orderData);
        setReportData(response.data.reportData);
        setHasValidationWarnings(response.data.hasWarnings);
        setValidationWarnings(response.data.validationWarnings || []);
        setShowApproveDialog(true);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch validation data';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      console.error('Validation fetch error:', error.response?.data);
    } finally {
      setLoadingValidation(false);
    }
  };

  const handleApprove = async (confirmMismatch = false, mismatchReason = '') => {
    console.log('========== FRONTEND: APPROVE BUTTON CLICKED ==========');
    console.log('Report ID:', id);
    console.log('confirmMismatch:', confirmMismatch);
    console.log('mismatchReason:', mismatchReason);
    console.log('approvalNotes:', approvalNotes);

    const payload = {
      comments: approvalNotes,
      confirmMismatch,
      mismatchReason
    };

    console.log('Request payload:', JSON.stringify(payload, null, 2));
    console.log('Request URL:', `/review/${id}/approve`);

    try {
      console.log('Sending approval request...');
      const response = await api.post(`/review/${id}/approve`, payload);

      console.log('✓✓✓ APPROVAL SUCCESS! ✓✓✓');
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      enqueueSnackbar('Report approved successfully', { variant: 'success' });
      setShowApproveDialog(false);
      setShowValidationDialog(false);
      // Refresh the report to get updated status and finalData
      await fetchReport();
    } catch (error: any) {
      console.error('✗✗✗ APPROVAL FAILED ✗✗✗');
      console.error('Error object:', error);
      console.error('Error response status:', error.response?.status);
      console.error('Error response headers:', error.response?.headers);
      console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      if (error.response?.data) {
        console.error('Backend error details:');
        console.error('  - success:', error.response.data.success);
        console.error('  - message:', error.response.data.message);
        console.error('  - error:', error.response.data.error);
        console.error('  - requiresConfirmation:', error.response.data.requiresConfirmation);
        console.error('  - validationWarnings:', error.response.data.validationWarnings);
      }

      const errorMessage = error.response?.data?.message || 'Failed to approve report';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      console.error('========== END FRONTEND ERROR LOGGING ==========');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      enqueueSnackbar('Please provide a rejection reason', { variant: 'warning' });
      return;
    }

    try {
      await api.post(`/review/${id}/reject`, { reason: rejectionReason });
      enqueueSnackbar('Report rejected', { variant: 'info' });
      navigate('/nurse/reports');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to reject report';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const handleSaveOrderId = async () => {
    if (!tempOrderId.trim()) {
      enqueueSnackbar('Please enter an Order ID', { variant: 'warning' });
      return;
    }

    setSavingOrderId(true);
    try {
      const response = await api.patch(`/review/${id}/orderId`, { orderId: tempOrderId.trim() });

      if (response.data.success) {
        setReport(prev => prev ? { ...prev, orderId: tempOrderId.trim() } : null);
        setEditingOrderId(false);
        enqueueSnackbar('Order ID saved successfully', { variant: 'success' });
        await fetchReport(); // Refresh to ensure we have the latest data
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save Order ID';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSavingOrderId(false);
    }
  };

  const handleDeleteClick = (parameterId: string, parameterName: string) => {
    setParameterToDelete({ id: parameterId, name: parameterName });
    setShowDeleteDialog(true);
  };

  const handleDeleteParameter = async () => {
    if (!parameterToDelete || !report) return;

    setDeleting(true);
    try {
      await api.delete(`/review/${id}/parameter/${parameterToDelete.id}`);
      enqueueSnackbar('Parameter deleted successfully', { variant: 'success' });
      setShowDeleteDialog(false);
      setParameterToDelete(null);
      // Refresh the report to get updated data
      await fetchReport();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete parameter';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const getValueIndicator = (parameter: TestParameter | TestResult) => {
    // Try referenceRange first, fall back to normalRange
    const range = parameter.referenceRange || parameter.normalRange;
    if (!range) return null;

    const value = parseFloat(parameter.value);

    // Handle both referenceRange format {low, high} and normalRange format {min, max}
    const min = 'low' in range ? range.low : 'min' in range ? range.min : null;
    const max = 'high' in range ? range.high : 'max' in range ? range.max : null;

    if (isNaN(value) || min === null || max === null) return null;

    if (value < min) {
      const deviation = ((min - value) / min) * 100;
      return {
        icon: <TrendingDown />,
        color: deviation > 20 ? theme.palette.error.main : theme.palette.warning.main,
        label: 'Low',
        severity: deviation > 20 ? 'critical' : 'warning'
      };
    } else if (value > max) {
      const deviation = ((value - max) / max) * 100;
      return {
        icon: <TrendingUp />,
        color: deviation > 20 ? theme.palette.error.main : theme.palette.warning.main,
        label: 'High',
        severity: deviation > 20 ? 'critical' : 'warning'
      };
    }

    return {
      icon: <NormalIcon />,
      color: theme.palette.success.main,
      label: 'Normal',
      severity: 'normal'
    };
  };

  const getFlagColor = () => {
    if (!report?.uiIndicators) return theme.palette.grey[400];
    const colors: Record<string, string> = {
      green: theme.palette.success.main,
      yellow: theme.palette.warning.light,
      orange: theme.palette.warning.main,
      red: theme.palette.error.main,
    };
    return colors[report.uiIndicators.color] || theme.palette.grey[400];
  };

  const getReferenceRangeDisplay = (parameter: TestParameter | TestResult): string => {
    if (parameter.referenceRange) {
      // Check if it has the string referenceRange property
      if ('referenceRange' in parameter.referenceRange && typeof parameter.referenceRange.referenceRange === 'string') {
        return parameter.referenceRange.referenceRange;
      }
      // Check if it has low/high numeric values
      if (parameter.referenceRange.low !== null && parameter.referenceRange.high !== null) {
        return `${parameter.referenceRange.low} - ${parameter.referenceRange.high}`;
      }
    }
    // Fall back to normalRange
    if (parameter.normalRange) {
      return `${parameter.normalRange.min} - ${parameter.normalRange.max}`;
    }
    return '-';
  };

  // Get column order from report or use default
  const columnOrder = report?.extractedData?.columnOrder || ['Parameter', 'Value', 'Normal Range', 'Unit'];
  console.log('[REVIEW] Column order:', columnOrder);

  // Helper function to render cell content based on column name
  const renderCellContent = (columnName: string, parameter: TestResult, isEditing: boolean, isAbnormal: boolean, indicator: any) => {
    switch (columnName) {
      case 'Parameter':
        return (
          <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 600 : 400, color: '#111827', fontSize: '14px' }}>
            {parameter.serviceItemName}
          </Typography>
        );

      case 'Value':
        return isEditing ? (
          <TextField
            size="small"
            value={editedValues[`${parameter._id}_value`] || parameter.value}
            onChange={(e) => setEditedValues(prev => ({
              ...prev,
              [`${parameter._id}_value`]: e.target.value
            }))}
            sx={{ width: 100 }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 600 : 400, color: '#111827', fontSize: '14px' }}>
              {parameter.value}
            </Typography>
            {indicator && indicator.severity !== 'normal' && (
              <Chip
                label={indicator.label}
                icon={indicator.icon}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '11px',
                  fontWeight: 600,
                  bgcolor: indicator.color + '15',
                  color: indicator.color,
                  border: `1px solid ${indicator.color}40`,
                  '& .MuiChip-icon': {
                    fontSize: '14px',
                    color: indicator.color,
                    marginLeft: '4px'
                  }
                }}
              />
            )}
          </Box>
        );

      case 'Unit':
        return isEditing ? (
          <TextField
            size="small"
            value={editedValues[`${parameter._id}_unit`] || parameter.unit}
            onChange={(e) => setEditedValues(prev => ({
              ...prev,
              [`${parameter._id}_unit`]: e.target.value
            }))}
            sx={{ width: 80 }}
          />
        ) : (
          <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 500 : 400, color: '#6B7280', fontSize: '14px' }}>
            {parameter.unit}
          </Typography>
        );

      case 'Normal Range':
        return isEditing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                size="small"
                label="Low"
                value={editedValues[`${parameter._id}_refLow`] ?? ''}
                onChange={(e) => setEditedValues(prev => ({
                  ...prev,
                  [`${parameter._id}_refLow`]: e.target.value
                }))}
                sx={{ width: 70 }}
              />
              <Typography variant="body2">-</Typography>
              <TextField
                size="small"
                label="High"
                value={editedValues[`${parameter._id}_refHigh`] ?? ''}
                onChange={(e) => setEditedValues(prev => ({
                  ...prev,
                  [`${parameter._id}_refHigh`]: e.target.value
                }))}
                sx={{ width: 70 }}
              />
            </Box>
            <TextField
              size="small"
              label="Range Text"
              value={editedValues[`${parameter._id}_refRange`] ?? ''}
              onChange={(e) => setEditedValues(prev => ({
                ...prev,
                [`${parameter._id}_refRange`]: e.target.value
              }))}
              fullWidth
            />
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '14px' }}>
            {getReferenceRangeDisplay(parameter)}
          </Typography>
        );

      default:
        return null;
    }
  };

  // Get page-wise data if available, otherwise fall back to all results
  const pageWiseData = report?.extractedData?.pageWiseData;
  const hasPageWiseData = pageWiseData && pageWiseData.length > 0;
  const totalPages = hasPageWiseData ? pageWiseData.length : 1;

  // Get results for current page
  const currentPageResults = hasPageWiseData
    ? pageWiseData.find((p: any) => p.pageNumber === currentPage)?.results || []
    : report?.extractedData?.results || [];

  // Filter results based on search term
  const filteredResults = currentPageResults.filter((param: TestResult) =>
    param.serviceItemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    param.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Page change handler
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    console.log('[REVIEW] Page changed to:', newPage);
  };

  console.log('[REVIEW] 18. Render check - loading:', loading, 'report:', !!report);
  console.log('[REVIEW] 18a. Page-wise data available:', hasPageWiseData);
  console.log('[REVIEW] 18b. Total pages:', totalPages);
  console.log('[REVIEW] 18c. Current page:', currentPage);
  console.log('[REVIEW] 18d. Current page results:', currentPageResults.length);

  if (loading) {
    console.log('[REVIEW] 19. Showing loading spinner');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!report) {
    console.error('[REVIEW] ERROR: No report data to display');
    return (
      <Alert severity="error">Report not found</Alert>
    );
  }

  console.log('[REVIEW] 20. Rendering report UI for:', report.orderId);
  console.log('[REVIEW] 21. Report status:', report.status);
  console.log('[REVIEW] 22. Has extractedData:', !!report.extractedData);
  console.log('[REVIEW] 23. Results count:', report.extractedData?.results?.length || 0);

  // Show JSON view if report is approved and not in repeat review mode
  if (report.status === 'approved' && !showRepeatReview && report.finalData) {
    return (
      <JsonOutputView
        jsonData={report.finalData}
        orderId={report.orderId}
        onRepeatReview={() => setShowRepeatReview(true)}
        onBack={() => navigate('/nurse/reports')}
      />
    );
  }

  // Otherwise show the split-view for review/editing
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Review Lab Report
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Review and approve the extracted data from the lab report
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="View Edit History">
              <IconButton onClick={() => setShowHistory(true)} color="primary">
                <Badge badgeContent={report.editHistory?.length || 0} color="error">
                  <HistoryIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Repeat Review Alert */}
        {showRepeatReview && (
          <Alert
            severity="info"
            icon={<InfoIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Repeat Review Mode
            </Typography>
            <Typography variant="body2">
              You are re-reviewing an approved report. Make your changes and click "Re-Approve" to regenerate the JSON output.
            </Typography>
          </Alert>
        )}

        {/* Status Alert */}
        {report.flags?.requiresAttention && (
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Attention Required
            </Typography>
            <Typography variant="body2">
              {report.flags.summary}
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Split View: PDF Viewer + Extracted Data */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Left Side: PDF Viewer */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ position: 'sticky', top: 16, height: 'calc(100vh - 150px)' }}>
            {(() => {
              // Extract filename from path (handle both absolute and relative paths)
              const filename = report.pdfPath.includes('/')
                ? report.pdfPath.split('/').pop()
                : report.pdfPath;
              const pdfUrl = `http://localhost:5001/uploads/${filename}`;

              console.log('[REVIEW REPORT] ========== PDF URL CONSTRUCTION ==========');
              console.log('[REVIEW REPORT] Original pdfPath:', report.pdfPath);
              console.log('[REVIEW REPORT] Extracted filename:', filename);
              console.log('[REVIEW REPORT] Constructed PDF URL:', pdfUrl);
              console.log('[REVIEW REPORT] Report ID:', report._id);
              console.log('[REVIEW REPORT] Report status:', report.status);
              console.log('[REVIEW REPORT] Has page-wise data:', hasPageWiseData);
              console.log('[REVIEW REPORT] Total pages:', totalPages);
              return (
                <PDFViewer
                  pdfUrl={pdfUrl}
                  currentPage={currentPage}
                  totalPages={hasPageWiseData ? totalPages : undefined}
                  onPageChange={hasPageWiseData ? handlePageChange : undefined}
                />
              );
            })()}
          </Box>
        </Grid>

        {/* Right Side: Extracted Data */}
        <Grid size={{ xs: 12, lg: 7 }}>
          {/* Report Info Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            bgcolor: !report.orderId ? '#FEF3C7' : 'white',
            border: !report.orderId ? '2px solid #F59E0B' : '1px solid #E5E7EB',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            height: '100%'
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <ReportIcon sx={{ mr: 1, color: !report.orderId ? '#F59E0B' : '#4361EE', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Order ID {!report.orderId && <span style={{ color: '#EF4444' }}>*</span>}
                </Typography>
              </Box>
              {!report.orderId || editingOrderId ? (
                <Box>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Enter Order ID"
                    value={editingOrderId ? tempOrderId : ''}
                    onChange={(e) => setTempOrderId(e.target.value)}
                    onFocus={() => setEditingOrderId(true)}
                    autoFocus={!report.orderId}
                    disabled={savingOrderId}
                    sx={{ mb: 1 }}
                  />
                  {editingOrderId && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleSaveOrderId}
                        disabled={savingOrderId || !tempOrderId.trim()}
                        fullWidth
                      >
                        {savingOrderId ? 'Saving...' : 'Save'}
                      </Button>
                      {report.orderId && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setEditingOrderId(false);
                            setTempOrderId('');
                          }}
                          disabled={savingOrderId}
                        >
                          Cancel
                        </Button>
                      )}
                    </Box>
                  )}
                  {!report.orderId && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                      <Typography variant="caption">
                        Required before approval
                      </Typography>
                    </Alert>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#111827', wordBreak: 'break-all' }}>
                    {report.orderId}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Chip
                      label={report.status}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '11px',
                        fontWeight: 600,
                        bgcolor: report.status === 'ready' ? '#FEF3C7' : report.status === 'approved' ? '#D1FAE5' : '#F3F4F6',
                        color: report.status === 'ready' ? '#B45309' : report.status === 'approved' ? '#065F46' : '#6B7280',
                        border: `1px solid ${report.status === 'ready' ? '#FCD34D' : report.status === 'approved' ? '#6EE7B7' : '#D1D5DB'}`
                      }}
                    />
                    <Button
                      size="small"
                      startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        setTempOrderId(report.orderId || '');
                        setEditingOrderId(true);
                      }}
                      sx={{
                        textTransform: 'none',
                        color: '#6B7280',
                        fontSize: '11px',
                        fontWeight: 500,
                        px: 1,
                        py: 0.25,
                        minHeight: 0,
                        '&:hover': { bgcolor: '#F3F4F6', color: '#4361EE' }
                      }}
                    >
                      Edit
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            height: '100%'
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <LabIcon sx={{ mr: 1, color: '#8B5CF6', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Laboratory
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', fontSize: '16px', mb: 0.5 }}>
                {report.extractedData?.labName || 'Unknown Lab'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                {report.extractedData?.labAddress || 'No address'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            height: '100%'
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <PersonIcon sx={{ mr: 1, color: '#06B6D4', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Patient
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', fontSize: '16px', mb: 0.5 }}>
                {report.extractedData?.patientName || 'Not specified'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                {report.extractedData?.patientAge && report.extractedData?.patientGender
                  ? `${report.extractedData.patientAge} / ${report.extractedData.patientGender}`
                  : 'Details not available'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            height: '100%'
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                <FlagIcon sx={{ mr: 1, color: getFlagColor(), fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Overall Status
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: getFlagColor(), fontSize: '16px', mb: 0.5 }}>
                {report.uiIndicators?.label || 'Normal'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                {report.extractedData?.results?.length || 0} parameters
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Audit Summary Card - Only show for approved/rejected reports */}
        {report.auditSummary && (report.status === 'approved' || report.status === 'rejected') && (
          <Grid size={{ xs: 12, md: 3 }}>
            <Card sx={{
              bgcolor: report.auditSummary.accuracyPercentage >= 90 ? '#ECFDF5' : report.auditSummary.accuracyPercentage >= 70 ? '#FEF3C7' : '#FEE2E2',
              border: `1px solid ${report.auditSummary.accuracyPercentage >= 90 ? '#6EE7B7' : report.auditSummary.accuracyPercentage >= 70 ? '#FCD34D' : '#FECACA'}`,
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              height: '100%'
            }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <HistoryIcon sx={{ mr: 1, color: report.auditSummary.accuracyPercentage >= 90 ? '#10B981' : report.auditSummary.accuracyPercentage >= 70 ? '#F59E0B' : '#EF4444', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Accuracy
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: report.auditSummary.accuracyPercentage >= 90 ? '#065F46' : report.auditSummary.accuracyPercentage >= 70 ? '#92400E' : '#991B1B', fontSize: '24px', mb: 0.5 }}>
                  {report.auditSummary.accuracyPercentage.toFixed(1)}%
                </Typography>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  {report.auditSummary.editedParameters} of {report.auditSummary.totalParameters} edited
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Test Results Table */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
            Test Results
          </Typography>
          <TextField
            size="small"
            placeholder="Search parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 300,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#F9FAFB',
                '&:hover': {
                  backgroundColor: '#F3F4F6',
                }
              }
            }}
          />
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                {columnOrder.map((columnName) => (
                  <TableCell key={columnName} sx={{ fontWeight: 600, color: '#6B7280', fontSize: '13px', py: 2 }}>
                    {columnName}
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '13px', py: 2, textAlign: 'right' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredResults?.map((parameter: TestResult) => {
                const indicator = getValueIndicator(parameter);
                const isEditing = editMode[parameter._id || ''];
                const isAbnormal = indicator?.severity === 'critical' || indicator?.severity === 'warning';

                return (
                  <TableRow
                    key={parameter._id}
                    sx={{
                      backgroundColor: indicator?.severity === 'critical'
                        ? 'rgba(239, 68, 68, 0.04)'
                        : indicator?.severity === 'warning'
                        ? 'rgba(245, 158, 11, 0.04)'
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: indicator?.severity === 'critical'
                          ? 'rgba(239, 68, 68, 0.08)'
                          : indicator?.severity === 'warning'
                          ? 'rgba(245, 158, 11, 0.08)'
                          : '#F9FAFB',
                      },
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    {columnOrder.map((columnName) => (
                      <TableCell key={columnName} sx={{ py: 2.5, px: 2 }}>
                        {renderCellContent(columnName, parameter, isEditing, isAbnormal, indicator)}
                      </TableCell>
                    ))}
                    <TableCell sx={{ py: 2.5, px: 2, textAlign: 'right' }}>
                      {isEditing ? (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleSaveEdit(parameter._id || '')}
                            disabled={saving}
                            title="Save changes"
                            sx={{
                              bgcolor: '#4361EE',
                              color: 'white',
                              '&:hover': { bgcolor: '#3651CE' },
                              width: 32,
                              height: 32
                            }}
                          >
                            <SaveIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setEditMode(prev => ({ ...prev, [parameter._id || '']: false }))}
                            title="Cancel editing"
                            sx={{
                              bgcolor: '#F3F4F6',
                              color: '#6B7280',
                              '&:hover': { bgcolor: '#E5E7EB' },
                              width: 32,
                              height: 32
                            }}
                          >
                            <CancelIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditToggle(parameter._id || '')}
                            title="Edit parameter"
                            sx={{
                              color: '#6B7280',
                              '&:hover': { bgcolor: '#F3F4F6', color: '#4361EE' },
                              width: 32,
                              height: 32
                            }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(parameter._id || '', parameter.serviceItemName)}
                            title="Delete parameter"
                            sx={{
                              color: '#EF4444',
                              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' },
                              width: 32,
                              height: 32
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outlined"
          onClick={() => navigate('/nurse/reports')}
          sx={{
            borderColor: '#D1D5DB',
            color: '#6B7280',
            '&:hover': {
              borderColor: '#9CA3AF',
              bgcolor: '#F9FAFB'
            },
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1
          }}
        >
          Back to Reports
        </Button>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {!report.orderId && (
            <Alert
              severity="warning"
              sx={{
                mr: 2,
                borderRadius: 2,
                border: '1px solid #FCD34D',
                bgcolor: '#FEF3C7',
                '& .MuiAlert-icon': { color: '#F59E0B' }
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '14px', color: '#92400E' }}>
                Please add an Order ID before approving or rejecting this report
              </Typography>
            </Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => setShowRejectDialog(true)}
            disabled={!report.orderId}
            title={!report.orderId ? 'Order ID required' : ''}
            sx={{
              borderColor: '#FCA5A5',
              color: '#EF4444',
              '&:hover': {
                borderColor: '#EF4444',
                bgcolor: 'rgba(239, 68, 68, 0.04)'
              },
              '&:disabled': {
                borderColor: '#E5E7EB',
                color: '#9CA3AF'
              },
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1
            }}
          >
            Reject Report
          </Button>
          <Button
            variant="contained"
            startIcon={<ApproveIcon />}
            onClick={() => fetchValidationData()}
            disabled={!report.orderId || loadingValidation}
            title={!report.orderId ? 'Order ID required' : ''}
            sx={{
              bgcolor: '#10B981',
              color: 'white',
              '&:hover': {
                bgcolor: '#059669'
              },
              '&:disabled': {
                bgcolor: '#E5E7EB',
                color: '#9CA3AF'
              },
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            {showRepeatReview ? 'Re-Approve Report' : 'Approve Report'}
          </Button>
        </Box>
      </Box>

      {/* Approve Dialog with Validation */}
      <Dialog
        open={showApproveDialog}
        onClose={() => {
          setShowApproveDialog(false);
          setApprovalNotes('');
          setMismatchReason('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: hasValidationWarnings ? '#FEF3C7' : '#D1FAE5',
          borderBottom: `2px solid ${hasValidationWarnings ? '#F59E0B' : '#10B981'}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {hasValidationWarnings ? (
              <WarningIcon sx={{ color: '#F59E0B', mr: 1 }} />
            ) : (
              <CheckIcon sx={{ color: '#10B981', mr: 1 }} />
            )}
            <Typography variant="h6">
              {hasValidationWarnings ? 'Validation Warnings Detected' : 'Ready to Approve'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Validation Status Summary */}
          {validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Order ID Not Found
              </Typography>
              <Typography variant="body2">
                {validationWarnings.find(w => w.type === 'ORDER_NOT_FOUND')?.message ||
                 'The Order ID could not be found in the database. Please verify the Order ID is correct before proceeding.'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
                This report cannot be approved until the Order ID issue is resolved.
              </Typography>
            </Alert>
          ) : hasValidationWarnings ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              The following mismatches were detected between Order data and LLM-extracted data.
              Please review and confirm before approving.
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              All patient demographic fields match between Order data and LLM extraction.
              You can proceed with approval.
            </Alert>
          )}

          {/* Side-by-side Comparison - Only show if not ORDER_NOT_FOUND */}
          {!validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Data Comparison
              </Typography>

              {/* Patient Name */}
              <Card sx={{ mb: 2, border: `1px solid ${
                validationWarnings.some(w => w.field === 'patientName') ? '#FCD34D' : '#D1FAE5'
              }`, bgcolor: validationWarnings.some(w => w.field === 'patientName') ? '#FFFBEB' : '#F0FDF4' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Patient Name
                    </Typography>
                    {validationWarnings.some(w => w.field === 'patientName') ? (
                      <Chip icon={<CloseIcon />} label="Mismatch" color="warning" size="small" />
                    ) : (
                      <Chip icon={<CheckIcon />} label="Match" color="success" size="small" />
                    )}
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Order Data:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {orderData?.patient_name || 'Not specified'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">LLM Extracted:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {reportData?.patientName || 'Not specified'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Patient Gender */}
              <Card sx={{ mb: 2, border: `1px solid ${
                validationWarnings.some(w => w.field === 'patientGender') ? '#FCD34D' : '#D1FAE5'
              }`, bgcolor: validationWarnings.some(w => w.field === 'patientGender') ? '#FFFBEB' : '#F0FDF4' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Patient Gender
                    </Typography>
                    {validationWarnings.some(w => w.field === 'patientGender') ? (
                      <Chip icon={<CloseIcon />} label="Mismatch" color="warning" size="small" />
                    ) : (
                      <Chip icon={<CheckIcon />} label="Match" color="success" size="small" />
                    )}
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Order Data:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {orderData?.gender || 'Not specified'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">LLM Extracted:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {reportData?.patientGender || 'Not specified'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Override Reason (only if warnings and NOT ORDER_NOT_FOUND) */}
          {hasValidationWarnings && !validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason for Override (Required)"
              value={mismatchReason}
              onChange={(e) => setMismatchReason(e.target.value)}
              placeholder="Please explain why you are approving despite these mismatches..."
              required
              sx={{ mb: 2 }}
            />
          )}

          {/* Approval Notes - Only show if not ORDER_NOT_FOUND */}
          {!validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') && (
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes (Optional)"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
            />
          )}

          {hasValidationWarnings && !validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                By proceeding, you acknowledge these mismatches and confirm that the approval is correct.
                This action will be recorded in the audit trail.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#F9FAFB' }}>
          <Button
            onClick={() => {
              setShowApproveDialog(false);
              setApprovalNotes('');
              setMismatchReason('');
            }}
            sx={{ mr: 1 }}
          >
            {validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') ? 'Close' : 'Cancel'}
          </Button>
          {/* Hide Approve button if ORDER_NOT_FOUND */}
          {!validationWarnings.some(w => w.type === 'ORDER_NOT_FOUND') && (
            <Button
              variant="contained"
              color={hasValidationWarnings ? 'warning' : 'success'}
              onClick={() => {
                if (hasValidationWarnings && !mismatchReason.trim()) {
                  enqueueSnackbar('Please provide a reason for override', { variant: 'warning' });
                  return;
                }
                handleApprove(hasValidationWarnings, mismatchReason);
              }}
              disabled={hasValidationWarnings && !mismatchReason.trim()}
              startIcon={<ApproveIcon />}
            >
              {hasValidationWarnings ? 'Approve with Override' : 'Confirm Approval'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onClose={() => setShowRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this report.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this report is being rejected..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRejectDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleReject}>
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit History Dialog */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit History</DialogTitle>
        <DialogContent>
          {report.editHistory && report.editHistory.length > 0 ? (
            <List>
              {report.editHistory.map((edit, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <EditIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${edit.field}: ${edit.originalValue} → ${edit.newValue}`}
                    secondary={`Edited on ${new Date(edit.editedAt).toLocaleString()}${edit.reason ? ` - ${edit.reason}` : ''}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No edits have been made to this report
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Parameter Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => !deleting && setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Parameter</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Warning: This action cannot be undone
            </Typography>
          </Alert>
          <Typography variant="body2">
            Are you sure you want to delete the following parameter?
          </Typography>
          <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
            {parameterToDelete?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will permanently remove this test result from the report.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowDeleteDialog(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteParameter}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete Parameter'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default ReviewReport;