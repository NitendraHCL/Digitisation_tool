import React, { useState, useEffect } from 'react';
import { LinearProgress, Tooltip } from '@mui/material';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { ParameterSuggestion, ExclusionSuggestion, CombinedRequest, SuggestionStatus } from '../../types';
import { format } from 'date-fns';
import { theme } from '../../styles/theme';
import StatCard from '../../components/ui/StatCard';
import SearchInput from '../../components/ui/SearchInput';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const MyRequests: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [requests, setRequests] = useState<CombinedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'all'>('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      // Fetch both parameter suggestions and exclusion suggestions
      const [paramResponse, exclusionResponse] = await Promise.all([
        api.get('/parameter-suggestions'),
        api.get('/exclusion-suggestions'),
      ]);

      const paramSuggestions: ParameterSuggestion[] = paramResponse.data.data || [];
      const exclusionSuggestions: ExclusionSuggestion[] = exclusionResponse.data.data || [];

      // Transform parameter suggestions to combined format
      const paramRequests: CombinedRequest[] = paramSuggestions.map((s: any) => ({
        _id: s._id,
        type: 'parameter' as const,
        parameterName: s.suggestedParameter,
        action: getParameterAction(s.action),
        details: getParameterDetails(s),
        reason: s.reason,
        status: s.status,
        reviewNotes: s.reviewNotes,
        reviewedBy: s.reviewedBy ? { name: s.reviewedBy.name } : undefined,
        reviewedAt: s.reviewedAt,
        createdAt: s.createdAt,
      }));

      // Transform exclusion suggestions to combined format
      const exclusionRequests: CombinedRequest[] = exclusionSuggestions.map((s: any) => ({
        _id: s._id,
        type: 'exclusion' as const,
        parameterName: s.suggestedParameter,
        action: s.suggestedUnit ? 'Exclude Unit' : 'Exclude Parameter',
        details: s.suggestedUnit ? `Unit: ${s.suggestedUnit}` : 'Entire parameter',
        reason: s.reason,
        status: s.status,
        reviewNotes: s.reviewNotes,
        reviewedBy: s.reviewedBy ? { name: s.reviewedBy.name } : undefined,
        reviewedAt: s.reviewedAt,
        createdAt: s.createdAt,
      }));

      // Combine and sort by date (newest first)
      const allRequests = [...paramRequests, ...exclusionRequests].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRequests(allRequests);

      // Calculate stats
      setStats({
        total: allRequests.length,
        pending: allRequests.filter((r) => r.status === 'pending').length,
        approved: allRequests.filter((r) => r.status === 'approved').length,
        rejected: allRequests.filter((r) => r.status === 'rejected').length,
      });
    } catch (error) {
      enqueueSnackbar('Failed to fetch requests', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getParameterAction = (action: string): string => {
    switch (action) {
      case 'create':
        return 'New Parameter';
      case 'update_alias':
        return 'Add Alias';
      case 'update_unit':
        return 'Unit Conversion';
      default:
        return action;
    }
  };

  const getParameterDetails = (s: any): string => {
    switch (s.action) {
      case 'create':
        return s.suggestedUnit ? `Unit: ${s.suggestedUnit}` : 'New parameter request';
      case 'update_alias':
        return s.targetParameterName ? `Target: ${s.targetParameterName}` : 'Alias request';
      case 'update_unit':
        return s.suggestedUnit ? `Convert to: ${s.suggestedUnit}` : 'Unit conversion';
      default:
        return '-';
    }
  };

  const getStatusBadgeVariant = (status: SuggestionStatus): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getTypeBadgeVariant = (type: 'parameter' | 'exclusion'): 'info' | 'default' => {
    return type === 'parameter' ? 'info' : 'default';
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      searchTerm === '' ||
      request.parameterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const paginatedRequests = filteredRequests.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage);

  const tableColumns = [
    {
      key: 'type',
      label: 'Type',
      width: '120px',
      render: (value: 'parameter' | 'exclusion') => (
        <Badge
          label={value === 'parameter' ? 'Parameter' : 'Exclusion'}
          variant={getTypeBadgeVariant(value)}
        />
      ),
    },
    {
      key: 'parameterName',
      label: 'Parameter',
      render: (value: string) => (
        <span style={{ fontWeight: theme.typography.weights.medium }}>{value}</span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (value: string) => (
        <span style={{ color: theme.colors.textSecondary }}>{value}</span>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      render: (value: string) => (
        <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.sizes.small }}>
          {value}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      render: (value: string) => (
        <span style={{ color: theme.colors.textSecondary }}>
          {format(new Date(value), 'MMM dd, yyyy')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: SuggestionStatus) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={getStatusBadgeVariant(value)}
        />
      ),
    },
    {
      key: 'reviewNotes',
      label: 'Admin Comments',
      render: (value: string | undefined, row: CombinedRequest) => (
        <div>
          {value ? (
            <Tooltip title={value} placement="top">
              <span
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.sizes.small,
                  cursor: 'help',
                  maxWidth: '200px',
                  display: 'inline-block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {value}
              </span>
            </Tooltip>
          ) : (
            <span style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>
              {row.status === 'pending' ? 'Awaiting review' : '-'}
            </span>
          )}
        </div>
      ),
    },
  ];

  const statusFilterOptions: { value: SuggestionStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
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
            My Requests
          </h1>
          <p
            style={{
              fontSize: theme.typography.sizes.body,
              color: theme.colors.textSecondary,
              margin: 0,
            }}
          >
            Track your parameter and exclusion requests
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        }}
      >
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon="📋"
          trend={`${stats.total} submitted`}
          color={theme.colors.accent}
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon="⏳"
          trend={stats.pending > 0 ? 'Awaiting review' : 'None pending'}
          color={theme.colors.warning}
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon="✓"
          trend={stats.approved > 0 ? `${Math.round((stats.approved / (stats.total || 1)) * 100)}% approved` : 'None yet'}
          color={theme.colors.success}
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon="✗"
          trend={stats.rejected > 0 ? `${stats.rejected} rejected` : 'None rejected'}
          color={theme.colors.error}
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
        {/* Filters */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: theme.spacing.md,
            borderBottom: `1px solid ${theme.colors.border}`,
            gap: theme.spacing.md,
            flexWrap: 'wrap',
          }}
        >
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: theme.spacing.xs }}>
            {statusFilterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  setPage(1);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: theme.typography.sizes.small,
                  fontFamily: theme.typography.fontFamily,
                  fontWeight:
                    statusFilter === option.value
                      ? theme.typography.weights.semibold
                      : theme.typography.weights.normal,
                  backgroundColor:
                    statusFilter === option.value ? theme.colors.accent : theme.colors.surface,
                  color: statusFilter === option.value ? '#fff' : theme.colors.textPrimary,
                  border: `1px solid ${
                    statusFilter === option.value ? theme.colors.accent : theme.colors.border
                  }`,
                  borderRadius: theme.radius.sm,
                  cursor: 'pointer',
                  transition: theme.transitions.fast,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <SearchInput
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            placeholder="Search by parameter, action..."
          />
        </div>

        {/* Table */}
        {loading ? (
          <LinearProgress sx={{ borderRadius: '4px' }} />
        ) : (
          <>
            <div style={{ padding: theme.spacing.md }}>
              {filteredRequests.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: theme.spacing.xl,
                    color: theme.colors.textSecondary,
                  }}
                >
                  <p style={{ fontSize: theme.typography.sizes.subheading, margin: 0 }}>
                    No requests found
                  </p>
                  <p style={{ fontSize: theme.typography.sizes.small, marginTop: theme.spacing.xs }}>
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'You haven\'t submitted any requests yet'}
                  </p>
                </div>
              ) : (
                <Table columns={tableColumns} data={paginatedRequests} loading={loading} />
              )}
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
                  {Math.min(page * rowsPerPage, filteredRequests.length)} of{' '}
                  {filteredRequests.length} entries
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

export default MyRequests;
