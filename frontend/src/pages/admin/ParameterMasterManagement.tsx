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
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Pending as PendingIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from 'notistack';

interface Parameter {
  _id: string;
  parameterId: string;
  parameterName: string;
  aliases: string[];
  possibleUnits: string[];
  valueType: 'numeric' | 'text' | 'alphanumeric' | 'range';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ParameterSuggestion {
  _id: string;
  action: 'create' | 'update_alias' | 'update_unit';
  suggestedParameter: string;
  suggestedUnit?: string;
  newParameterData?: {
    parameterId: string;
    parameterName: string;
    valueType: string;
    possibleUnits: string[];
    description?: string;
  };
  targetParameterId?: string;
  targetParameterName?: string;
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
  };
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const ParameterMasterManagement: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Parameters state
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [valueTypeFilter, setValueTypeFilter] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState<ParameterSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsTotalPages, setSuggestionsTotalPages] = useState(1);
  const [suggestionStats, setSuggestionStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [selectedSuggestion, setSelectedSuggestion] = useState<ParameterSuggestion | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParameter, setEditingParameter] = useState<Parameter | null>(null);
  const [formData, setFormData] = useState({
    parameterName: '',
    aliases: '',
    possibleUnits: '',
    valueType: 'numeric' as 'numeric' | 'text' | 'alphanumeric' | 'range',
    description: '',
  });

  useEffect(() => {
    if (activeTab === 0) {
      fetchParameters();
    } else {
      fetchSuggestions();
      fetchSuggestionStats();
    }
  }, [activeTab, page, suggestionsPage, searchTerm, valueTypeFilter]);

  const fetchParameters = async () => {
    try {
      setLoading(true);
      const response = await api.get('/parameter-master', {
        params: {
          page,
          limit: 20,
          search: searchTerm,
          valueType: valueTypeFilter || undefined,
        },
      });

      setParameters(response.data.data);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      enqueueSnackbar('Failed to fetch parameters', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (parameter?: Parameter) => {
    if (parameter) {
      setEditingParameter(parameter);
      setFormData({
        parameterName: parameter.parameterName,
        aliases: parameter.aliases.join(', '),
        possibleUnits: parameter.possibleUnits.join(', '),
        valueType: parameter.valueType,
        description: parameter.description || '',
      });
    } else {
      setEditingParameter(null);
      setFormData({
        parameterName: '',
        aliases: '',
        possibleUnits: '',
        valueType: 'numeric',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingParameter(null);
  };

  const handleSave = async () => {
    try {
      const payload = {
        parameterName: formData.parameterName,
        aliases: formData.aliases.split(',').map(a => a.trim()).filter(a => a),
        possibleUnits: formData.possibleUnits.split(',').map(u => u.trim()).filter(u => u),
        valueType: formData.valueType,
        description: formData.description,
      };

      if (editingParameter) {
        await api.put(`/parameter-master/${editingParameter._id}`, payload);
        enqueueSnackbar('Parameter updated successfully', { variant: 'success' });
      } else {
        await api.post('/parameter-master', payload);
        enqueueSnackbar('Parameter created successfully', { variant: 'success' });
      }

      handleCloseDialog();
      fetchParameters();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || 'Failed to save parameter', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await api.delete(`/parameter-master/${id}`);
      enqueueSnackbar('Parameter deleted successfully', { variant: 'success' });
      fetchParameters();
    } catch (error) {
      enqueueSnackbar('Failed to delete parameter', { variant: 'error' });
    }
  };

  const getValueTypeColor = (valueType: string) => {
    const colors: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
      numeric: 'primary',
      text: 'success',
      alphanumeric: 'info',
      range: 'warning',
    };
    return colors[valueType] || 'default';
  };

  // Suggestions functions
  const fetchSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const response = await api.get('/parameter-suggestions', {
        params: {
          page: suggestionsPage,
          limit: 20,
          status: 'pending' // Focus on pending suggestions for admin review
        }
      });

      if (response.data.success) {
        setSuggestions(response.data.data);
        setSuggestionsTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      enqueueSnackbar('Failed to fetch suggestions', { variant: 'error' });
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const fetchSuggestionStats = async () => {
    try {
      const response = await api.get('/parameter-suggestions/stats');
      if (response.data.success) {
        setSuggestionStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch suggestion stats:', error);
    }
  };

  const handleReviewSuggestion = (suggestion: ParameterSuggestion) => {
    setSelectedSuggestion(suggestion);
    setReviewNotes('');
    setRejectionReason('');
    setReviewDialogOpen(true);
  };

  const handleApproveSuggestion = async () => {
    if (!selectedSuggestion) return;

    try {
      const response = await api.post(`/parameter-suggestions/${selectedSuggestion._id}/approve`, {
        notes: reviewNotes
      });

      if (response.data.success) {
        enqueueSnackbar('Suggestion approved and applied successfully', { variant: 'success' });
        setReviewDialogOpen(false);
        fetchSuggestions();
        fetchSuggestionStats();
        fetchParameters(); // Refresh parameters as well
      }
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || 'Failed to approve suggestion', { variant: 'error' });
    }
  };

  const handleRejectSuggestion = async () => {
    if (!selectedSuggestion || !rejectionReason.trim()) {
      enqueueSnackbar('Please provide a rejection reason', { variant: 'warning' });
      return;
    }

    try {
      const response = await api.post(`/parameter-suggestions/${selectedSuggestion._id}/reject`, {
        reason: rejectionReason
      });

      if (response.data.success) {
        enqueueSnackbar('Suggestion rejected', { variant: 'info' });
        setReviewDialogOpen(false);
        fetchSuggestions();
        fetchSuggestionStats();
      }
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || 'Failed to reject suggestion', { variant: 'error' });
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return 'Create New';
      case 'update_alias':
        return 'Add Alias';
      case 'update_unit':
        return 'Add Unit';
      default:
        return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'success';
      case 'update_alias':
        return 'info';
      case 'update_unit':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Parameter Master
        </Typography>
        {activeTab === 0 && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Add Parameter
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Parameters" />
          <Tab
            label={
              <Badge badgeContent={suggestionStats.pending} color="error">
                Suggestions
              </Badge>
            }
          />
        </Tabs>
      </Box>

      {/* Tab Panel 1: Parameters */}
      {activeTab === 0 && (
        <>
          {/* Filters */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                placeholder="Search by name or alias..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                size="small"
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Value Type</InputLabel>
                <Select
                  value={valueTypeFilter}
                  label="Value Type"
                  onChange={(e) => {
                    setValueTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="numeric">Numeric</MenuItem>
                  <MenuItem value="text">Text</MenuItem>
                  <MenuItem value="alphanumeric">Alphanumeric</MenuItem>
                  <MenuItem value="range">Range</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {/* Table */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  PARAMETER NAME
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  PARAMETER ID
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  ALIASES
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  POSSIBLE UNITS
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  VALUE TYPE
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  DESCRIPTION
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parameters.map((param) => (
                <TableRow key={param._id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {param.parameterName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {param.parameterId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {param.aliases.slice(0, 3).map((alias, idx) => (
                        <Chip key={idx} label={alias} size="small" variant="outlined" />
                      ))}
                      {param.aliases.length > 3 && (
                        <Tooltip title={param.aliases.slice(3).join(', ')}>
                          <Chip label={`+${param.aliases.length - 3}`} size="small" variant="outlined" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {param.possibleUnits.length > 0 ? (
                        param.possibleUnits.map((unit, idx) => (
                          <Chip key={idx} label={unit} size="small" color="primary" variant="outlined" />
                        ))
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No unit
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={param.valueType} size="small" color={getValueTypeColor(param.valueType)} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                      {param.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(param)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(param._id, param.parameterName)}
                          color="error"
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

        {/* Pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Pagination count={totalPages} page={page} onChange={(e, newPage) => setPage(newPage)} shape="rounded" />
        </Box>
      </Paper>
        </>
      )}

      {/* Tab Panel 2: Suggestions */}
      {activeTab === 1 && (
        <>
          {/* Statistics */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PendingIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Box>
                  <Typography variant="h4">{suggestionStats.pending}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending Review</Typography>
                </Box>
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ApproveIcon sx={{ mr: 1, color: 'success.main' }} />
                <Box>
                  <Typography variant="h4">{suggestionStats.approved}</Typography>
                  <Typography variant="body2" color="text.secondary">Approved</Typography>
                </Box>
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <RejectIcon sx={{ mr: 1, color: 'error.main' }} />
                <Box>
                  <Typography variant="h4">{suggestionStats.rejected}</Typography>
                  <Typography variant="body2" color="text.secondary">Rejected</Typography>
                </Box>
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <InfoIcon sx={{ mr: 1, color: 'info.main' }} />
                <Box>
                  <Typography variant="h4">{suggestionStats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">Total</Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Suggestions Table */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {suggestionsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : suggestions.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No pending suggestions
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'background.default' }}>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                          ACTION
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                          SUGGESTED PARAMETER
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                          DETAILS
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                          SUGGESTED BY
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                          DATE
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                          ACTIONS
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {suggestions.map((suggestion) => (
                        <TableRow key={suggestion._id} hover>
                          <TableCell>
                            <Chip
                              label={getActionLabel(suggestion.action)}
                              size="small"
                              color={getActionColor(suggestion.action) as any}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {suggestion.suggestedParameter}
                            </Typography>
                            {suggestion.suggestedUnit && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Unit: {suggestion.suggestedUnit}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {suggestion.action === 'create' && suggestion.newParameterData && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {suggestion.newParameterData.parameterId}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  Type: {suggestion.newParameterData.valueType}
                                </Typography>
                              </Box>
                            )}
                            {(suggestion.action === 'update_alias' || suggestion.action === 'update_unit') && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Target: {suggestion.targetParameterName}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  ID: {suggestion.targetParameterId}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{suggestion.suggestedBy.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {suggestion.suggestedBy.email}
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
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleReviewSuggestion(suggestion)}
                              sx={{ textTransform: 'none' }}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination */}
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Pagination
                    count={suggestionsTotalPages}
                    page={suggestionsPage}
                    onChange={(e, newPage) => setSuggestionsPage(newPage)}
                    shape="rounded"
                  />
                </Box>
              </>
            )}
          </Paper>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{editingParameter ? 'Edit Parameter' : 'Add Parameter'}</Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editingParameter && (
              <TextField
                label="Parameter ID"
                value={editingParameter.parameterId}
                fullWidth
                disabled
                helperText="Auto-generated from parameter name (read-only)"
                InputProps={{
                  sx: {
                    fontFamily: 'monospace',
                    bgcolor: 'action.disabledBackground',
                  },
                }}
              />
            )}
            <TextField
              label="Parameter Name"
              value={formData.parameterName}
              onChange={(e) => setFormData({ ...formData, parameterName: e.target.value })}
              fullWidth
              required
              helperText="Canonical name (e.g., HbA1c, Hemoglobin)"
            />
            <TextField
              label="Aliases"
              value={formData.aliases}
              onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="Comma-separated alternative names (e.g., HBA1C, Glycated Hemoglobin)"
            />
            <TextField
              label="Possible Units"
              value={formData.possibleUnits}
              onChange={(e) => setFormData({ ...formData, possibleUnits: e.target.value })}
              fullWidth
              helperText="Comma-separated units (e.g., %, mmol/mol). Leave empty if no unit."
            />
            <FormControl fullWidth required>
              <InputLabel>Value Type</InputLabel>
              <Select
                value={formData.valueType}
                label="Value Type"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    valueType: e.target.value as 'numeric' | 'text' | 'alphanumeric' | 'range',
                  })
                }
              >
                <MenuItem value="numeric">Numeric</MenuItem>
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="alphanumeric">Alphanumeric</MenuItem>
                <MenuItem value="range">Range</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="Brief description of what this parameter measures"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.parameterName || !formData.valueType}>
            {editingParameter ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review Suggestion Dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Review Suggestion</Typography>
          <IconButton onClick={() => setReviewDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedSuggestion && (
            <Stack spacing={3}>
              {/* Suggestion Details */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Action Type
                </Typography>
                <Chip
                  label={getActionLabel(selectedSuggestion.action)}
                  color={getActionColor(selectedSuggestion.action) as any}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Suggested Parameter
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedSuggestion.suggestedParameter}
                </Typography>
                {selectedSuggestion.suggestedUnit && (
                  <Typography variant="body2" color="text.secondary">
                    Unit: {selectedSuggestion.suggestedUnit}
                  </Typography>
                )}
              </Box>

              {/* Show details based on action type */}
              {selectedSuggestion.action === 'create' && selectedSuggestion.newParameterData && (
                <Alert severity="info">
                  <Typography variant="body2" gutterBottom>
                    <strong>New Parameter Details:</strong>
                  </Typography>
                  <Typography variant="body2">
                    • ID: {selectedSuggestion.newParameterData.parameterId}
                  </Typography>
                  <Typography variant="body2">
                    • Name: {selectedSuggestion.newParameterData.parameterName}
                  </Typography>
                  <Typography variant="body2">
                    • Type: {selectedSuggestion.newParameterData.valueType}
                  </Typography>
                  {selectedSuggestion.newParameterData.possibleUnits.length > 0 && (
                    <Typography variant="body2">
                      • Units: {selectedSuggestion.newParameterData.possibleUnits.join(', ')}
                    </Typography>
                  )}
                  {selectedSuggestion.newParameterData.description && (
                    <Typography variant="body2">
                      • Description: {selectedSuggestion.newParameterData.description}
                    </Typography>
                  )}
                </Alert>
              )}

              {(selectedSuggestion.action === 'update_alias' || selectedSuggestion.action === 'update_unit') && (
                <Alert severity="info">
                  <Typography variant="body2" gutterBottom>
                    <strong>Target Parameter:</strong>
                  </Typography>
                  <Typography variant="body2">
                    • Name: {selectedSuggestion.targetParameterName}
                  </Typography>
                  <Typography variant="body2">
                    • ID: {selectedSuggestion.targetParameterId}
                  </Typography>
                  <Typography variant="body2">
                    {selectedSuggestion.action === 'update_alias'
                      ? `• "${selectedSuggestion.suggestedParameter}" will be added as an alias`
                      : `• "${selectedSuggestion.suggestedUnit}" will be added as a possible unit`}
                  </Typography>
                </Alert>
              )}

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Suggested By
                </Typography>
                <Typography variant="body2">
                  {selectedSuggestion.suggestedBy.name} ({selectedSuggestion.suggestedBy.email})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(selectedSuggestion.createdAt).toLocaleString()}
                </Typography>
              </Box>

              {/* Approval Notes */}
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Approval Notes (Optional)"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
              />

              {/* Rejection Reason */}
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Rejection Reason (Required for rejection)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this suggestion is being rejected..."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReviewDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleRejectSuggestion}
            disabled={!rejectionReason.trim()}
            startIcon={<RejectIcon />}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApproveSuggestion}
            startIcon={<ApproveIcon />}
          >
            Approve & Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParameterMasterManagement;
