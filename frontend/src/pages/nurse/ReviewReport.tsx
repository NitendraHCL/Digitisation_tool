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
import { theme as appTheme } from '../../styles/theme';
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
  Code as CodeIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  AddCircle as AddIcon,
  Block as BlockIcon,
  LibraryAdd as ParameterMasterIcon,
  Publish as PublishIcon,
} from '@mui/icons-material';
import api, { BACKEND_BASE_URL } from '../../services/api';
import { useSnackbar } from 'notistack';
import { Report, TestParameter, TestResult, EditHistory } from '../../types';
import PDFViewer from '../../components/common/PDFViewer';
import ValidationFlag from '../../components/validation/ValidationFlag';
import ParameterSearchField from '../../components/parameters/ParameterSearchField';

import JsonOutputView from '../../components/JsonOutputView';
// Using EditHistory from types

// Interface for review session tracking
interface ReviewSession {
  reportId: string;
  accumulatedSeconds: number;  // Total time across all sessions
  sessionStartTime: number | null;  // Current session start timestamp
  lastSavedTime: number;  // When was this last updated
}

// localStorage helper functions for review session management
const STORAGE_PREFIX = 'review_session_';

const getReviewSession = (reportId: string): ReviewSession | null => {
  try {
    const key = `${STORAGE_PREFIX}${reportId}`;
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data) as ReviewSession;
    }
  } catch (error) {
    console.error('[REVIEW TIMER] Error reading session from localStorage:', error);
  }
  return null;
};

const saveReviewSession = (session: ReviewSession): void => {
  try {
    const key = `${STORAGE_PREFIX}${session.reportId}`;
    localStorage.setItem(key, JSON.stringify(session));
  } catch (error) {
    console.error('[REVIEW TIMER] Error saving session to localStorage:', error);
  }
};

