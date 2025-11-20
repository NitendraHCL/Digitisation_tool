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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Search as SearchIcon,
  Block as BlockIcon,
  FileUpload as UploadIcon,
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
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

  useEffect(() => {
    fetchExclusions();
    fetchStats();
  }, [page, rowsPerPage, searchTerm]);

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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
        >
          Add Exclusion
        </Button>
      </Box>

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
    </Box>
  );
};

export default ExclusionMasterManagement;