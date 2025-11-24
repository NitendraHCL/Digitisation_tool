import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  ListItemIcon,
  Divider,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as FileIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Info as InfoIcon,
  Science as ProcessIcon,
  Assignment as ReportIcon,
  InsertDriveFile as PdfIcon,
  HourglassEmpty as WaitingIcon,
  PlayArrow as ProcessingIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';

interface UploadedReport {
  reportId: string;
  fileName: string;
  fileSize: number;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  error?: string;
  processingTime?: number;
}

const UploadReport: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedReports, setUploadedReports] = useState<UploadedReport[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [batchStartTime, setBatchStartTime] = useState<number | null>(null);
  const [currentElapsedTime, setCurrentElapsedTime] = useState<number>(0);
  const [showConfig, setShowConfig] = useState(false);
  const [configDefaults, setConfigDefaults] = useState<{ model: string; extractionMethod: string }>({
    model: 'Gemini 2.5 Flash',
    extractionMethod: 'Hybrid'
  });

  // Fetch config defaults on mount
  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/lab-config');
        if (response.data.success) {
          const config = response.data.data;
          const modelMap: Record<string, string> = {
            'gemini-2.5-flash': 'Gemini 2.5 Flash',
            'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
            'gemini-2.0-flash': 'Gemini 2.0 Flash',
            'gpt-4o': 'GPT-4o',
            'gpt-4.1': 'GPT-4.1'
          };
          const methodMap: Record<string, string> = {
            'hybrid': 'Hybrid',
            'image': 'Image-based',
            'text': 'Text-based',
            'pdf': 'Raw PDF'
          };
          setConfigDefaults({
            model: modelMap[config.systemConfig?.defaultModel] || 'Gemini 2.5 Flash',
            extractionMethod: methodMap[config.systemConfig?.defaultExtractionMethod] || 'Hybrid'
          });
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
      }
    };
    fetchConfig();
  }, []);

  // Update timer every second while processing
  React.useEffect(() => {
    if (batchStartTime && processing) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - batchStartTime) / 1000;
        setCurrentElapsedTime(elapsed);
      }, 100); // Update every 100ms for smooth display

      return () => clearInterval(interval);
    } else {
      setCurrentElapsedTime(0);
    }
  }, [batchStartTime, processing]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('[UPLOAD] 1. onDrop triggered, accepted files:', acceptedFiles.length);

    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length > 0) {
      console.log('[UPLOAD] 2. Valid PDF files:', pdfFiles.length);
      pdfFiles.forEach((file, index) => {
        console.log(`[UPLOAD] File ${index + 1}:`, {
          name: file.name,
          size: file.size,
          type: file.type,
        });
      });

      setFiles(pdfFiles);
      setActiveStep(1);
      enqueueSnackbar(`${pdfFiles.length} PDF file(s) selected successfully`, { variant: 'success' });
    } else {
      console.error('[UPLOAD] ERROR: No valid PDF files');
      enqueueSnackbar('Please upload PDF files only', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true, // Enable multiple file selection
    maxSize: 30 * 1024 * 1024, // 30MB per file
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (newFiles.length === 0) {
      setActiveStep(0);
    }
  };

  const getTotalSize = () => {
    return files.reduce((acc, file) => acc + file.size, 0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    console.log('[UPLOAD] ========================================');
    console.log('[UPLOAD] 4. handleUpload called');
    console.log('[UPLOAD] 5. Number of files to upload:', files.length);
    console.log('[UPLOAD] 5.1 Files array:', files);
    console.log('[UPLOAD] 5.2 Files details:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));

    if (files.length === 0) {
      console.error('[UPLOAD] ERROR: No files selected');
      enqueueSnackbar('Please select at least one file', { variant: 'error' });
      return;
    }

    setUploading(true);
    const formData = new FormData();

    // Append all files
    files.forEach((file, index) => {
      formData.append('pdfs', file); // Note: 'pdfs' plural for multiple upload
      console.log(`[UPLOAD] 6.${index + 1}. Adding file to FormData:`, file.name, 'Size:', file.size, 'Type:', file.type);
    });

    // Log FormData entries
    console.log('[UPLOAD] 6.5 FormData entries:');
    formData.forEach((value, key) => {
      console.log('[UPLOAD] FormData entry:', key, '=', value);
    });

    console.log('[UPLOAD] 7. Starting upload to /reports/upload/multiple...');
    console.log('[UPLOAD] 7.1 Request URL:', '/reports/upload/multiple');
    console.log('[UPLOAD] 7.2 Request method:', 'POST');
    console.log('[UPLOAD] 7.3 Content-Type:', 'multipart/form-data');

    try {
      const response = await api.post('/reports/upload/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[UPLOAD] ========================================');
      console.log('[UPLOAD] 8. Upload response received');
      console.log('[UPLOAD] 8.1 Response status:', response.status);
      console.log('[UPLOAD] 8.2 Response data:', response.data);
      console.log('[UPLOAD] 8.3 Response success:', response.data.success);

      if (response.data.success) {
        const reports = response.data.data.uploadedReports;
        console.log('[UPLOAD] 9. Successfully uploaded reports:', reports.length);
        console.log('[UPLOAD] 9.1 Uploaded reports array:', reports);

        const uploadedReportsList: UploadedReport[] = reports.map((report: any) => ({
          reportId: report.reportId,
          fileName: report.fileName,
          fileSize: report.fileSize,
          status: 'uploaded' as const,
        }));

        setUploadedReports(uploadedReportsList);
        setActiveStep(2);
        enqueueSnackbar(`Successfully uploaded ${reports.length} report(s)! Processing...`, { variant: 'success' });

        // Auto-process immediately after upload
        console.log('[UPLOAD] Auto-triggering batch processing...');
        await handleBatchProcessAuto(uploadedReportsList);
      }
    } catch (error: any) {
      console.error('[UPLOAD] ========================================');
      console.error('[UPLOAD] ERROR: Upload failed');
      console.error('[UPLOAD] ERROR type:', error.constructor.name);
      console.error('[UPLOAD] ERROR message:', error.message);
      console.error('[UPLOAD] ERROR response:', error.response);
      console.error('[UPLOAD] ERROR response status:', error.response?.status);
      console.error('[UPLOAD] ERROR response data:', error.response?.data);
      console.error('[UPLOAD] ERROR response headers:', error.response?.headers);
      console.error('[UPLOAD] ERROR config:', error.config);
      console.error('[UPLOAD] Full error object:', error);
      console.error('[UPLOAD] ========================================');
      enqueueSnackbar(error.response?.data?.message || 'Upload failed', { variant: 'error' });
    } finally {
      setUploading(false);
      console.log('[UPLOAD] 10. Upload process completed');
      console.log('[UPLOAD] ========================================');
    }
  };

  const handleBatchProcessAuto = async (reports: UploadedReport[]) => {
    console.log('[UPLOAD] ========================================');
    console.log('[UPLOAD] 11. handleBatchProcessAuto called (AUTO-PROCESSING MODE)');
    console.log('[UPLOAD] 12. Reports to process:', reports.length);

    if (reports.length === 0) {
      console.error('[UPLOAD] ERROR: No reports to process');
      return;
    }

    setProcessing(true);
    const batchStart = Date.now();
    setBatchStartTime(batchStart);

    // Set all reports to processing status
    const processingReports = reports.map(r => ({ ...r, status: 'processing' as const }));
    setUploadedReports(processingReports);
    setCurrentProcessingIndex(reports.length - 1); // Show all files as processing

    console.log('[UPLOAD] 13. Calling batch processing endpoint /reports/process-multiple');
    console.log('[UPLOAD] 13.1 Report IDs:', reports.map(r => r.reportId));
    console.log('[UPLOAD] 13.2 Using system defaults (no model/method specified)');

    try {
      const response = await api.post('/reports/process-multiple', {
        reportIds: reports.map(r => r.reportId),
        // No extractionMethod or model - backend will use config defaults
      });

      console.log('[UPLOAD] ========================================');
      console.log('[UPLOAD] 14. Batch processing response received');
      console.log('[UPLOAD] 14.1 Response status:', response.status);
      console.log('[UPLOAD] 14.2 Response data:', response.data);

      if (response.data.success) {
        const batchData = response.data.data;
        const totalTime = batchData.totalProcessingTime;

        console.log('[UPLOAD] 15. Batch processing completed successfully');
        console.log('[UPLOAD] 15.1 Total reports:', batchData.totalReports);
        console.log('[UPLOAD] 15.2 Success count:', batchData.successCount);
        console.log('[UPLOAD] 15.3 Error count:', batchData.errorCount);
        console.log('[UPLOAD] 15.4 Total time:', totalTime);
        console.log('[UPLOAD] 15.5 Average time per report:', batchData.averageTimePerReport);
        console.log('[UPLOAD] 15.6 Concurrency limit:', batchData.concurrencyLimit);

        // Create a map of results by reportId
        const resultsMap = new Map();

        batchData.successful.forEach((result: any) => {
          resultsMap.set(result.reportId, {
            status: 'completed' as const,
            processingTime: parseFloat(result.processingTime.replace('s', '')),
          });
        });

        batchData.failed.forEach((result: any) => {
          resultsMap.set(result.reportId, {
            status: 'error' as const,
            error: result.error,
          });
        });

        // Update all reports with results
        const finalReports = reports.map(report => {
          const result = resultsMap.get(report.reportId);
          if (result) {
            return { ...report, ...result };
          }
          return { ...report, status: 'error' as const, error: 'No result returned' };
        });

        setUploadedReports(finalReports);
        setShowSuccessDialog(true);

        const successCount = finalReports.filter(r => r.status === 'completed').length;
        console.log('[UPLOAD] 16. UI updated with final results');
        console.log('[UPLOAD] 16.1 Success count:', successCount);
        console.log('[UPLOAD] 16.2 Failed count:', finalReports.length - successCount);
        console.log('[UPLOAD] ========================================');

        enqueueSnackbar(
          `Processed ${successCount}/${reports.length} reports in parallel in ${totalTime}!`,
          { variant: successCount === reports.length ? 'success' : 'warning' }
        );
      } else {
        throw new Error(response.data.message || 'Batch processing failed');
      }
    } catch (error: any) {
      console.error('[UPLOAD] ========================================');
      console.error('[UPLOAD] ERROR: Batch processing failed');
      console.error('[UPLOAD] ERROR message:', error.message);
      console.error('[UPLOAD] ERROR response:', error.response?.data);
      console.error('[UPLOAD] ========================================');

      // Mark all reports as error
      const errorReports = reports.map(r => ({
        ...r,
        status: 'error' as const,
        error: error.response?.data?.message || 'Batch processing failed',
      }));
      setUploadedReports(errorReports);

      enqueueSnackbar(
        error.response?.data?.message || 'Batch processing failed',
        { variant: 'error' }
      );
    } finally {
      setProcessing(false);
      setBatchStartTime(null);
      setCurrentProcessingIndex(-1);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setUploadedReports([]);
    setActiveStep(0);
    setUploading(false);
    setProcessing(false);
    setShowSuccessDialog(false);
    setBatchStartTime(null);
    setCurrentProcessingIndex(-1);
  };

  const handleReviewReports = () => {
    navigate('/nurse/reports');
  };

  const getStatusIcon = (status: UploadedReport['status']) => {
    switch (status) {
      case 'uploaded':
        return <WaitingIcon color="action" />;
      case 'processing':
        return <ProcessingIcon color="primary" />;
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
    }
  };

  const getStatusColor = (status: UploadedReport['status']) => {
    switch (status) {
      case 'uploaded':
        return 'default';
      case 'processing':
        return 'primary';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
    }
  };

  const steps = [
    {
      label: 'Select PDF Files',
      description: 'Choose one or more PDF files to upload',
    },
    {
      label: 'Review & Upload',
      description: 'Review settings and upload your reports',
    },
    {
      label: 'Processing',
      description: 'Reports are being processed automatically',
    },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadIcon /> Upload Lab Reports
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Upload multiple lab report PDFs for AI-powered data extraction
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 4 }}>
          {/* STEP 1: File Selection */}
          <Step>
            <StepLabel>
              <Typography variant="h6">{steps[0].label}</Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {steps[0].description}
              </Typography>

              {files.length === 0 ? (
                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                    transition: 'all 0.3s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                    mt: 2,
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    {isDragActive
                      ? 'Drop the files here...'
                      : 'Drag & drop PDF files here, or click to select'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Maximum file size: 30MB per file • Multiple files allowed
                  </Typography>
                </Box>
              ) : (
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Selected Files ({files.length})
                      </Typography>
                      <Chip
                        label={`Total: ${formatBytes(getTotalSize())}`}
                        color="primary"
                        size="small"
                      />
                    </Box>

                    <List>
                      {files.map((file, index) => (
                        <ListItem
                          key={index}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => removeFile(index)} color="error">
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            <PdfIcon color="error" />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={formatBytes(file.size)}
                          />
                        </ListItem>
                      ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Button
                      variant="outlined"
                      startIcon={<UploadIcon />}
                      onClick={() => setFiles([])}
                      fullWidth
                    >
                      Clear All & Select Different Files
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(1)}
                  disabled={files.length === 0}
                >
                  Continue to Configuration
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* STEP 2: Review & Upload */}
          <Step>
            <StepLabel>
              <Typography variant="h6">Review & Upload</Typography>
            </StepLabel>
            <StepContent>
              <Alert severity="info" icon={<SettingsIcon />} sx={{ mt: 2, fontSize: '13px' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '13px' }}>
                  Processing Configuration
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6B7280' }}>
                  Reports will be automatically processed using <strong>{configDefaults.model}</strong> with <strong>{configDefaults.extractionMethod}</strong> extraction method.
                  <br />
                  <em>These settings are configured by administrators and cannot be changed during upload.</em>
                </Typography>
              </Alert>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={() => setActiveStep(0)}>Back</Button>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={uploading || processing}
                  sx={{ minWidth: 200 }}
                >
                  {uploading ? `Uploading ${files.length} File${files.length !== 1 ? 's' : ''}...` :
                   processing ? 'Processing...' :
                   `Upload & Process ${files.length} Report${files.length !== 1 ? 's' : ''}`}
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* STEP 3: Processing */}
          <Step>
            <StepLabel>
              <Typography variant="h6">{steps[2].label}</Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {steps[2].description}
              </Typography>

              <Card sx={{ mt: 2 }}>
                <CardContent>
                  {processing && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">
                          Processing file {currentProcessingIndex + 1} of {uploadedReports.length}
                        </Typography>
                        <Typography variant="body2" color="primary">
                          {currentElapsedTime.toFixed(1)}s elapsed
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(currentProcessingIndex / uploadedReports.length) * 100}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {Math.round((currentProcessingIndex / uploadedReports.length) * 100)}% complete
                      </Typography>
                    </Box>
                  )}

                  <List>
                    {uploadedReports.map((report, index) => (
                      <ListItem
                        key={report.reportId}
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                          bgcolor: report.status === 'processing' ? 'action.hover' : 'background.paper',
                        }}
                      >
                        <ListItemIcon>
                          {getStatusIcon(report.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">{report.fileName}</Typography>
                              <Chip
                                label={report.status.toUpperCase()}
                                size="small"
                                color={getStatusColor(report.status)}
                              />
                            </Box>
                          }
                          secondary={
                            <>
                              {report.status === 'completed' && report.processingTime && (
                                <Typography variant="caption" color="success.main">
                                  ✓ Completed in {report.processingTime.toFixed(2)}s
                                </Typography>
                              )}
                              {report.status === 'error' && (
                                <Typography variant="caption" color="error">
                                  ✗ {report.error}
                                </Typography>
                              )}
                              {report.status === 'processing' && (
                                <Typography variant="caption" color="primary">
                                  ⏳ Processing...
                                </Typography>
                              )}
                              {report.status === 'uploaded' && (
                                <Typography variant="caption" color="text.secondary">
                                  ⏸️ Waiting...
                                </Typography>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>

                  {uploadedReports.every(r => r.status === 'completed' || r.status === 'error') && (
                    <Alert
                      severity={uploadedReports.every(r => r.status === 'completed') ? 'success' : 'warning'}
                      sx={{ mt: 2 }}
                    >
                      <Typography variant="body2">
                        {uploadedReports.filter(r => r.status === 'completed').length} of{' '}
                        {uploadedReports.length} reports processed successfully
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={handleReset}>Upload New Reports</Button>
                <Button
                  variant="contained"
                  onClick={handleReviewReports}
                  disabled={!uploadedReports.some(r => r.status === 'completed')}
                >
                  Review Reports
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onClose={() => setShowSuccessDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SuccessIcon color="success" />
          Batch Processing Complete
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {uploadedReports.filter(r => r.status === 'completed').length} of{' '}
            {uploadedReports.length} reports processed successfully!
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Processing Summary:
            </Typography>
            <List dense>
              {uploadedReports.map((report, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {report.status === 'completed' ? <SuccessIcon color="success" fontSize="small" /> : <ErrorIcon color="error" fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={report.fileName}
                    secondary={report.status === 'completed' ? `${report.processingTime?.toFixed(2)}s` : report.error}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReset} variant="outlined">
            Upload More Reports
          </Button>
          <Button onClick={handleReviewReports} variant="contained">
            Review Reports
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UploadReport;
