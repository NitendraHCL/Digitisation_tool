import React, { useState, useEffect } from 'react';
import { LinearProgress, CircularProgress, Tooltip } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { Report } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import CustomButton from '../../components/ui/CustomButton';
import StatCard from '../../components/ui/StatCard';
import SearchInput from '../../components/ui/SearchInput';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Pagination from '../../components/ui/Pagination';

const ReportsList: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAdmin } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports');
      const reportsData = response.data.data;

      const pendingReports = reportsData.filter((r: Report) => r.status === 'ready');
      setReports(pendingReports);
      setPendingCount(pendingReports.length);
    } catch (error) {
      enqueueSnackbar('Failed to fetch reports', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await api.delete(`/reports/${reportId}`);
      enqueueSnackbar('Report deleted successfully', { variant: 'success' });
      fetchReports();
    } catch (error) {
      enqueueSnackbar('Failed to delete report', { variant: 'error' });
    }
  };

  const handleReprocess = async (reportId: string) => {
    try {
      setReprocessingId(reportId);
      await api.post(`/reports/${reportId}/reprocess`);
      enqueueSnackbar('Report reprocessing started', { variant: 'info' });
      setTimeout(fetchReports, 3000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to reprocess report';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setReprocessingId(null);
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
    const statusMap: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
      uploaded: 'default',
      processing: 'info',
      ready: 'warning',
      approved: 'success',
      rejected: 'error',
      error: 'error',
    };
    return statusMap[status] || 'default';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      processing: 'Processing',
      ready: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      error: 'Error',
    };
    return labels[status] || status;
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      searchTerm === '' ||
      report.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.extractedData?.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.extractedData?.labName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const paginatedReports = filteredReports.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);

  const tableColumns = [
    {
      key: 'orderId',
      label: 'Report ID',
      render: (value: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
          <span style={{ fontSize: '16px' }}>📄</span>
          <span style={{ fontWeight: theme.typography.weights.medium }}>{value}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Processed On',
      render: (value: string) => (
        <span style={{ color: theme.colors.textSecondary }}>
          {format(new Date(value), 'MMM dd, yyyy')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string, row: Report) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Badge label={getStatusLabel(value)} variant={getStatusBadgeVariant(value)} />
          {row.processingIssues?.hasIncompleteProcessing && (
            <Tooltip title={row.processingIssues.message || 'Incomplete processing detected'}>
              <span style={{
                color: theme.colors.warning,
                cursor: 'help',
                display: 'flex',
                alignItems: 'center'
              }}>
                ⚠
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: 'uploadedBy',
      label: 'Assigned Staff',
      render: (_: any, row: Report) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
          <Avatar
            name={row.uploadedBy?.name || 'Unknown'}
            size="small"
            backgroundColor={theme.colors.accent}
          />
          <span>{row.uploadedBy?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'labName',
      label: 'Services',
      render: (_: any, row: Report) => row.extractedData?.labName || 'Lab Report',
    },
    {
      key: 'parameters',
      label: 'Parameters',
      align: 'center' as const,
      render: (_: any, row: Report) => (
        <span style={{ fontWeight: theme.typography.weights.semibold }}>
          {row.extractedData?.results?.length || 0}
        </span>
      ),
    },
    {
      key: 'processingTime',
      label: 'Processing Time',
      render: (_: any, row: Report) => (
        <span style={{ color: theme.colors.textSecondary }}>
          {row.processingMetadata?.totalProcessingTime
            ? `${row.processingMetadata.totalProcessingTime.toFixed(2)}s`
            : '-'}
        </span>
      ),
    },
    {
      key: 'tokens',
      label: 'Tokens Used',
      render: (_: any, row: Report) => (
        <span style={{ color: theme.colors.textSecondary }}>
          {row.processingMetadata?.totalTokens
            ? row.processingMetadata.totalTokens.toLocaleString()
            : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center' as const,
      width: '120px',
      render: (_: any, row: Report) => (
        <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${api.defaults.baseURL}/reports/${row._id}/pdf`, '_blank');
            }}
            title="Download PDF"
            style={{
              padding: '6px 10px',
              fontSize: theme.typography.sizes.tiny,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
              transition: theme.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.accent;
              e.currentTarget.style.color = theme.colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textPrimary;
            }}
          >
            Download
          </button>
          {row.processingIssues?.hasIncompleteProcessing && (
            <Tooltip title={row.processingIssues.message || 'Reprocess this report'}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReprocess(row._id);
                }}
                disabled={reprocessingId === row._id}
                style={{
                  padding: '6px 10px',
                  fontSize: theme.typography.sizes.tiny,
                  fontFamily: theme.typography.fontFamily,
                  backgroundColor: '#F97316',
                  color: theme.colors.surface,
                  border: 'none',
                  borderRadius: theme.radius.sm,
                  cursor: reprocessingId === row._id ? 'not-allowed' : 'pointer',
                  transition: theme.transitions.fast,
                  opacity: reprocessingId === row._id ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  if (reprocessingId !== row._id) {
                    e.currentTarget.style.opacity = '0.85';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reprocessingId !== row._id) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {reprocessingId === row._id ? (
                  <CircularProgress size={12} sx={{ color: 'white' }} />
                ) : (
                  'Reprocess'
                )}
              </button>
            </Tooltip>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row._id);
            }}
            title="Delete Report"
            style={{
              padding: '6px 10px',
              fontSize: theme.typography.sizes.tiny,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
              transition: theme.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.error;
              e.currentTarget.style.color = theme.colors.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textPrimary;
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: theme.spacing.xl,
        }}
      >
        <h1
          style={{
            fontSize: theme.typography.sizes.heading,
            fontWeight: theme.typography.weights.bold,
            color: theme.colors.textPrimary,
            margin: 0,
            lineHeight: theme.typography.lineHeights.tight,
          }}
        >
          Pending Review
        </h1>
        <CustomButton variant="primary" onClick={() => navigate('/nurse/upload')} startIcon={<UploadIcon sx={{ fontSize: 20 }} />}>
          New Report
        </CustomButton>
      </div>

      {/* Pending Count Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
          maxWidth: '400px',
        }}
      >
        <StatCard
          title="Pending Review"
          value={pendingCount}
          icon="⏳"
          trend={`Last update: ${format(new Date(), 'MMM dd')}`}
          color={theme.colors.warning}
        />
      </div>

      {/* Table Container */}
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadows.md,
          overflow: 'hidden',
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: theme.spacing.md,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <SearchInput
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            placeholder="Search by ID, patient, lab..."
          />
        </div>

        {/* Table */}
        {loading ? (
          <LinearProgress sx={{ borderRadius: '4px' }} />
        ) : (
          <>
            <div style={{ padding: theme.spacing.md }}>
              <Table
                columns={tableColumns}
                data={paginatedReports}
                onRowClick={(report) => navigate(`/nurse/review/${report._id}`)}
                loading={loading}
              />
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: theme.spacing.md,
                  borderTop: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: theme.typography.sizes.small,
                    color: theme.colors.textSecondary,
                    fontFamily: theme.typography.fontFamily,
                  }}
                >
                  Showing {(page - 1) * rowsPerPage + 1}-
                  {Math.min(page * rowsPerPage, filteredReports.length)} of{' '}
                  {filteredReports.length} entries
                </div>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  showFirstLast
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportsList;
