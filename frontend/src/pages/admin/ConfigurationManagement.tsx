import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  useTheme,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Science as LabIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from 'notistack';

interface ThresholdConfig {
  criticalDeviation: number;
  warningDeviation: number;
  flaggedParameterThreshold: number;
  autoApproveThreshold: number;
}

interface LabConfig {
  id: string;
  name: string;
  normalRanges: {
    [key: string]: {
      min: number;
      max: number;
      unit: string;
    };
  };
}

interface SystemConfig {
  enableAutoProcessing: boolean;
  processingTimeout: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  retentionDays: number;
  auditLogEnabled: boolean;
}

const ConfigurationManagement: React.FC = () => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    criticalDeviation: 200,
    warningDeviation: 50,
    flaggedParameterThreshold: 50,
    autoApproveThreshold: 90,
  });

  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    enableAutoProcessing: true,
    processingTimeout: 60,
    maxFileSize: 10,
    allowedFileTypes: ['pdf'],
    retentionDays: 365,
    auditLogEnabled: true,
  });

  const [labs, setLabs] = useState<LabConfig[]>([
    {
      id: '1',
      name: 'Quest Diagnostics',
      normalRanges: {
        'Hemoglobin': { min: 12.0, max: 16.0, unit: 'g/dL' },
        'WBC Count': { min: 4000, max: 11000, unit: 'cells/mcL' },
        'Platelet Count': { min: 150000, max: 450000, unit: 'cells/mcL' },
      },
    },
    {
      id: '2',
      name: 'LabCorp',
      normalRanges: {
        'Hemoglobin': { min: 11.5, max: 15.5, unit: 'g/dL' },
        'WBC Count': { min: 3500, max: 10500, unit: 'cells/mcL' },
        'Platelet Count': { min: 140000, max: 440000, unit: 'cells/mcL' },
      },
    },
  ]);

  const [selectedLab, setSelectedLab] = useState<LabConfig | null>(null);
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [parameterDialogOpen, setParameterDialogOpen] = useState(false);
  const [newParameter, setNewParameter] = useState({
    name: '',
    min: 0,
    max: 0,
    unit: '',
  });

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    try {
      const response = await api.get('/lab-config');
      if (response.data.data) {
        setThresholds(response.data.data.thresholds || thresholds);
        setSystemConfig(response.data.data.systemConfig || systemConfig);
        setLabs(response.data.data.labs || labs);
      }
    } catch (error) {
      console.error('Failed to fetch configuration:', error);
    }
  };

  const handleSaveThresholds = async () => {
    setSaving(true);
    try {
      await api.put('/lab-config/thresholds', thresholds);
      enqueueSnackbar('Thresholds updated successfully', { variant: 'success' });
      setHasChanges(false);
    } catch (error) {
      enqueueSnackbar('Failed to update thresholds', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSystemConfig = async () => {
    setSaving(true);
    try {
      await api.put('/lab-config/system', systemConfig);
      enqueueSnackbar('System configuration updated successfully', { variant: 'success' });
      setHasChanges(false);
    } catch (error) {
      enqueueSnackbar('Failed to update system configuration', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLab = () => {
    setSelectedLab({
      id: '',
      name: '',
      normalRanges: {},
    });
    setLabDialogOpen(true);
  };

  const handleEditLab = (lab: LabConfig) => {
    setSelectedLab({
      ...lab,
      normalRanges: lab.normalRanges || {},
    });
    setLabDialogOpen(true);
  };

  const handleSaveLab = async () => {
    if (!selectedLab) return;

    try {
      if (selectedLab.id) {
        await api.put(`/lab-config/labs/${selectedLab.id}`, selectedLab);
        setLabs(prev => prev.map(l => l.id === selectedLab.id ? selectedLab : l));
      } else {
        const response = await api.post('/lab-config/labs', selectedLab);
        setLabs(prev => [...prev, response.data.data]);
      }
      enqueueSnackbar('Lab configuration saved successfully', { variant: 'success' });
      setLabDialogOpen(false);
    } catch (error) {
      enqueueSnackbar('Failed to save lab configuration', { variant: 'error' });
    }
  };

  const handleDeleteLab = async (labId: string) => {
    if (!window.confirm('Are you sure you want to delete this lab configuration?')) {
      return;
    }

    try {
      await api.delete(`/lab-config/labs/${labId}`);
      setLabs(prev => prev.filter(l => l.id !== labId));
      enqueueSnackbar('Lab configuration deleted', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to delete lab configuration', { variant: 'error' });
    }
  };

  const handleAddParameter = () => {
    if (!selectedLab || !newParameter.name) return;

    setSelectedLab({
      ...selectedLab,
      normalRanges: {
        ...(selectedLab.normalRanges || {}),
        [newParameter.name]: {
          min: newParameter.min,
          max: newParameter.max,
          unit: newParameter.unit,
        },
      },
    });

    setNewParameter({ name: '', min: 0, max: 0, unit: '' });
    setParameterDialogOpen(false);
  };

  const handleDeleteParameter = (paramName: string) => {
    if (!selectedLab || !selectedLab.normalRanges) return;

    const { [paramName]: _, ...rest } = selectedLab.normalRanges;
    setSelectedLab({
      ...selectedLab,
      normalRanges: rest,
    });
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset to default values?')) {
      setThresholds({
        criticalDeviation: 200,
        warningDeviation: 50,
        flaggedParameterThreshold: 50,
        autoApproveThreshold: 90,
      });
      setHasChanges(true);
      enqueueSnackbar('Reset to default values', { variant: 'info' });
    }
  };

  return (
    <Box sx={{ maxWidth: 1400 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: '#111827' }}>
          System Configuration
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '14px' }}>
          Manage system thresholds, lab settings, and processing parameters
        </Typography>
      </Box>

      {hasChanges && (
        <Alert
          severity="warning"
          sx={{
            mb: 2.5,
            borderRadius: 2,
            border: '1px solid #FCD34D',
            bgcolor: '#FEF3C7',
            '& .MuiAlert-icon': { color: '#F59E0B' }
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '14px', color: '#92400E' }}>
            You have unsaved changes. Don't forget to save your configuration.
          </Typography>
        </Alert>
      )}

      {/* Threshold Configuration */}
      <Paper sx={{ p: 2.5, mb: 2.5, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Threshold Configuration
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<ResetIcon sx={{ fontSize: 18 }} />}
              onClick={handleReset}
              size="small"
              sx={{
                borderColor: '#D1D5DB',
                color: '#6B7280',
                '&:hover': { borderColor: '#9CA3AF', bgcolor: '#F9FAFB' },
                borderRadius: 1.5,
                textTransform: 'none',
                px: 2,
                py: 0.75
              }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon sx={{ fontSize: 18 }} />}
              onClick={handleSaveThresholds}
              disabled={saving || !hasChanges}
              size="small"
              sx={{
                bgcolor: '#4361EE',
                '&:hover': { bgcolor: '#3651CE' },
                borderRadius: 1.5,
                textTransform: 'none',
                px: 2,
                py: 0.75,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              Save Changes
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ border: '1px solid #E5E7EB', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280' }}>
                    Critical Value Deviation
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '16px', color: '#EF4444' }}>
                    {thresholds.criticalDeviation}%
                  </Typography>
                </Box>
                <Box sx={{ px: 0.5 }}>
                  <Slider
                    value={thresholds.criticalDeviation}
                    onChange={(e, value) => {
                      setThresholds(prev => ({ ...prev, criticalDeviation: value as number }));
                      setHasChanges(true);
                    }}
                    min={50}
                    max={500}
                    step={10}
                    sx={{ color: '#EF4444' }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                  Values exceeding this percentage will be flagged as critical
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ border: '1px solid #E5E7EB', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280' }}>
                    Warning Deviation
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '16px', color: '#F59E0B' }}>
                    {thresholds.warningDeviation}%
                  </Typography>
                </Box>
                <Box sx={{ px: 0.5 }}>
                  <Slider
                    value={thresholds.warningDeviation}
                    onChange={(e, value) => {
                      setThresholds(prev => ({ ...prev, warningDeviation: value as number }));
                      setHasChanges(true);
                    }}
                    min={10}
                    max={100}
                    step={5}
                    sx={{ color: '#F59E0B' }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                  Values exceeding this percentage will trigger a warning
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ border: '1px solid #E5E7EB', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280' }}>
                    Flagged Parameter Threshold
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '16px', color: '#EF4444' }}>
                    {thresholds.flaggedParameterThreshold}%
                  </Typography>
                </Box>
                <Box sx={{ px: 0.5 }}>
                  <Slider
                    value={thresholds.flaggedParameterThreshold}
                    onChange={(e, value) => {
                      setThresholds(prev => ({ ...prev, flaggedParameterThreshold: value as number }));
                      setHasChanges(true);
                    }}
                    min={10}
                    max={100}
                    step={5}
                    sx={{ color: '#EF4444' }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                  Reports with this % or more abnormal parameters require attention
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ border: '1px solid #E5E7EB', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280' }}>
                    Auto-Approve Threshold
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '16px', color: '#10B981' }}>
                    {thresholds.autoApproveThreshold}%
                  </Typography>
                </Box>
                <Box sx={{ px: 0.5 }}>
                  <Slider
                    value={thresholds.autoApproveThreshold}
                    onChange={(e, value) => {
                      setThresholds(prev => ({ ...prev, autoApproveThreshold: value as number }));
                      setHasChanges(true);
                    }}
                    min={70}
                    max={100}
                    step={5}
                    sx={{ color: '#10B981' }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '12px' }}>
                  Reports with this % normal parameters can be auto-approved
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* System Configuration */}
      <Paper sx={{ p: 2.5, mb: 2.5, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            System Settings
          </Typography>
          <Button
            variant="contained"
            startIcon={<SaveIcon sx={{ fontSize: 18 }} />}
            onClick={handleSaveSystemConfig}
            disabled={saving}
            size="small"
            sx={{
              bgcolor: '#4361EE',
              '&:hover': { bgcolor: '#3651CE' },
              borderRadius: 1.5,
              textTransform: 'none',
              px: 2,
              py: 0.75,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Save Settings
          </Button>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography variant="body2" sx={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                Enable Auto-Processing
              </Typography>
              <Switch
                checked={systemConfig.enableAutoProcessing}
                onChange={(e) => setSystemConfig(prev => ({ ...prev, enableAutoProcessing: e.target.checked }))}
                size="small"
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
              <Typography variant="body2" sx={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                Enable Audit Logging
              </Typography>
              <Switch
                checked={systemConfig.auditLogEnabled}
                onChange={(e) => setSystemConfig(prev => ({ ...prev, auditLogEnabled: e.target.checked }))}
                size="small"
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Processing Timeout"
              type="number"
              value={systemConfig.processingTimeout}
              onChange={(e) => setSystemConfig(prev => ({ ...prev, processingTimeout: parseInt(e.target.value) }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>seconds</Typography>
                </InputAdornment>,
              }}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '14px',
                  bgcolor: '#FFFFFF'
                },
                '& .MuiInputLabel-root': {
                  fontSize: '13px'
                }
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Max File Size"
              type="number"
              value={systemConfig.maxFileSize}
              onChange={(e) => setSystemConfig(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>MB</Typography>
                </InputAdornment>,
              }}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '14px',
                  bgcolor: '#FFFFFF'
                },
                '& .MuiInputLabel-root': {
                  fontSize: '13px'
                }
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Data Retention Period"
              type="number"
              value={systemConfig.retentionDays}
              onChange={(e) => setSystemConfig(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>days</Typography>
                </InputAdornment>,
              }}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '14px',
                  bgcolor: '#FFFFFF'
                },
                '& .MuiInputLabel-root': {
                  fontSize: '13px'
                }
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Lab Configurations */}
      <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '15px', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Lab Configurations
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            onClick={handleAddLab}
            size="small"
            sx={{
              bgcolor: '#4361EE',
              '&:hover': { bgcolor: '#3651CE' },
              borderRadius: 1.5,
              textTransform: 'none',
              px: 2,
              py: 0.75,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Add Lab
          </Button>
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 500 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Lab Name
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '13px', color: '#6B7280', py: 1.5, borderBottom: '1px solid #E5E7EB', width: 100 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {labs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: '#9CA3AF', fontSize: '14px' }}>
                    No labs configured. Click "Add Lab" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                labs.map((lab) => (
                  <TableRow
                    key={lab.id}
                    sx={{
                      '&:hover': { bgcolor: '#F9FAFB' },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <TableCell sx={{ py: 1.75, fontSize: '14px', color: '#111827', borderBottom: '1px solid #E5E7EB' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <LabIcon sx={{ fontSize: 20, color: '#4361EE' }} />
                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                          {lab.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.75, borderBottom: '1px solid #E5E7EB' }}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit Lab">
                          <IconButton
                            size="small"
                            onClick={() => handleEditLab(lab)}
                            sx={{
                              color: '#6B7280',
                              '&:hover': { bgcolor: '#E5E7EB', color: '#4361EE' }
                            }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Lab">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteLab(lab.id)}
                            sx={{
                              color: '#6B7280',
                              '&:hover': { bgcolor: '#FEE2E2', color: '#EF4444' }
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Lab Edit Dialog */}
      <Dialog
        open={labDialogOpen}
        onClose={() => setLabDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '18px', color: '#111827', borderBottom: '1px solid #E5E7EB', pb: 2 }}>
          {selectedLab?.id ? 'Edit Lab Name' : 'Add New Lab'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Lab Name"
            placeholder="e.g., Quest Diagnostics, LabCorp"
            value={selectedLab?.name || ''}
            onChange={(e) => setSelectedLab(prev => prev ? { ...prev, name: e.target.value } : null)}
            autoFocus
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '14px',
                bgcolor: '#FFFFFF'
              },
              '& .MuiInputLabel-root': {
                fontSize: '13px'
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => setLabDialogOpen(false)}
            sx={{
              textTransform: 'none',
              color: '#6B7280',
              '&:hover': { bgcolor: '#F3F4F6' }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveLab}
            disabled={!selectedLab?.name || selectedLab.name.trim() === ''}
            sx={{
              bgcolor: '#4361EE',
              '&:hover': { bgcolor: '#3651CE' },
              textTransform: 'none',
              px: 3,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            {selectedLab?.id ? 'Update' : 'Add Lab'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Parameter Dialog */}
      <Dialog
        open={parameterDialogOpen}
        onClose={() => setParameterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '18px', color: '#111827', borderBottom: '1px solid #E5E7EB', pb: 2 }}>
          Add Parameter
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Parameter Name"
                value={newParameter.name}
                onChange={(e) => setNewParameter(prev => ({ ...prev, name: e.target.value }))}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '14px',
                    bgcolor: '#FFFFFF'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '13px'
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Min Value"
                type="number"
                value={newParameter.min}
                onChange={(e) => setNewParameter(prev => ({ ...prev, min: parseFloat(e.target.value) }))}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '14px',
                    bgcolor: '#FFFFFF'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '13px'
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Max Value"
                type="number"
                value={newParameter.max}
                onChange={(e) => setNewParameter(prev => ({ ...prev, max: parseFloat(e.target.value) }))}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '14px',
                    bgcolor: '#FFFFFF'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '13px'
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Unit"
                value={newParameter.unit}
                onChange={(e) => setNewParameter(prev => ({ ...prev, unit: e.target.value }))}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '14px',
                    bgcolor: '#FFFFFF'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '13px'
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => setParameterDialogOpen(false)}
            sx={{
              textTransform: 'none',
              color: '#6B7280',
              '&:hover': { bgcolor: '#F3F4F6' }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddParameter}
            sx={{
              bgcolor: '#4361EE',
              '&:hover': { bgcolor: '#3651CE' },
              textTransform: 'none',
              px: 3,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Add Parameter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConfigurationManagement;