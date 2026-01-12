import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { theme } from '../../styles/theme';
import CustomButton from '../../components/ui/CustomButton';
import DropZone from '../../components/ui/DropZone';
import FileList from '../../components/ui/FileList';
import ProgressBar from '../../components/ui/ProgressBar';
import Modal from '../../components/ui/Modal';
import AlertBox from '../../components/ui/AlertBox';
import Badge from '../../components/ui/Badge';

interface UploadedReport {
  reportId: string;
  fileName: string;
  fileSize: number;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  error?: string;
  processingTime?: number;
}

const UploadReport: React.FC = () => {
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
  const [bulkUploadDisabled, setBulkUploadDisabled] = useState(false);

  // Fetch config to check if bulk upload is disabled
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/lab-config/upload-config');
        if (response.data.success) {
          setBulkUploadDisabled(response.data.data.disableBulkUpload || false);
        }
      } catch (error) {
        console.error('Failed to fetch upload config:', error);
      }
    };
    fetchConfig();
  }, []);

  React.useEffect(() => {
    if (batchStartTime && processing) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - batchStartTime) / 1000;
        setCurrentElapsedTime(elapsed);
      }, 100);

      return () => clearInterval(interval);
    } else {
      setCurrentElapsedTime(0);
    }
  }, [batchStartTime, processing]);

  const MAX_BULK_FILES = 10;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      console.log('[UPLOAD] Files selected:', acceptedFiles.length);

      const pdfFiles = acceptedFiles.filter((file) => file.type === 'application/pdf');

      if (pdfFiles.length > 0) {
        // If bulk upload is disabled, only take the first file
        // If bulk upload is enabled, limit to MAX_BULK_FILES
        let filesToUse: File[];
        if (bulkUploadDisabled) {
          filesToUse = [pdfFiles[0]];
        } else if (pdfFiles.length > MAX_BULK_FILES) {
          filesToUse = pdfFiles.slice(0, MAX_BULK_FILES);
          enqueueSnackbar(`Maximum ${MAX_BULK_FILES} files allowed. Only first ${MAX_BULK_FILES} files will be uploaded.`, {
            variant: 'warning',
          });
        } else {
          filesToUse = pdfFiles;
        }

        setFiles(filesToUse);
        setActiveStep(1);
        enqueueSnackbar(`${filesToUse.length} PDF file(s) selected successfully`, {
          variant: 'success',
        });
      } else {
        enqueueSnackbar('Please upload PDF files only', { variant: 'error' });
      }
    },
    [enqueueSnackbar, bulkUploadDisabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: !bulkUploadDisabled,
    maxFiles: bulkUploadDisabled ? 1 : MAX_BULK_FILES,
    maxSize: 30 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (newFiles.length === 0) {
      setActiveStep(0);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      enqueueSnackbar('Please select at least one file', { variant: 'error' });
      return;
    }

    setUploading(true);
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('pdfs', file);
    });

    try {
      const response = await api.post('/reports/upload/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const reports = response.data.data.uploadedReports;

        const uploadedReportsList: UploadedReport[] = reports.map((report: any) => ({
          reportId: report.reportId,
          fileName: report.fileName,
          fileSize: report.fileSize,
          status: 'uploaded' as const,
        }));

        setUploadedReports(uploadedReportsList);
        setActiveStep(2);
        enqueueSnackbar(`Successfully uploaded ${reports.length} report(s)! Processing...`, {
          variant: 'success',
        });

        await handleBatchProcessAuto(uploadedReportsList);
      }
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || 'Upload failed', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleBatchProcessAuto = async (reports: UploadedReport[]) => {
    if (reports.length === 0) return;

    setProcessing(true);
    const batchStart = Date.now();
    setBatchStartTime(batchStart);

    // Initialize all reports as 'processing'
    const processingReports = reports.map((r) => ({ ...r, status: 'processing' as const }));
    setUploadedReports(processingReports);

    // Track results as they complete
    const resultsRef: UploadedReport[] = [...processingReports];
    let completedCount = 0;

    // Process each report individually for real-time updates
    const processReport = async (report: UploadedReport, index: number) => {
      const startTime = Date.now();
      try {
        const response = await api.post(`/reports/${report.reportId}/process`);
        const processingTime = (Date.now() - startTime) / 1000;

        if (response.data.success) {
          resultsRef[index] = {
            ...report,
            status: 'completed' as const,
            processingTime,
          };
        } else {
          resultsRef[index] = {
            ...report,
            status: 'error' as const,
            error: response.data.message || 'Processing failed',
          };
        }
      } catch (error: any) {
        resultsRef[index] = {
          ...report,
          status: 'error' as const,
          error: error.response?.data?.message || 'Processing failed',
        };
      }

      completedCount++;
      setCurrentProcessingIndex(completedCount);

      // Update state immediately so UI reflects completed reports
      setUploadedReports([...resultsRef]);

      // Show notification for first completed report
      if (completedCount === 1 && resultsRef[index].status === 'completed') {
        enqueueSnackbar(`${report.fileName} ready for review!`, { variant: 'success' });
      }
    };

    // Start all processing in parallel (backend handles concurrency via CONCURRENT_PDF_LIMIT)
    await Promise.all(reports.map((report, index) => processReport(report, index)));

    // All done
    setProcessing(false);
    setBatchStartTime(null);
    setShowSuccessDialog(true);

    const successCount = resultsRef.filter((r) => r.status === 'completed').length;
    enqueueSnackbar(
      `Processed ${successCount}/${reports.length} reports!`,
      { variant: successCount === reports.length ? 'success' : 'warning' }
    );
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
    <div
      style={{
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1
          style={{
            fontSize: theme.typography.sizes.heading,
            fontWeight: theme.typography.weights.bold,
            color: theme.colors.textPrimary,
            margin: 0,
            marginBottom: theme.spacing.xs,
            lineHeight: theme.typography.lineHeights.tight,
          }}
        >
          Upload Lab Reports
        </h1>
        <p
          style={{
            fontSize: theme.typography.sizes.body,
            fontWeight: theme.typography.weights.normal,
            color: theme.colors.textSecondary,
            margin: 0,
            lineHeight: theme.typography.lineHeights.normal,
          }}
        >
          Upload {bulkUploadDisabled ? 'a' : `up to ${MAX_BULK_FILES}`} lab report PDF{bulkUploadDisabled ? '' : 's'} for AI-powered data extraction
        </p>
      </div>

      {/* Main Card */}
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          boxShadow: theme.shadows.md,
          maxWidth: '900px',
        }}
      >
        {/* Step Indicators */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const isCompleted = index < activeStep;

              return (
                <div key={index} style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: isActive
                          ? theme.colors.accent
                          : isCompleted
                          ? theme.colors.success
                          : theme.colors.background,
                        border: `2px solid ${
                          isActive || isCompleted ? 'transparent' : theme.colors.border
                        }`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: theme.typography.sizes.body,
                        fontWeight: theme.typography.weights.semibold,
                        color:
                          isActive || isCompleted
                            ? theme.colors.surface
                            : theme.colors.textSecondary,
                      }}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <div
                      style={{
                        fontSize: theme.typography.sizes.small,
                        fontWeight: isActive
                          ? theme.typography.weights.semibold
                          : theme.typography.weights.medium,
                        color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                        textAlign: 'center',
                      }}
                    >
                      {step.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div>
          {/* STEP 1: File Selection */}
          {activeStep === 0 && (
            <div>
              <DropZone
                onDrop={onDrop}
                multiple={!bulkUploadDisabled}
                maxSize={30 * 1024 * 1024}
                maxFiles={bulkUploadDisabled ? 1 : MAX_BULK_FILES}
              />
            </div>
          )}

          {/* STEP 1.5: Files Selected */}
          {activeStep === 1 && (
            <div>
              <div
                style={{
                  marginBottom: theme.spacing.md,
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.background,
                  borderRadius: theme.radius.md,
                }}
              >
                <div
                  style={{
                    fontSize: theme.typography.sizes.body,
                    fontWeight: theme.typography.weights.semibold,
                    color: theme.colors.textPrimary,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  Selected Files ({files.length})
                </div>
                <div
                  style={{
                    fontSize: theme.typography.sizes.small,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Total size:{' '}
                  {formatBytes(files.reduce((acc, file) => acc + file.size, 0))}
                </div>
              </div>

              <FileList
                files={files.map((file) => ({
                  name: file.name,
                  size: file.size,
                }))}
                onRemove={removeFile}
              />

              <AlertBox variant="info" action={undefined}>
                <div>
                  <strong>Processing Configuration:</strong>
                  <br />
                  Reports will be processed as per the configuration set by your admin.
                </div>
              </AlertBox>

              <div
                style={{
                  display: 'flex',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.lg,
                }}
              >
                <CustomButton variant="secondary" onClick={() => setActiveStep(0)}>
                  Back
                </CustomButton>
                <CustomButton
                  variant="primary"
                  onClick={handleUpload}
                  disabled={uploading || processing}
                  loading={uploading}
                >
                  {uploading
                    ? `Uploading ${files.length} File${files.length !== 1 ? 's' : ''}...`
                    : processing
                    ? 'Processing...'
                    : `Upload & Process ${files.length} Report${files.length !== 1 ? 's' : ''}`}
                </CustomButton>
              </div>
            </div>
          )}

          {/* STEP 2: Processing */}
          {activeStep === 2 && (
            <div>
              {processing && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                  <ProgressBar
                    value={currentProcessingIndex}
                    max={uploadedReports.length}
                    label={`${currentProcessingIndex} of ${uploadedReports.length} completed`}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: theme.typography.sizes.small,
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    <span style={{ color: theme.colors.success }}>
                      {currentProcessingIndex > 0 && `${currentProcessingIndex} ready for review`}
                    </span>
                    <span style={{ color: theme.colors.accent }}>
                      {currentElapsedTime.toFixed(1)}s elapsed
                    </span>
                  </div>
                </div>
              )}

              <FileList
                files={uploadedReports.map(r => ({
                  name: r.fileName,
                  size: r.fileSize,
                  status: r.status,
                  error: r.error,
                  processingTime: r.processingTime
                }))}
                showStatus
              />

              {/* Show status alert - updates in real-time */}
              {uploadedReports.some((r) => r.status === 'completed' || r.status === 'error') && (
                <AlertBox
                  variant={
                    !processing && uploadedReports.every((r) => r.status === 'completed')
                      ? 'success'
                      : uploadedReports.some((r) => r.status === 'completed')
                      ? 'info'
                      : 'warning'
                  }
                >
                  {processing ? (
                    <>
                      <strong>{uploadedReports.filter((r) => r.status === 'completed').length}</strong> of{' '}
                      {uploadedReports.length} reports ready for review.{' '}
                      <span style={{ color: theme.colors.textSecondary }}>
                        ({uploadedReports.filter((r) => r.status === 'processing').length} still processing...)
                      </span>
                    </>
                  ) : (
                    <>
                      {uploadedReports.filter((r) => r.status === 'completed').length} of{' '}
                      {uploadedReports.length} reports processed successfully
                    </>
                  )}
                </AlertBox>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.lg,
                }}
              >
                <CustomButton variant="secondary" onClick={handleReset} disabled={processing}>
                  Upload New Reports
                </CustomButton>
                <CustomButton
                  variant="primary"
                  onClick={handleReviewReports}
                  disabled={!uploadedReports.some((r) => r.status === 'completed')}
                >
                  {processing && uploadedReports.some((r) => r.status === 'completed')
                    ? `Review ${uploadedReports.filter((r) => r.status === 'completed').length} Ready Report${uploadedReports.filter((r) => r.status === 'completed').length !== 1 ? 's' : ''}`
                    : 'Review Reports'}
                </CustomButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      <Modal
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        title="Batch Processing Complete"
        maxWidth="sm"
        actions={
          <>
            <CustomButton variant="secondary" onClick={handleReset}>
              Upload More Reports
            </CustomButton>
            <CustomButton variant="primary" onClick={handleReviewReports}>
              Review Reports
            </CustomButton>
          </>
        }
      >
        <div>
          <p
            style={{
              fontSize: theme.typography.sizes.body,
              color: theme.colors.textPrimary,
              margin: 0,
              marginBottom: theme.spacing.md,
            }}
          >
            {uploadedReports.filter((r) => r.status === 'completed').length} of{' '}
            {uploadedReports.length} reports processed successfully!
          </p>

          <div
            style={{
              fontSize: theme.typography.sizes.small,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing.sm,
            }}
          >
            Processing Summary:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {uploadedReports.map((report, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  padding: theme.spacing.xs,
                  backgroundColor: theme.colors.background,
                  borderRadius: theme.radius.sm,
                }}
              >
                <span style={{ fontSize: '16px' }}>
                  {report.status === 'completed' ? '✓' : '✕'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: theme.typography.sizes.small,
                      color: theme.colors.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {report.fileName}
                  </div>
                  <div
                    style={{
                      fontSize: theme.typography.sizes.tiny,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {report.status === 'completed'
                      ? `${report.processingTime?.toFixed(2)}s`
                      : report.error}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UploadReport;
