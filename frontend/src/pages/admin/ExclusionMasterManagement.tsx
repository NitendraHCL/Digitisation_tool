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
  TablePagination,
  Button,
  TextField,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Search as SearchIcon,
  Block as BlockIcon,
  FileUpload as UploadIcon,
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Lightbulb as SuggestionIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Pending as PendingIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

interface Exclusion {
  _id: string;
  excludedParameter: string;
  unit?: string | null;
  labName?: string | null;
  reason: string;
  isActive: boolean;
  excludedBy: {
    _id: string;
    name: string;
    email: string;
  };
  excludedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ExclusionFormData {
  excludedParameter: string;
  unit: string;
  labName: string;
  reason: string;
}

interface ExclusionSuggestion {
  _id: string;
  suggestedParameter: string;
  suggestedUnit?: string | null;
  suggestedLabName?: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedBy: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

const ExclusionMasterManagement: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExclusion, setSelectedExclusion] = useState<Exclusion | null>(null);
  const [formData, setFormData] = useState<ExclusionFormData>({
    excludedParameter: '',
    unit: '',
    labName: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    parameterOnly: 0,
    unitSpecific: 0,
    labSpecific: 0,
  });

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<ExclusionSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ExclusionSuggestion | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [suggestionStats, setSuggestionStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Fetch exclusions
  const fetchExclusions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/exclusions', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchTerm,
        },
      });

      if (response.data.success) {
        setExclusions(response.data.data);
        setTotalCount(response.data.pagination.total);
      }
    } catch (error: any) {
      enqueueSnackbar('Failed to fetch exclusions', { variant: 'error' });
      console.error('Failed to fetch exclusions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch exclusion statistics
  const fetchStats = async () => {
    try {
      const response = await api.get('/exclusions/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Fetch exclusion suggestions
  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const [suggestionsRes, statsRes] = await Promise.all([
        api.get('/exclusion-suggestions', {
          params: {
            status: suggestionStatusFilter === 'all' ? undefined : suggestionStatusFilter
          }
        }),
        api.get('/exclusion-suggestions/stats')
      ]);

      if (suggestionsRes.data.success) {
        setSuggestions(suggestionsRes.data.data);
      }
      if (statsRes.data.success) {
        const statsData = statsRes.data.data;
        setPendingSuggestionsCount(statsData.pending);
        setSuggestionStats({
          pending: statsData.pending || 0,
          approved: statsData.approved || 0,
          rejected: statsData.rejected || 0,
          total: statsData.total || 0,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Helper functions for status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Approve an exclusion suggestion
  const handleApproveSuggestion = async (suggestion: ExclusionSuggestion) => {
    try {
      const response = await api.post(`/exclusion-suggestions/${suggestion._id}/approve`);
      if (response.data.success) {
        enqueueSnackbar('Suggestion approved and exclusion created', { variant: 'success' });
        fetchSuggestions();
        fetchExclusions();
        fetchStats();
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to approve suggestion';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Open reject dialog
  const handleOpenRejectDialog = (suggestion: ExclusionSuggestion) => {
    setSelectedSuggestion(suggestion);
    setRejectReason('');
    setShowRejectDialog(true);
  };

  // Reject an exclusion suggestion
  const handleRejectSuggestion = async () => {
    if (!selectedSuggestion || !rejectReason.trim()) {
      enqueueSnackbar('Rejection reason is required', { variant: 'warning' });
      return;
    }

    try {
      const response = await api.post(`/exclusion-suggestions/${selectedSuggestion._id}/reject`, {
        reason: rejectReason.trim()
      });
      if (response.data.success) {
        enqueueSnackbar('Suggestion rejected', { variant: 'success' });
        setShowRejectDialog(false);
        setSelectedSuggestion(null);
        setRejectReason('');
        fetchSuggestions();
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reject suggestion';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchExclusions();
    fetchStats();
    fetchSuggestions();
  }, [page, rowsPerPage, searchTerm, suggestionStatusFilter]);

  // Handle search
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle add
  const handleAdd = () => {
    setFormData({
      excludedParameter: '',
      unit: '',
      labName: '',
      reason: '',
    });
    setShowAddDialog(true);
  };

  // Handle edit
  const handleEdit = (exclusion: Exclusion) => {
    setSelectedExclusion(exclusion);
    setFormData({
      excludedParameter: exclusion.excludedParameter,
      unit: exclusion.unit || '',
      labName: exclusion.labName || '',
      reason: exclusion.reason,
    });
    setShowEditDialog(true);
  };

  // Handle delete
  const handleDelete = (exclusion: Exclusion) => {
    setSelectedExclusion(exclusion);
    setShowDeleteDialog(true);
  };

  // Handle restore
  const handleRestore = async (exclusion: Exclusion) => {
    try {
      const response = await api.patch(`/exclusions/${exclusion._id}/restore`);

      if (response.data.success) {
        enqueueSnackbar('Exclusion restored successfully', { variant: 'success' });
        fetchExclusions();
        fetchStats();
      }
    } catch (error: any) {
      enqueueSnackbar('Failed to restore exclusion', { variant: 'error' });
    }
  };

  // Save exclusion (add or update)
  const handleSave = async () => {
    if (!formData.excludedParameter.trim() || !formData.reason.trim()) {
      enqueueSnackbar('Parameter name and reason are required', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        excludedParameter: formData.excludedParameter.trim(),
        unit: formData.unit.trim() || null,
        labName: formData.labName.trim() || null,
        reason: formData.reason.trim(),
      };

      if (showAddDialog) {
        const response = await api.post('/exclusions', payload);
        if (response.data.success) {
          enqueueSnackbar('Exclusion added successfully', { variant: 'success' });
        }
      }

      setShowAddDialog(false);
      setShowEditDialog(false);
      fetchExclusions();
      fetchStats();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to save exclusion';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!selectedExclusion) return;

    setSaving(true);
    try {
      const response = await api.delete(`/exclusions/${selectedExclusion._id}`);

      if (response.data.success) {
        enqueueSnackbar('Exclusion permanently deleted', { variant: 'success' });
        setShowDeleteDialog(false);
        fetchExclusions();
        fetchStats();
      }
    } catch (error: any) {
      enqueueSnackbar('Failed to remove exclusion', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Bulk import from CSV
  const handleBulkImport = () => {
    enqueueSnackbar('Bulk import feature coming soon', { variant: 'info' });
  };

  // Export to CSV
  const handleExport = () => {
    enqueueSnackbar('Export feature coming soon', { variant: 'info' });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827' }}>
            Exclusion Master Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 1 }}>
            Manage parameters excluded from validation
          </Typography>
        </Box>
        {activeTab === 0 && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            Add Exclusion
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Exclusions" />
          <Tab
            label={
              <Badge badgeContent={pendingSuggestionsCount} color="error">
                Suggestions
              </Badge>
            }
          />
        </Tabs>
      </Box>

      {/* Tab Panel 0: Exclusions */}
      {activeTab === 0 && (
        <>
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BlockIcon sx={{ color: '#F59E0B', mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Exclusions
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BlockIcon sx={{ color: '#3B82F6', mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Parameter Only
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {stats.parameterOnly}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BlockIcon sx={{ color: '#10B981', mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Unit Specific
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {stats.unitSpecific}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BlockIcon sx={{ color: '#8B5CF6', mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Lab Specific
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {stats.labSpecific}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <TextField
            placeholder="Search by parameter name, unit, or reason..."
            value={searchTerm}
            onChange={handleSearch}
            size="small"
            sx={{ flexGrow: 1, maxWidth: 400 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<UploadIcon />}
              onClick={handleBulkImport}
              sx={{ textTransform: 'none' }}
            >
              Import CSV
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              sx={{ textTransform: 'none' }}
            >
              Export CSV
            </Button>
            <IconButton onClick={fetchExclusions} title="Refresh">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Table */}
      <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 600 }}>Parameter Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Lab</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Excluded By</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : exclusions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No exclusions found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                exclusions.map((exclusion) => (
                  <TableRow key={exclusion._id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {exclusion.excludedParameter}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={exclusion.unit ? 'text.primary' : 'text.secondary'}>
                        {exclusion.unit || 'All units'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={exclusion.labName ? 'text.primary' : 'text.secondary'}>
                        {exclusion.labName || 'All labs'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={exclusion.reason}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {exclusion.reason}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {exclusion.excludedBy?.name || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {exclusion.excludedBy?.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(exclusion.excludedAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(exclusion.excludedAt).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {exclusion.isActive ? (
                        <Chip
                          icon={<ActiveIcon sx={{ fontSize: 16 }} />}
                          label="Active"
                          size="small"
                          sx={{
                            bgcolor: '#D1FAE5',
                            color: '#065F46',
                            fontWeight: 500,
                          }}
                        />
                      ) : (
                        <Chip
                          icon={<InactiveIcon sx={{ fontSize: 16 }} />}
                          label="Inactive"
                          size="small"
                          sx={{
                            bgcolor: '#FEE2E2',
                            color: '#991B1B',
                            fontWeight: 500,
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {exclusion.isActive ? (
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(exclusion)}
                            title="Remove exclusion"
                            sx={{ color: '#EF4444' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            onClick={() => handleRestore(exclusion)}
                            title="Restore exclusion"
                            sx={{ color: '#10B981' }}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 20, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      </>
      )}

      {/* Tab Panel 1: Exclusion Suggestions */}
      {activeTab === 1 && (
        <>
          {/* Suggestion Stats */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PendingIcon sx={{ mr: 1.5, color: '#F59E0B', fontSize: 28 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{suggestionStats.pending}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending Review</Typography>
                </Box>
              </Box>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ApproveIcon sx={{ mr: 1.5, color: '#10B981', fontSize: 28 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{suggestionStats.approved}</Typography>
                  <Typography variant="body2" color="text.secondary">Approved</Typography>
                </Box>
              </Box>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <RejectIcon sx={{ mr: 1.5, color: '#EF4444', fontSize: 28 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{suggestionStats.rejected}</Typography>
                  <Typography variant="body2" color="text.secondary">Rejected</Typography>
                </Box>
              </Box>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <InfoIcon sx={{ mr: 1.5, color: '#6366F1', fontSize: 28 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{suggestionStats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">Total</Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

        {/* Status Filter */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Filter by Status:
            </Typography>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <Chip
                key={status}
                label={status === 'all' ? 'All' : getStatusLabel(status)}
                onClick={() => setSuggestionStatusFilter(status)}
                color={suggestionStatusFilter === status ? (status === 'all' ? 'primary' : getStatusColor(status) as any) : 'default'}
                variant={suggestionStatusFilter === status ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SuggestionIcon sx={{ color: '#F59E0B', mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Exclusion Suggestions
              </Typography>
            </Box>
            <IconButton onClick={fetchSuggestions} title="Refresh">
              <RefreshIcon />
            </IconButton>
          </Box>

          {suggestionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : suggestions.length === 0 ? (
            <Alert severity="info">
              {suggestionStatusFilter === 'all'
                ? 'No suggestions found.'
                : `No ${suggestionStatusFilter} suggestions found.`}
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Parameter</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Lab</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Suggested By</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suggestions.map((suggestion) => (
                    <TableRow key={suggestion._id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {suggestion.suggestedParameter}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={suggestion.suggestedUnit ? 'text.primary' : 'text.secondary'}>
                          {suggestion.suggestedUnit || 'All units'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={suggestion.suggestedLabName ? 'text.primary' : 'text.secondary'}>
                          {suggestion.suggestedLabName || 'All labs'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={suggestion.reason}>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {suggestion.reason}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {suggestion.suggestedBy?.name || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {suggestion.suggestedBy?.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(suggestion.createdAt).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(suggestion.createdAt).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(suggestion.status)}
                          size="small"
                          color={getStatusColor(suggestion.status) as any}
                        />
                        {suggestion.reviewNotes && (
                          <Tooltip title={suggestion.reviewNotes}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, cursor: 'help' }}>
                              {suggestion.reviewNotes.length > 30 ? suggestion.reviewNotes.substring(0, 30) + '...' : suggestion.reviewNotes}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {suggestion.status === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Tooltip title="Approve and add to exclusion list">
                              <IconButton
                                size="small"
                                onClick={() => handleApproveSuggestion(suggestion)}
                                sx={{ color: '#10B981' }}
                              >
                                <ApproveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject suggestion">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenRejectDialog(suggestion)}
                                sx={{ color: '#EF4444' }}
                              >
                                <RejectIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {suggestion.reviewedBy?.name ? `By ${suggestion.reviewedBy.name}` : '-'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        </>
      )}

      {/* Add Exclusion Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => !saving && setShowAddDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#FEF3C7', borderBottom: '2px solid #F59E0B' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BlockIcon sx={{ mr: 1, color: '#F59E0B' }} />
            Add New Exclusion
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Parameter Name"
            placeholder="Enter parameter name to exclude"
            value={formData.excludedParameter}
            onChange={(e) => setFormData({ ...formData, excludedParameter: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Unit (Optional)"
            placeholder="Leave empty to exclude for all units"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Lab Name (Optional)"
            placeholder="Leave empty to exclude for all labs"
            value={formData.labName}
            onChange={(e) => setFormData({ ...formData, labName: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason"
            placeholder="Enter the reason for exclusion"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            required
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              • Leave Unit empty to exclude parameter regardless of unit
              <br />
              • Leave Lab Name empty to apply exclusion to all labs
              <br />
              • Be specific with the reason for future reference
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.excludedParameter.trim() || !formData.reason.trim()}
            startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            {saving ? 'Adding...' : 'Add Exclusion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => !saving && setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Exclusion</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">
              Warning: This will permanently delete the exclusion. This action cannot be undone.
            </Typography>
          </Alert>
          <Typography variant="body2">
            Are you sure you want to permanently delete this exclusion?
          </Typography>
          {selectedExclusion && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#F9FAFB', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Parameter:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {selectedExclusion.excludedParameter}
              </Typography>
              {selectedExclusion.unit && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Unit:</Typography>
                  <Typography variant="body1">{selectedExclusion.unit}</Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {saving ? 'Removing...' : 'Remove Exclusion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Suggestion Dialog */}
      <Dialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#FEE2E2', borderBottom: '2px solid #EF4444' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <RejectIcon sx={{ mr: 1, color: '#EF4444' }} />
            Reject Exclusion Suggestion
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedSuggestion && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#F9FAFB', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Suggested Parameter:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {selectedSuggestion.suggestedParameter}
              </Typography>
              {selectedSuggestion.suggestedUnit && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Unit:</Typography>
                  <Typography variant="body1">{selectedSuggestion.suggestedUnit}</Typography>
                </>
              )}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Reason for suggestion:</Typography>
              <Typography variant="body2">{selectedSuggestion.reason}</Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="Please provide a reason for rejecting this suggestion"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRejectDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectSuggestion}
            disabled={!rejectReason.trim()}
            startIcon={<RejectIcon />}
          >
            Reject Suggestion
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExclusionMasterManagement;