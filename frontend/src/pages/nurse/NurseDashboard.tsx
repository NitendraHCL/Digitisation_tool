import React, { useState, useEffect } from 'react';
import { LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Report } from '../../types';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import CustomButton from '../../components/ui/CustomButton';
import StatCard from '../../components/ui/StatCard';
import AlertBox from '../../components/ui/AlertBox';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';

const NurseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    uploaded: 0,
    ready: 0,
    approved: 0,
    published: 0,
    rejected: 0,
    flagged: 0,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports');
      const reportsData = response.data.data || [];

      if (!Array.isArray(reportsData)) {
        console.error('[DASHBOARD] Reports data is not an array:', reportsData);
        setReports([]);
        enqueueSnackbar('Invalid data format received', { variant: 'error' });
        return;
      }

      setReports(reportsData);

      setStats({
        total: reportsData.length,
        uploaded: reportsData.filter((r: Report) => r.status === 'uploaded').length,
        ready: reportsData.filter((r: Report) => r.status === 'ready').length,
        approved: reportsData.filter((r: Report) => r.status === 'approved').length,
        published: reportsData.filter((r: Report) => r.status === 'published').length,
        rejected: reportsData.filter((r: Report) => r.status === 'rejected').length,
        flagged: reportsData.filter((r: Report) => r.flags?.requiresAttention).length,
      });
    } catch (error: any) {
      console.error('[DASHBOARD] Failed to fetch reports:', error);
      setReports([]);
      enqueueSnackbar(error.response?.data?.message || 'Failed to fetch reports', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (reportId: string) => {
    try {
      await api.post(`/reports/${reportId}/process`);
      enqueueSnackbar('Report processing started', { variant: 'info' });
      setTimeout(fetchReports, 2000);
    } catch (error) {
      enqueueSnackbar('Failed to process report', { variant: 'error' });
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
    const statusMap: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
      uploaded: 'default',
      processing: 'info',
      ready: 'warning',
      approved: 'success',
      published: 'info',
      rejected: 'error',
      error: 'error',
    };
    return statusMap[status] || 'default';
  };

  const getFlagIndicator = (report: Report) => {
    if (!report.uiIndicators) return null;

    const colorMap: Record<string, string> = {
      green: theme.colors.success,
      yellow: '#F59E0B',
      orange: '#F97316',
      red: theme.colors.error,
    };

    const color = colorMap[report.uiIndicators.color] || theme.colors.textSecondary;

    return (
      <div
        title={report.flags?.summary || 'No issues'}
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
    );
  };

  const tableColumns = [
    {
      key: 'flag',
      label: 'Flag',
      width: '60px',
      align: 'center' as const,
      render: (_: any, row: Report) => getFlagIndicator(row),
    },
    {
      key: 'orderId',
      label: 'Order ID',
      render: (value: string) => (
        <span style={{ fontWeight: theme.typography.weights.medium }}>{value}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Upload Date',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getStatusBadgeVariant(value)} />
      ),
    },
    {
      key: 'labName',
      label: 'Lab',
      render: (_: any, row: Report) => row.extractedData?.labName || '-',
    },
    {
      key: 'parameters',
      label: 'Parameters',
      align: 'center' as const,
      render: (_: any, row: Report) => row.extractedData?.results?.length || 0,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center' as const,
      width: '150px',
      render: (_: any, row: Report) => (
        <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'center' }}>
          {row.status === 'uploaded' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleProcess(row._id);
              }}
              style={{
                padding: '6px 12px',
                fontSize: theme.typography.sizes.tiny,
                fontWeight: theme.typography.weights.medium,
                fontFamily: theme.typography.fontFamily,
                backgroundColor: theme.colors.accent,
                color: theme.colors.surface,
                border: 'none',
                borderRadius: theme.radius.sm,
                cursor: 'pointer',
                transition: theme.transitions.fast,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.accentHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.accent;
              }}
            >
              Process
            </button>
          )}
          {row.status === 'ready' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/nurse/review/${row._id}`);
              }}
              style={{
                padding: '6px 12px',
                fontSize: theme.typography.sizes.tiny,
                fontWeight: theme.typography.weights.medium,
                fontFamily: theme.typography.fontFamily,
                backgroundColor: theme.colors.warning,
                color: theme.colors.surface,
                border: 'none',
                borderRadius: theme.radius.sm,
                cursor: 'pointer',
                transition: theme.transitions.fast,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Review
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${api.defaults.baseURL}/reports/${row._id}/pdf`, '_blank');
            }}
            style={{
              padding: '6px 12px',
              fontSize: theme.typography.sizes.tiny,
              fontWeight: theme.typography.weights.medium,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
              transition: theme.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.borderHover;
              e.currentTarget.style.backgroundColor = theme.colors.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.backgroundColor = theme.colors.surface;
            }}
          >
            Download
          </button>
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        padding: theme.spacing.lg,
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
        <div>
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
            Welcome back, {user?.name}!
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
            Here's your dashboard overview for today
          </p>
        </div>
        <CustomButton
          variant="primary"
          onClick={() => navigate('/nurse/upload')}
        >
          Upload New Report
        </CustomButton>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        }}
      >
        <StatCard
          title="Total Reports"
          value={stats.total}
          icon="📊"
          trend="+12%"
          color={theme.colors.accent}
        />
        <StatCard
          title="Ready for Review"
          value={stats.ready}
          icon="⏳"
          trend={stats.ready > 0 ? `${stats.ready} pending` : 'All clear'}
          color={theme.colors.warning}
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon="✓"
          trend={`${Math.round((stats.approved / (stats.total || 1)) * 100)}% approval rate`}
          color={theme.colors.success}
        />
        <StatCard
          title="Published"
          value={stats.published}
          icon="📤"
          trend={stats.published > 0 ? `${stats.published} sent to HIS` : 'None published'}
          color="#6366F1"
        />
        <StatCard
          title="Flagged"
          value={stats.flagged}
          icon="⚠"
          trend={stats.flagged > 0 ? 'Needs attention' : 'No issues'}
          color={theme.colors.error}
        />
      </div>

      {/* Alert */}
      {stats.ready > 0 && (
        <div style={{ marginBottom: theme.spacing.xl }}>
          <AlertBox
            variant="info"
            action={
              <CustomButton
                variant="secondary"
                onClick={() => navigate('/nurse/review')}
              >
                Review Now
              </CustomButton>
            }
          >
            You have {stats.ready} report{stats.ready > 1 ? 's' : ''} ready for review
          </AlertBox>
        </div>
      )}

      {/* Recent Reports Table */}
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          boxShadow: theme.shadows.md,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
          }}
        >
          <h2
            style={{
              fontSize: theme.typography.sizes.subheading,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.textPrimary,
              margin: 0,
            }}
          >
            Recent Reports
          </h2>
          <CustomButton
            variant="secondary"
            onClick={() => navigate('/nurse/reports')}
          >
            View All
          </CustomButton>
        </div>

        {loading ? (
          <LinearProgress sx={{ borderRadius: '4px' }} />
        ) : (
          <Table
            columns={tableColumns}
            data={reports.slice(0, 5)}
            onRowClick={(report) => {
              if (report.status === 'ready') {
                navigate(`/nurse/review/${report._id}`);
              }
            }}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default NurseDashboard;