const removeReviewSession = (reportId: string): void => {
  try {
    const key = `${STORAGE_PREFIX}${reportId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[REVIEW TIMER] Error removing session from localStorage:', error);
  }
};

// Clean up old sessions (older than 7 days)
const cleanupOldSessions = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          const session = JSON.parse(localStorage.getItem(key) || '{}') as ReviewSession;
          if (session.lastSavedTime && (now - session.lastSavedTime > SEVEN_DAYS)) {
            localStorage.removeItem(key);
            console.log('[REVIEW TIMER] Cleaned up old session:', key);
          }
        } catch (e) {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('[REVIEW TIMER] Error during cleanup:', error);
  }
};

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
  const [showJsonOutput, setShowJsonOutput] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Cumulative time tracking state
  const [currentSessionStart, setCurrentSessionStart] = useState<number | null>(null);
  const [accumulatedTime, setAccumulatedTime] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [parameterToDelete, setParameterToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
  const [mismatchReason, setMismatchReason] = useState('');
  const [orderData, setOrderData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [hasValidationWarnings, setHasValidationWarnings] = useState(false);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [showParameterMasterDialog, setShowParameterMasterDialog] = useState(false);
  const [showExclusionDialog, setShowExclusionDialog] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState<TestResult | null>(null);
  const [showExcludedParamsDialog, setShowExcludedParamsDialog] = useState(false);
  const [selectedValidationFlag, setSelectedValidationFlag] = useState<any | null>(null);
  // Parameter Master dialog state
  const [parameterAction, setParameterAction] = useState<'create' | 'update_alias'>('create');
  const [targetParameter, setTargetParameter] = useState<any | null>(null);
  const [newParameterId, setNewParameterId] = useState('');
  const [valueType, setValueType] = useState<'numeric' | 'text' | 'alphanumeric' | 'range'>('numeric');
  const [parameterDescription, setParameterDescription] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // Timer helper functions
  const pauseTimer = () => {
    if (!id || !isTimerActive || currentSessionStart === null) return;

    const now = Date.now();
    const sessionDuration = Math.floor((now - currentSessionStart) / 1000);
    const newAccumulated = accumulatedTime + sessionDuration;

    console.log('[REVIEW TIMER] Pausing timer:', {
      sessionDuration,
      previousAccumulated: accumulatedTime,
      newAccumulated
    });

    setAccumulatedTime(newAccumulated);
    setCurrentSessionStart(null);
    setIsTimerActive(false);

    // Save to localStorage
    saveReviewSession({
      reportId: id,
      accumulatedSeconds: newAccumulated,
      sessionStartTime: null,
      lastSavedTime: now
    });
  };

  const resumeTimer = () => {
    if (!id || isTimerActive) return;

    const now = Date.now();
    console.log('[REVIEW TIMER] Resuming timer, accumulated time:', accumulatedTime);

    setCurrentSessionStart(now);
    setIsTimerActive(true);

    // Update localStorage
    saveReviewSession({
      reportId: id,
      accumulatedSeconds: accumulatedTime,
      sessionStartTime: now,
      lastSavedTime: now
    });
  };

  const saveCurrentSession = () => {
    if (!id) return;

    let finalAccumulated = accumulatedTime;

    // If timer is active, add current session time
    if (isTimerActive && currentSessionStart !== null) {
      const now = Date.now();
      const sessionDuration = Math.floor((now - currentSessionStart) / 1000);
      finalAccumulated = accumulatedTime + sessionDuration;
    }

    console.log('[REVIEW TIMER] Saving current session, total accumulated:', finalAccumulated);

    saveReviewSession({
      reportId: id,
      accumulatedSeconds: finalAccumulated,
      sessionStartTime: isTimerActive ? Date.now() : null,
      lastSavedTime: Date.now()
    });
  };

  useEffect(() => {
    console.log('[REVIEW] 1. Component mounted, report ID from URL:', id);
    fetchReport();
  }, [id]);

  // Page Visibility API - pause timer when tab becomes inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[REVIEW TIMER] Page became hidden, pausing timer');
        pauseTimer();
      } else {
        console.log('[REVIEW TIMER] Page became visible, resuming timer');
        resumeTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTimerActive, currentSessionStart, accumulatedTime, id]);

  // beforeunload - save session before page unload/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('[REVIEW TIMER] Page unloading, saving session');
      saveCurrentSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isTimerActive, currentSessionStart, accumulatedTime, id]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('[REVIEW TIMER] Component unmounting, saving session');
      saveCurrentSession();
    };
  }, [isTimerActive, currentSessionStart, accumulatedTime, id]);

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

        // Initialize cumulative timer for review tracking (only if status is 'ready' or 'approved')
        if (response.data.data.status === 'ready' || response.data.data.status === 'approved') {
          if (id) {
            // Clean up old sessions first
            cleanupOldSessions();

            // Check for existing session in localStorage
            const existingSession = getReviewSession(id);

            if (existingSession) {
              console.log('[REVIEW TIMER] Restoring existing session:', existingSession);
              setAccumulatedTime(existingSession.accumulatedSeconds);

              // Start new session
              const now = Date.now();
              setCurrentSessionStart(now);
              setIsTimerActive(true);

              saveReviewSession({
                reportId: id,
                accumulatedSeconds: existingSession.accumulatedSeconds,
                sessionStartTime: now,
                lastSavedTime: now
              });
            } else {
              // Start fresh session
              console.log('[REVIEW TIMER] Starting fresh review session');
              const now = Date.now();
              setAccumulatedTime(0);
              setCurrentSessionStart(now);
              setIsTimerActive(true);

              saveReviewSession({
                reportId: id,
                accumulatedSeconds: 0,
                sessionStartTime: now,
                lastSavedTime: now
              });
            }
          }
        }
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

    // Calculate cumulative review duration in seconds
    let reviewDuration = accumulatedTime;

    // If timer is currently active, add current session time
    if (isTimerActive && currentSessionStart !== null) {
      const now = Date.now();
      const currentSessionSeconds = Math.floor((now - currentSessionStart) / 1000);
      reviewDuration = accumulatedTime + currentSessionSeconds;
    }

    console.log('[REVIEW TIMER] Total review duration (seconds):', reviewDuration);
    console.log('[REVIEW TIMER] Accumulated time:', accumulatedTime);
    console.log('[REVIEW TIMER] Current session:', isTimerActive ? 'active' : 'paused');

    const payload = {
      comments: approvalNotes,
      confirmMismatch,
      mismatchReason,
      reviewDuration
    };

    console.log('Request payload:', JSON.stringify(payload, null, 2));
    console.log('Request URL:', `/review/${id}/approve`);

    try {
      console.log('Sending approval request...');
      const response = await api.post(`/review/${id}/approve`, payload);

      console.log('✓✓✓ APPROVAL SUCCESS! ✓✓✓');
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      // Remove review session from localStorage as review is complete
      if (id) {
        removeReviewSession(id);
        console.log('[REVIEW TIMER] Session removed from localStorage after approval');
      }

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

    // Calculate cumulative review duration in seconds
    let reviewDuration = accumulatedTime;

    // If timer is currently active, add current session time
    if (isTimerActive && currentSessionStart !== null) {
      const now = Date.now();
      const currentSessionSeconds = Math.floor((now - currentSessionStart) / 1000);
      reviewDuration = accumulatedTime + currentSessionSeconds;
    }

    console.log('[REVIEW TIMER] Reject - Total review duration (seconds):', reviewDuration);
    console.log('[REVIEW TIMER] Accumulated time:', accumulatedTime);
    console.log('[REVIEW TIMER] Current session:', isTimerActive ? 'active' : 'paused');

    try {
      await api.post(`/review/${id}/reject`, {
        reason: rejectionReason,
        reviewDuration
      });

      // Remove review session from localStorage as review is complete
      if (id) {
        removeReviewSession(id);
        console.log('[REVIEW TIMER] Session removed from localStorage after rejection');
      }

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

  const handlePublish = async () => {
    if (!id) return;

    setIsPublishing(true);
    try {
      const response = await api.post(`/review/${id}/publish`);
      if (response.data.success) {
        setIsPublished(true);
        enqueueSnackbar(`Published ${response.data.insertedCount} test results successfully`, { variant: 'success' });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to publish report';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setIsPublishing(false);
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

  const handleRevalidate = async () => {
    if (!id) return;

    setRevalidating(true);
    try {
      const response = await api.post(`/reports/${id}/revalidate`);

      if (response.data.success) {
        setReport(response.data.data);
        const flagCount = response.data.data.validationFlags?.length || 0;
        enqueueSnackbar(
          `Parameters re-validated successfully. ${flagCount} validation flag(s) found.`,
          { variant: 'success' }
        );
        console.log('[REVALIDATE] Validation summary:', response.data.validationSummary);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to re-validate parameters';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setRevalidating(false);
    }
  };

  const handleAddToParameterMaster = (parameter: TestResult, validationFlag: any) => {
    setSelectedParameter(parameter);
    setSelectedValidationFlag(validationFlag);
    // Reset dialog state
    setParameterAction('create');
    setTargetParameter(null);
    setNewParameterId('');
    setValueType('numeric');
    setParameterDescription('');
    setShowParameterMasterDialog(true);
  };

  const handleAddToExclusion = (parameter: TestResult, validationFlag: any) => {
    setSelectedParameter(parameter);
    setSelectedValidationFlag(validationFlag);
    setShowExclusionDialog(true);
  };

  const handleParameterMasterSubmit = async () => {
    if (!selectedParameter) return;

    setSubmittingSuggestion(true);
    try {
      const suggestionData: any = {
        action: parameterAction,
        suggestedParameter: selectedParameter.serviceItemName,
        suggestedUnit: selectedParameter.unit,
        validationFlag: selectedValidationFlag,
        reportId: report?._id
      };

      if (parameterAction === 'create') {
        // For creating new parameter
        if (!newParameterId.trim()) {
          enqueueSnackbar('Parameter ID is required', { variant: 'warning' });
          setSubmittingSuggestion(false);
          return;
        }

        suggestionData.newParameterData = {
          parameterId: newParameterId.trim().toUpperCase().replace(/\s+/g, '_'),
          parameterName: selectedParameter.serviceItemName,
          valueType: valueType,
          possibleUnits: selectedParameter.unit ? [selectedParameter.unit] : [],
          description: parameterDescription.trim()
        };
      } else if (parameterAction === 'update_alias') {
        // For adding as alias to existing parameter
        if (!targetParameter) {
          enqueueSnackbar('Please select a target parameter', { variant: 'warning' });
          setSubmittingSuggestion(false);
          return;
        }

        suggestionData.targetParameterId = targetParameter.parameterId;
        suggestionData.targetParameterName = targetParameter.parameterName;

        // If it's a unit mismatch, change action to update_unit
        if (selectedValidationFlag?.flagType === 'UNIT_MISMATCH' && selectedParameter.unit) {
          suggestionData.action = 'update_unit';
        }
      }

      const response = await api.post('/parameter-suggestions', suggestionData);

      if (response.data.success) {
        enqueueSnackbar('Parameter suggestion submitted for approval', { variant: 'success' });
        setShowParameterMasterDialog(false);
        // Optionally refresh report
        await fetchReport();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to submit parameter suggestion';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  const handleExclusionSubmit = async (data: any) => {
    try {
      const response = await api.post('/exclusions', {
        excludedParameter: data.parameterName,
        unit: data.unit || null,
        reason: data.reason,
        labName: report?.extractedData?.labName || null
      });

      if (response.data.success) {
        enqueueSnackbar('Parameter added to exclusion list successfully', { variant: 'success' });
        setShowExclusionDialog(false);
        // Refresh report to update validation flags
        await fetchReport();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to add parameter to exclusion list';
      enqueueSnackbar(errorMessage, { variant: 'error' });
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
        // Return '-' if the string is "null", otherwise return the actual value
        return parameter.referenceRange.referenceRange !== 'null' ? parameter.referenceRange.referenceRange : '-';
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

  // Helper function to find validation flag for a specific parameter and field
  const findValidationFlag = (parameterName: string, fieldName: string) => {
    return report?.validationFlags?.find(
      (flag) => flag.parameterName === parameterName && flag.field === fieldName
    ) || null;
  };

  // Helper function to render cell content based on column name
  const renderCellContent = (columnName: string, parameter: TestResult, isEditing: boolean, isAbnormal: boolean, indicator: any) => {
    switch (columnName) {
      case 'Parameter':
        const parameterFlag = findValidationFlag(parameter.serviceItemName, 'parameterName');
        return parameterFlag ? (
          <ValidationFlag flag={parameterFlag}>
            <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 600 : 400, color: '#111827', fontSize: '14px', px: 1 }}>
              {parameter.serviceItemName}
            </Typography>
          </ValidationFlag>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 600 : 400, color: '#111827', fontSize: '14px' }}>
            {parameter.serviceItemName}
          </Typography>
        );

      case 'Value':
        return isEditing ? (
          <ValidationFlag flag={findValidationFlag(parameter.serviceItemName, 'value')}>
            <TextField
              size="small"
              value={editedValues[`${parameter._id}_value`] || parameter.value}
              onChange={(e) => setEditedValues(prev => ({
                ...prev,
                [`${parameter._id}_value`]: e.target.value
              }))}
              sx={{ width: 100 }}
            />
          </ValidationFlag>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 600 : 400, color: '#111827', fontSize: '14px' }}>
              {parameter.value && parameter.value !== 'null' ? parameter.value : ''}
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
          <ValidationFlag flag={findValidationFlag(parameter.serviceItemName, 'unit')}>
            <TextField
              size="small"
              value={editedValues[`${parameter._id}_unit`] || parameter.unit}
              onChange={(e) => setEditedValues(prev => ({
                ...prev,
                [`${parameter._id}_unit`]: e.target.value
              }))}
              sx={{ width: 80 }}
            />
          </ValidationFlag>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: isAbnormal ? 500 : 400, color: '#6B7280', fontSize: '14px' }}>
            {parameter.unit && parameter.unit !== 'null' ? parameter.unit : ''}
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

  // Separate excluded and active parameters
  const excludedParams: TestResult[] = [];
  const activeParams: TestResult[] = [];

  currentPageResults.forEach((param: TestResult) => {
    const hasExclusionFlag = report?.validationFlags?.some(
      (flag: any) =>
        flag.parameterName === param.serviceItemName &&
        flag.isExcluded === true
    );

    if (hasExclusionFlag) {
      excludedParams.push(param);
    } else {
      activeParams.push(param);
    }
  });

  // Filter active parameters based on search term (excluded params don't appear in search)
  const filteredResults = activeParams.filter((param: TestResult) =>
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

  // Show success message with View JSON button if report is approved and not in repeat review mode
  if (report.status === 'approved' && !showRepeatReview && report.finalData) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: appTheme.colors.background,
        fontFamily: appTheme.typography.fontFamily,
        padding: `${appTheme.spacing.xl} ${appTheme.spacing['2xl']}`,
      }}>
        {/* Success Message Card */}
        <Card sx={{ maxWidth: 800, mx: 'auto', mb: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              Report Approved Successfully
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              The report has been approved and is ready for integration.
            </Typography>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<CodeIcon />}
                onClick={() => setShowJsonOutput(!showJsonOutput)}
              >
                {showJsonOutput ? 'Hide JSON' : 'View JSON'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/nurse/reports')}
              >
                Back to Reports
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowRepeatReview(true)}
              >
                Repeat Review
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={isPublishing ? <CircularProgress size={20} color="inherit" /> : <PublishIcon />}
                onClick={handlePublish}
                disabled={isPublishing || isPublished}
              >
                {isPublished ? 'Published' : isPublishing ? 'Publishing...' : 'Publish'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Conditionally Rendered JSON Output */}
        {showJsonOutput && (
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            <JsonOutputView
              jsonData={report.finalData}
              orderId={report.orderId}
              onRepeatReview={() => setShowRepeatReview(true)}
              onBack={() => navigate('/nurse/reports')}
            />
          </Box>
        )}
      </div>
    );
  }

  // Otherwise show the split-view for review/editing
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: appTheme.colors.background,
      fontFamily: appTheme.typography.fontFamily,
      padding: `${appTheme.spacing.xl} ${appTheme.spacing['2xl']}`,
    }}>
      {/* Header */}
      <div style={{ marginBottom: appTheme.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: appTheme.spacing.md }}>
          <div>
            <h1 style={{
              fontSize: appTheme.typography.sizes.heading,
              fontWeight: appTheme.typography.weights.semibold,
              color: appTheme.colors.textPrimary,
              margin: 0,
              marginBottom: appTheme.spacing.xs,
            }}>
              Review Lab Report
            </h1>
            <p style={{
              fontSize: appTheme.typography.sizes.body,
              color: appTheme.colors.textSecondary,
              margin: 0,
            }}>
              Review and approve the extracted data from the lab report
            </p>
          </div>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Tooltip title="View Edit History">
              <IconButton onClick={() => setShowHistory(true)} color="primary" size="small">
                <Badge badgeContent={report.editHistory?.length || 0} color="error">
                  <HistoryIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            <Chip
              label={report.status.toUpperCase()}
              size="small"
              sx={{
                height: 20,
                fontSize: '10px',
                fontWeight: 600,
                bgcolor: report.status === 'ready' ? '#FEF3C7' : report.status === 'approved' ? '#D1FAE5' : report.status === 'rejected' ? '#FEE2E2' : '#F3F4F6',
                color: report.status === 'ready' ? '#B45309' : report.status === 'approved' ? '#065F46' : report.status === 'rejected' ? '#991B1B' : '#6B7280',
                border: `1px solid ${report.status === 'ready' ? '#FCD34D' : report.status === 'approved' ? '#6EE7B7' : report.status === 'rejected' ? '#FECACA' : '#D1D5DB'}`
              }}
            />
          </Box>
        </div>

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
      </div>

      {/* Split View: PDF Viewer + Extracted Data */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Left Side: PDF Viewer */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ position: 'sticky', top: 16, height: 'calc(100vh - 150px)' }}>
            {(() => {
              // Extract filename from path (handle both Windows and Unix paths)
              const normalizedPath = report.pdfPath.replace(/\\/g, '/');
              const filename = normalizedPath.split('/').pop();
              const pdfUrl = `${BACKEND_BASE_URL}/uploads/${filename}`;

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
          <Grid container spacing={1.5} sx={{ mb: 2, alignItems: 'stretch' }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Tooltip
            title={report.orderId ? `Click to edit` : 'Required before approval'}
            placement="bottom"
            arrow
          >
          <Card sx={{
            bgcolor: !report.orderId ? '#FEF3C7' : 'white',
            border: !report.orderId ? '1px solid #F59E0B' : '1px solid #E5E7EB',
            borderRadius: 1.5,
            boxShadow: 'none',
            height: '100%',
            minHeight: 48,
            cursor: report.orderId ? 'pointer' : 'default',
            '&:hover': report.orderId ? { bgcolor: '#F9FAFB' } : {}
          }}
          onClick={() => {
            if (report.orderId && !editingOrderId) {
              setTempOrderId(report.orderId || '');
              setEditingOrderId(true);
            }
          }}
          >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5, display: 'flex', alignItems: 'center' }}>
                <ReportIcon sx={{ mr: 0.5, color: !report.orderId ? '#F59E0B' : '#4361EE', fontSize: 14 }} />
                Order ID {!report.orderId && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
              </Typography>
              {!report.orderId || editingOrderId ? (
                <Box onClick={(e) => e.stopPropagation()}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Enter Order ID"
                    value={editingOrderId ? tempOrderId : ''}
                    onChange={(e) => setTempOrderId(e.target.value)}
                    onFocus={() => setEditingOrderId(true)}
                    autoFocus={!report.orderId}
                    disabled={savingOrderId}
                    InputProps={{ sx: { fontSize: '12px', height: 28 } }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
                    <Button size="small" variant="contained" onClick={handleSaveOrderId} disabled={savingOrderId || !tempOrderId.trim()} sx={{ fontSize: '11px', py: 0.25, px: 1.5, textTransform: 'none' }}>
                      {savingOrderId ? 'Saving...' : 'Save'}
                    </Button>
                    {report.orderId && (
                      <Button size="small" variant="outlined" onClick={() => { setEditingOrderId(false); setTempOrderId(''); }} disabled={savingOrderId} sx={{ fontSize: '11px', py: 0.25, px: 1, textTransform: 'none' }}>
                        Cancel
                      </Button>
                    )}
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontWeight: 500, color: '#111827', wordBreak: 'break-all', fontSize: '13px', lineHeight: 1.3 }}>
                  {report.orderId}
                </Typography>
              )}
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>

        <Grid size={{ xs: 6, md: 2.5 }}>
          <Tooltip title={report.extractedData?.labAddress || 'No address'} placement="bottom" arrow>
          <Card sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 1.5,
            boxShadow: 'none',
            height: '100%',
            minHeight: 48
          }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5, display: 'flex', alignItems: 'center' }}>
                <LabIcon sx={{ mr: 0.5, color: '#8B5CF6', fontSize: 14 }} />
                Laboratory
              </Typography>
              <Typography sx={{ fontWeight: 500, color: '#111827', fontSize: '13px', lineHeight: 1.3 }}>
                {report.extractedData?.labName || 'Unknown Lab'}
              </Typography>
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>

        <Grid size={{ xs: 6, md: 4 }}>
          <Tooltip title={report.extractedData?.patientGender || 'Details not available'} placement="bottom" arrow>
          <Card sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 1.5,
            boxShadow: 'none',
            height: '100%',
            minHeight: 48
          }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5, display: 'flex', alignItems: 'center' }}>
                <PersonIcon sx={{ mr: 0.5, color: '#06B6D4', fontSize: 14 }} />
                Patient
              </Typography>
              <Typography sx={{ fontWeight: 500, color: '#111827', fontSize: '13px', lineHeight: 1.3 }}>
                {report.extractedData?.patientName || 'Not specified'}
              </Typography>
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>

        <Grid size={{ xs: 6, md: 2.5 }}>
          <Tooltip title={`${activeParams.length} parameters${excludedParams.length > 0 ? ` (${excludedParams.length} excluded)` : ''}`} placement="bottom" arrow>
          <Card sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 1.5,
            boxShadow: 'none',
            height: '100%',
            minHeight: 48
          }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5, display: 'flex', alignItems: 'center' }}>
                <FlagIcon sx={{ mr: 0.5, color: getFlagColor(), fontSize: 14 }} />
                Result
              </Typography>
              <Typography sx={{ fontWeight: 500, color: getFlagColor(), fontSize: '13px', lineHeight: 1.3 }}>
                {report.uiIndicators?.label || 'Normal'}
              </Typography>
            </CardContent>
          </Card>
          </Tooltip>
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
              <CardContent sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
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

        {/* Excluded Parameters CTA */}
        {excludedParams.length > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 2, bgcolor: '#FEF3C7', border: '1px solid #FBBF24' }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setShowExcludedParamsDialog(true)}
                sx={{ textDecoration: 'underline' }}
              >
                View ({excludedParams.length})
              </Button>
            }
          >
            <Typography variant="body2">
              {excludedParams.length} parameter{excludedParams.length !== 1 ? 's' : ''} excluded from validation
            </Typography>
          </Alert>
        )}

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
                    id={`parameter-${parameter.serviceItemName.replace(/\s+/g, '-')}`}
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
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* Check if this parameter has validation flags */}
                          {(() => {
                            const validationFlag = report?.validationFlags?.find(
                              flag => flag.parameterName === parameter.serviceItemName &&
                                     !flag.isExcluded // Don't show buttons for excluded parameters
                            );

                            if (validationFlag && (validationFlag.flagType === 'PARAMETER_NOT_FOUND' ||
                                                   validationFlag.flagType === 'UNIT_MISMATCH')) {
                              return (
                                <>
                                  <Tooltip title="Add to Parameter Master">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleAddToParameterMaster(parameter, validationFlag)}
                                      sx={{
                                        color: '#10B981',
                                        '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.08)' },
                                        width: 32,
                                        height: 32
                                      }}
                                    >
                                      <ParameterMasterIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Add to Exclusion List">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleAddToExclusion(parameter, validationFlag)}
                                      sx={{
                                        color: '#F59E0B',
                                        '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.08)' },
                                        width: 32,
                                        height: 32
                                      }}
                                    >
                                      <BlockIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              );
                            }
                            return null;
                          })()}

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
          <Tooltip title="Re-validate all parameters against Parameter Master database">
            <Button
              variant="outlined"
              startIcon={revalidating ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={handleRevalidate}
              disabled={revalidating || !report.extractedData}
              sx={{
                borderColor: '#3B82F6',
                color: '#3B82F6',
                '&:hover': {
                  borderColor: '#2563EB',
                  bgcolor: 'rgba(59, 130, 246, 0.04)'
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
              {revalidating ? 'Re-validating...' : 'Re-validate Parameters'}
            </Button>
          </Tooltip>
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

              {/* Patient Age */}
              <Card sx={{ mb: 2, border: `1px solid ${
                validationWarnings.some(w => w.field === 'patientAge') ? '#FCD34D' : '#D1FAE5'
              }`, bgcolor: validationWarnings.some(w => w.field === 'patientAge') ? '#FFFBEB' : '#F0FDF4' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Patient Age
                    </Typography>
                    {validationWarnings.some(w => w.field === 'patientAge') ? (
                      <Chip icon={<CloseIcon />} label="Mismatch" color="warning" size="small" />
                    ) : (
                      <Chip icon={<CheckIcon />} label="Match" color="success" size="small" />
                    )}
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Observation Data:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {orderData?.patient_age || 'Not specified'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">LLM Extracted:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {reportData?.patientAge || 'Not specified'}
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
                      <Typography variant="caption" color="text.secondary">Observation Data:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {orderData?.gender || orderData?.patient_gender || 'Not specified'}
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

      {/* Add to Parameter Master Dialog */}
      <Dialog
        open={showParameterMasterDialog}
        onClose={() => !submittingSuggestion && setShowParameterMasterDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#E0F2FE', borderBottom: '2px solid #0284C7' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ParameterMasterIcon sx={{ mr: 1, color: '#0284C7' }} />
            Add to Parameter Master
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ mb: 2, p: 2, bgcolor: '#F9FAFB', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Current Parameter:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {selectedParameter?.serviceItemName}
            </Typography>
            {selectedParameter?.unit && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Unit:</Typography>
                <Typography variant="body1">{selectedParameter.unit}</Typography>
              </>
            )}
          </Box>

          {/* Action Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              Choose Action:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant={parameterAction === 'create' ? 'contained' : 'outlined'}
                onClick={() => {
                  setParameterAction('create');
                  setTargetParameter(null);
                }}
                sx={{ flex: 1 }}
              >
                Create New Parameter
              </Button>
              <Button
                variant={parameterAction === 'update_alias' ? 'contained' : 'outlined'}
                onClick={() => {
                  setParameterAction('update_alias');
                  setNewParameterId('');
                  setValueType('numeric');
                  setParameterDescription('');
                }}
                sx={{ flex: 1 }}
              >
                Add as Alias to Existing
              </Button>
            </Box>
          </Box>

          {/* Create New Parameter Form */}
          {parameterAction === 'create' && (
            <Box>
              <TextField
                fullWidth
                label="Parameter ID (Key)"
                placeholder="e.g., HEMOGLOBIN, WBC_COUNT"
                value={newParameterId}
                onChange={(e) => setNewParameterId(e.target.value.toUpperCase())}
                required
                sx={{ mb: 2 }}
                helperText="Unique identifier for the parameter (uppercase, no spaces)"
              />

              <TextField
                select
                fullWidth
                label="Value Type"
                value={valueType}
                onChange={(e) => setValueType(e.target.value as any)}
                required
                SelectProps={{ native: true }}
                sx={{ mb: 2 }}
              >
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
                <option value="alphanumeric">Alphanumeric</option>
                <option value="range">Range</option>
              </TextField>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                placeholder="Brief description of the parameter"
                value={parameterDescription}
                onChange={(e) => setParameterDescription(e.target.value)}
                sx={{ mb: 2 }}
              />

              {selectedParameter?.unit && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    The unit "{selectedParameter.unit}" will be added as a possible unit for this parameter.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Add as Alias Form */}
          {parameterAction === 'update_alias' && (
            <Box>
              <ParameterSearchField
                value={targetParameter}
                onChange={setTargetParameter}
                label="Search and Select Target Parameter"
                placeholder="Type to search existing parameters..."
                required
                helperText="Select the parameter to which this will be added as an alias"
              />

              {targetParameter && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#F0F9FF', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="primary">Selected Parameter:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {targetParameter.parameterName} ({targetParameter.parameterId})
                  </Typography>
                  {targetParameter.aliases?.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Current aliases: {targetParameter.aliases.join(', ')}
                    </Typography>
                  )}
                  {selectedValidationFlag?.flagType === 'UNIT_MISMATCH' && selectedParameter?.unit && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        The unit "{selectedParameter.unit}" will also be added to this parameter's possible units.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          )}

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Your suggestion will be queued for admin approval. Once approved, it will be automatically applied to the Parameter Master.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowParameterMasterDialog(false)}
            disabled={submittingSuggestion}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleParameterMasterSubmit}
            disabled={
              submittingSuggestion ||
              (parameterAction === 'create' && !newParameterId.trim()) ||
              (parameterAction === 'update_alias' && !targetParameter)
            }
            startIcon={submittingSuggestion ? <CircularProgress size={16} /> : <AddIcon />}
            sx={{ bgcolor: '#0284C7', '&:hover': { bgcolor: '#0369A1' } }}
          >
            {submittingSuggestion ? 'Submitting...' : 'Submit Suggestion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Exclusion List Dialog */}
      <Dialog
        open={showExclusionDialog}
        onClose={() => setShowExclusionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#FEF3C7', borderBottom: '2px solid #F59E0B' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BlockIcon sx={{ mr: 1, color: '#F59E0B' }} />
            Add to Exclusion List
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Add this parameter to the exclusion list to skip validation for future reports.
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#F9FAFB', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Parameter Name:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {selectedParameter?.serviceItemName}
            </Typography>
            {selectedValidationFlag?.flagType === 'UNIT_MISMATCH' && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Unit:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedParameter?.unit || '-'}
                </Typography>
              </>
            )}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Lab:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {report?.extractedData?.labName || 'All Labs'}
            </Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for Exclusion"
            placeholder="Enter the reason for excluding this parameter..."
            sx={{ mt: 2 }}
            onChange={(e) => setMismatchReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExclusionDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<BlockIcon />}
            onClick={() => handleExclusionSubmit({
              parameterName: selectedParameter?.serviceItemName,
              unit: selectedValidationFlag?.flagType === 'UNIT_MISMATCH' ? selectedParameter?.unit : null,
              reason: mismatchReason
            })}
            disabled={!mismatchReason.trim()}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            Add to Exclusion List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Excluded Parameters Dialog */}
      <Dialog
        open={showExcludedParamsDialog}
        onClose={() => setShowExcludedParamsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BlockIcon sx={{ mr: 1, color: '#6B7280' }} />
            Excluded Parameters
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These parameters are excluded from validation and do not appear in the main review table.
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Parameter</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Exclusion Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {excludedParams.map((param: TestResult, idx: number) => {
                  const flag = report?.validationFlags?.find(
                    (f: any) =>
                      f.parameterName === param.serviceItemName &&
                      f.isExcluded === true
                  );
                  return (
                    <TableRow key={idx}>
                      <TableCell>{param.serviceItemName}</TableCell>
                      <TableCell>{param.value}</TableCell>
                      <TableCell>{param.unit}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {flag?.exclusionReason || 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExcludedParamsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

    </div>
  );
};

export default ReviewReport;