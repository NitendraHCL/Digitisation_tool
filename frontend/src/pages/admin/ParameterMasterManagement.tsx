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
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
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

const ParameterMasterManagement: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [valueTypeFilter, setValueTypeFilter] = useState('');

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
    fetchParameters();
  }, [page, searchTerm, valueTypeFilter]);

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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Parameter Master
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
        >
          Add Parameter
        </Button>
      </Box>

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
    </Box>
  );
};

export default ParameterMasterManagement;
