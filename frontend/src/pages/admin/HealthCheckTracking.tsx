import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Tab, Tabs, Card, CardContent, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, Paper, TextField, MenuItem, Select,
  FormControl, InputLabel, IconButton, Tooltip, LinearProgress,
  InputAdornment, Stack, CircularProgress, alpha,
} from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
  FilterListOff as ClearFilterIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  LocalHospital as HospitalIcon,
  SyncAlt as SyncAltIcon,
  Description as DescriptionIcon,
  SmartDisplay as SmartDisplayIcon,
  ArrowForward as ArrowForwardIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Treemap,
} from 'recharts';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import type {
  HealthCheckRecord, HealthCheckStats, HealthCheckFilters,
  HealthCheckFilterOptions, Pagination, FunnelData, CugBreakdownItem,
} from '../../types/healthCheckTracking';

// ─── Design tokens ──────────────────────────────────────────────────────────
const ACCENT = { teal: '#0d9488', coral: '#ef4444', blue: '#2563eb', purple: '#7c3aed', amber: '#f59e0b', emerald: '#10b981' };
const COLORS = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const CARD_BG = '#fdf8f6';

// ─── Helpers ────────────────────────────────────────────────────────────────
const defaultFilters: HealthCheckFilters = {
  search: '', cugCode: '', relativeCugCode: '', vendorType: '', syncStatus: '',
  labProvider: '', status: '', reportStatus: '', smartReportStatus: '',
  relationship: '', digitizationStatus: '', packageName: '',
  dateFrom: '', dateTo: '', timeDiffMin: '', timeDiffMax: '',
};

function formatTimeDiff(ms: number | null): string {
  if (!ms) return '-';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function pct(num: number, den: number): string {
  if (!den) return '0%';
  return `${((num / den) * 100).toFixed(1)}%`;
}
function pctNum(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}

// ─── Section Header (accent bar + title + subtitle) ─────────────────────────
const SectionHeader: React.FC<{ color: string; title: string; subtitle: string }> = ({ color, title, subtitle }) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ width: 40, height: 4, bgcolor: color, borderRadius: 2, mb: 1 }} />
    <Typography variant="h5" fontWeight={700}>{title}</Typography>
    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
  </Box>
);

// ─── Chart Card wrapper (accent bar + heading + subheading) ─────────────────
const ChartCard: React.FC<{
  color: string; title: string; subtitle?: string; tooltip?: string;
  children: React.ReactNode; minHeight?: number;
}> = ({ color, title, subtitle, tooltip, children, minHeight }) => (
  <Card sx={{ bgcolor: CARD_BG, border: '1px solid #f0e8e4', borderRadius: 3, height: '100%' }}>
    <CardContent sx={{ minHeight: minHeight || 'auto' }}>
      <Box sx={{ width: 32, height: 3, bgcolor: color, borderRadius: 2, mb: 1.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {tooltip && (
          <Tooltip title={tooltip} arrow placement="top">
            <InfoIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>
      {subtitle && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{subtitle}</Typography>}
      {children}
    </CardContent>
  </Card>
);

// ─── Insight Callout (orange accent) ────────────────────────────────────────
const InsightCallout: React.FC<{ text: string }> = ({ text }) => (
  <Box sx={{
    mt: 2, p: 1.5, borderRadius: 2,
    bgcolor: '#fef3c7', borderLeft: '3px solid #f59e0b',
  }}>
    <Typography variant="caption" color="#92400e">{text}</Typography>
  </Box>
);

// ─── Gauge (semi-circle) ────────────────────────────────────────────────────
const GaugeChart: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => {
  const rotation = Math.min(value, 100) * 1.8; // 180deg max
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ position: 'relative', width: 140, height: 75, mx: 'auto', overflow: 'hidden' }}>
        {/* Background arc */}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, width: 140, height: 140,
          borderRadius: '50%', border: '16px solid #e5e7eb',
          borderBottomColor: 'transparent', borderRightColor: 'transparent',
          transform: 'rotate(225deg)',
        }} />
        {/* Value arc */}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, width: 140, height: 140,
          borderRadius: '50%', border: '16px solid transparent',
          borderTopColor: color, borderLeftColor: rotation > 90 ? color : 'transparent',
          transform: `rotate(${225 + rotation}deg)`,
          transition: 'transform 1s ease',
        }} />
      </Box>
      <Typography variant="h5" fontWeight={700} sx={{ color, mt: 1 }}>{value.toFixed(0)}%</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
};

// ─── Pipeline Step (for funnel visualization) ───────────────────────────────
const PipelineStep: React.FC<{
  label: string; count: number; total: number; color: string; showArrow?: boolean;
}> = ({ label, count, total, color, showArrow = true }) => {
  const percentage = total ? (count / total) * 100 : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary">{label}</Typography>
          <Typography variant="caption" fontWeight={700}>{count.toLocaleString()}</Typography>
        </Box>
        <Box sx={{ position: 'relative', height: 24, bgcolor: '#f3f4f6', borderRadius: 1.5, overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${Math.max(percentage, 2)}%`,
            bgcolor: alpha(color, 0.8),
            borderRadius: 1.5,
            transition: 'width 0.8s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {percentage > 15 && (
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: 10 }}>
                {pct(count, total)}
              </Typography>
            )}
          </Box>
          {percentage <= 15 && (
            <Typography variant="caption" sx={{ position: 'absolute', left: 8, top: 4, fontWeight: 600, fontSize: 10, color }}>
              {pct(count, total)}
            </Typography>
          )}
        </Box>
      </Box>
      {showArrow && <ArrowForwardIcon sx={{ color: '#d1d5db', fontSize: 18, flexShrink: 0 }} />}
    </Box>
  );
};

// ─── Treemap custom content ─────────────────────────────────────────────────
const TreemapContent: React.FC<any> = ({ x, y, width, height, name, value, index }) => {
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={COLORS[index % COLORS.length]} fillOpacity={0.25}
        stroke={COLORS[index % COLORS.length]} strokeWidth={1.5} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#374151">
        {name?.length > 15 ? name.slice(0, 14) + '..' : name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fontSize={12} fontWeight={700} fill="#111827">
        {value}
      </text>
    </g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const HealthCheckTracking: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [stats, setStats] = useState<HealthCheckStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean; lastSyncAt: string | null; lastSyncCount: number; recordCount: number;
  } | null>(null);

  const [records, setRecords] = useState<HealthCheckRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 });
  const [sortBy, setSortBy] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<HealthCheckFilters>(defaultFilters);
  const [filterOptions, setFilterOptions] = useState<HealthCheckFilterOptions | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, syncRes] = await Promise.all([
        api.get('/health-check-tracking/stats'),
        api.get('/health-check-tracking/sync-status'),
      ]);
      setStats(statsRes.data.data);
      setSyncStatus(syncRes.data.data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.page, limit: pagination.limit,
        sortBy, sortOrder,
      };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/health-check-tracking', { params });
      setRecords(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch records:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder, filters]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await api.get('/health-check-tracking/filters');
      setFilterOptions(res.data.data);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { if (tab === 1) { fetchRecords(); fetchFilterOptions(); } }, [tab, fetchRecords, fetchFilterOptions]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/health-check-tracking/sync');
      enqueueSnackbar(`Sync complete: ${res.data.data.synced} records in ${(res.data.data.duration / 1000).toFixed(1)}s`, { variant: 'success' });
      fetchOverview();
      if (tab === 1) fetchRecords();
    } catch (err: any) {
      enqueueSnackbar(err.response?.data?.message || 'Sync failed', { variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleFilterChange = (key: keyof HealthCheckFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/health-check-tracking/export', { params });
      const data = res.data.data as HealthCheckRecord[];
      const headers = [
        'Order ID', 'UHID', 'Lab Provider', 'Order Date', 'Status', 'Report Status',
        'Vendor Type', 'Sync Status', 'CUG Name', 'CUG Code', 'Package Name',
        'Billing Status', 'Stage', 'Relationship', 'Time Diff',
        'Smart Report Date', 'Digitization Status', 'Digitization Report Status',
      ];
      const rows = data.map(r => [
        r.orderId, r.uhid, r.labProvider, formatDate(r.orderDate), r.status, r.reportStatus,
        r.vendorType, r.syncStatus ? 'Yes' : 'No', r.cugCode, r.packageName,
        r.relationship, formatTimeDiff(r.timeDiffMs),
        formatDate(r.smartReportDate), r.digitizationStatus, r.digitizationReportStatus,
      ]);
      const csvContent = [headers, ...rows].map(row =>
        row.map(cell => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `health-check-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      enqueueSnackbar(`Exported ${data.length} records`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Export failed', { variant: 'error' });
    }
  };

  // ─── Table columns ──────────────────────────────────────────────────────────
  const columns: { key: string; label: string; width?: number }[] = [
    { key: 'orderId', label: 'Order ID', width: 130 },
    { key: 'uhid', label: 'UHID', width: 110 },
    { key: 'labProvider', label: 'Lab Provider', width: 150 },
    { key: 'orderDate', label: 'Order Date', width: 110 },
    { key: 'status', label: 'Status', width: 90 },
    { key: 'reportStatus', label: 'Report Status', width: 110 },
    { key: 'vendorType', label: 'Vendor Type', width: 120 },
    { key: 'syncStatus', label: 'Sync', width: 70 },
    { key: 'stage', label: 'Stage', width: 90 },
    { key: 'cugCode', label: 'CUG Code', width: 100 },
    { key: 'packageName', label: 'Package', width: 200 },
    { key: 'relationship', label: 'Relation', width: 90 },
    { key: 'timeDiffMs', label: 'Time Diff', width: 100 },
    { key: 'smartReportDate', label: 'Smart Report', width: 110 },
    { key: 'digitizationStatus', label: 'Digitization', width: 110 },
    { key: 'digitizationReportStatus', label: 'Dig. Status', width: 110 },
  ];

  const renderCellValue = (record: HealthCheckRecord, key: string) => {
    switch (key) {
      case 'orderDate':
      case 'smartReportDate':
        return formatDate(record[key as keyof HealthCheckRecord] as string | null);
      case 'vendorType':
        return (
          <Chip
            label={record.vendorType} size="small"
            sx={{
              bgcolor: record.vendorType === 'Integrated' ? '#dcfce7' : '#f3f4f6',
              color: record.vendorType === 'Integrated' ? '#166534' : '#374151',
              fontWeight: 500,
            }}
          />
        );
      case 'syncStatus':
        return record.syncStatus
          ? <CheckIcon sx={{ color: '#10b981', fontSize: 20 }} />
          : <CancelIcon sx={{ color: '#ef4444', fontSize: 20 }} />;
      case 'timeDiffMs':
        return formatTimeDiff(record.timeDiffMs);
      case 'digitizationStatus':
        return (
          <Chip
            label={record.digitizationStatus} size="small"
            sx={{
              bgcolor: record.digitizationStatus === 'Uploaded' ? '#dbeafe' : '#fef3c7',
              color: record.digitizationStatus === 'Uploaded' ? '#1e40af' : '#92400e',
              fontWeight: 500,
            }}
          />
        );
      case 'status':
        return record.status ? (
          <Chip
            label={record.status} size="small"
            sx={{
              bgcolor: record.status === 'Final' ? '#dcfce7' : '#fef3c7',
              color: record.status === 'Final' ? '#166534' : '#92400e',
              fontWeight: 500,
            }}
          />
        ) : '-';
      default:
        return (record[key as keyof HealthCheckRecord] as string) ?? '-';
    }
  };

  // ─── Derived data for charts ────────────────────────────────────────────────
  const funnel: FunnelData = stats?.funnel || {
    totalBooked: 0, synced: 0, notSynced: 0,
    smartReportFromSynced: 0, digitizedFromNotSynced: 0,
    smartReportFromNotSynced: 0, totalSmartReports: 0, smartReportErrors: 0,
  };

  const syncRate = funnel.totalBooked ? (funnel.synced / funnel.totalBooked) * 100 : 0;
  const smartReportRate = funnel.totalBooked ? (funnel.totalSmartReports / funnel.totalBooked) * 100 : 0;

  // CUG treemap data
  const cugTreemapData = (stats?.cugBreakdown || []).map(c => ({
    name: c.cugCode,
    value: c.totalOrders,
  }));

  // Lab provider radar data (top 8)
  const radarData = (stats?.vendorDistribution || []).slice(0, 8).map(v => ({
    subject: v.name?.length > 12 ? v.name.slice(0, 11) + '..' : v.name,
    count: v.count,
    fullName: v.name,
  }));

  return (
    <Box>
      {/* ═══ Header ═══ */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Health Check Tracking</Typography>
          <Typography variant="body2" color="text.secondary">
            {syncStatus?.lastSyncAt
              ? `Last synced: ${formatDateTime(syncStatus.lastSyncAt)} (${syncStatus.recordCount} records)`
              : 'Not synced yet'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : <SyncIcon />}
          onClick={handleSync}
          disabled={syncing}
          sx={{ bgcolor: '#1E4088' }}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="List" />
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 0: OVERVIEW                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 0 && stats && (
        <Box>

          {/* ─── SECTION 1: Hero KPI Cards ─────────────────────────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            {[
              {
                title: 'TOTAL HC BOOKED', value: funnel.totalBooked,
                icon: <DescriptionIcon />, color: ACCENT.blue,
                sub: `${stats.integratedCount} integrated, ${stats.nonIntegratedCount} non-integrated`,
              },
              {
                title: 'REPORTS SYNCED', value: funnel.synced,
                icon: <SyncAltIcon />, color: ACCENT.teal,
                sub: `${pct(funnel.synced, funnel.totalBooked)} of total booked`,
              },
              {
                title: 'SMART REPORTS', value: funnel.totalSmartReports,
                icon: <SmartDisplayIcon />, color: ACCENT.purple,
                sub: funnel.smartReportErrors > 0
                  ? `${funnel.smartReportErrors} errors detected`
                  : 'All reports generated successfully',
              },
              {
                title: 'DIGITIZED', value: stats.digitizedCount,
                icon: <TrendingUpIcon />, color: ACCENT.amber,
                sub: `${pct(stats.digitizedCount, funnel.totalBooked)} uploaded to tool`,
              },
            ].map((card, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                <Card sx={{
                  bgcolor: '#fff', border: '1px solid #f0e8e4', borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
                }}>
                  <CardContent sx={{ py: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1 }}>
                          {card.title}
                        </Typography>
                        <Typography variant="h3" fontWeight={700} sx={{ my: 0.5 }}>
                          {card.value.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
                      </Box>
                      <Box sx={{
                        p: 1, borderRadius: 2,
                        bgcolor: alpha(card.color, 0.1), color: card.color,
                      }}>
                        {card.icon}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ─── SECTION 2: Resolution Pipeline (funnel) ───────────────────── */}
          <SectionHeader color={ACCENT.coral} title="Report Processing Pipeline" subtitle="How are health check reports flowing through sync, digitization, and smart report generation?" />

          <Card sx={{ bgcolor: CARD_BG, border: '1px solid #f0e8e4', borderRadius: 3, mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
              {/* Main pipeline */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <PipelineStep label="HC Booked" count={funnel.totalBooked} total={funnel.totalBooked} color={ACCENT.blue} showArrow={false} />
              </Box>

              {/* Branch split */}
              <Grid container spacing={3}>
                {/* Branch A: Synced Path */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(ACCENT.teal, 0.04), border: `1px solid ${alpha(ACCENT.teal, 0.15)}` }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: ACCENT.teal, mb: 1.5 }}>
                      Synced (Report Sync Status = Synced)
                    </Typography>
                    <Stack spacing={1.5}>
                      <PipelineStep label="Reports Synced" count={funnel.synced} total={funnel.totalBooked} color={ACCENT.teal} />
                      <PipelineStep label="Smart Report Generated" count={funnel.smartReportFromSynced} total={funnel.synced} color={ACCENT.emerald} showArrow={false} />
                    </Stack>
                  </Box>
                </Grid>

                {/* Branch B: Not Synced / Digitization Path */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(ACCENT.amber, 0.04), border: `1px solid ${alpha(ACCENT.amber, 0.15)}` }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#b45309', mb: 1.5 }}>
                      Not Synced (Report Sync Status != Synced)
                    </Typography>
                    <Stack spacing={1.5}>
                      <PipelineStep label="Not Synced" count={funnel.notSynced} total={funnel.totalBooked} color={ACCENT.amber} />
                      <PipelineStep label="Digitized (Processed)" count={funnel.digitizedFromNotSynced} total={funnel.notSynced} color="#ea580c" />
                      <PipelineStep label="Smart Report Generated" count={funnel.smartReportFromNotSynced} total={funnel.notSynced} color="#c2410c" showArrow={false} />
                    </Stack>
                  </Box>
                </Grid>
              </Grid>

              <InsightCallout
                text={`Overall sync rate is ${pct(funnel.synced, funnel.totalBooked)}. ${funnel.totalSmartReports} smart reports generated across both paths (${pct(funnel.totalSmartReports, funnel.totalBooked)} of total).${funnel.smartReportErrors > 0 ? ` ${funnel.smartReportErrors} reports had errors.` : ''}`}
              />
            </CardContent>
          </Card>

          {/* ─── SECTION 3: Lab Provider Compliance + Daily Trend ────────────────── */}
          <SectionHeader color={ACCENT.teal} title="Sync & Smart Report Compliance" subtitle="Sync rate and smart report generation rate by lab provider" />

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Lab Provider Compliance Table */}
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard color={ACCENT.teal} title="Lab Provider Compliance"
                subtitle="Sync and SR rates per lab provider"
                tooltip="Sync Rate = synced / total orders per provider. SR Rate = successful smart reports / total orders per provider."
                minHeight={380}>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Lab Provider</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Orders</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Sync Rate</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">SR Rate</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 70 }}>Sync</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 70 }}>SR</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(stats.labProviderCompliance || []).map((lp, i) => {
                        const lpSyncRate = pctNum(lp.synced, lp.totalOrders);
                        const lpSrRate = pctNum(lp.smartReports, lp.totalOrders);
                        return (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontSize: 12, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lp.labProvider}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{lp.totalOrders}</TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: lpSyncRate >= 70 ? ACCENT.emerald : lpSyncRate >= 40 ? ACCENT.amber : ACCENT.coral }}>
                              {lpSyncRate.toFixed(1)}%
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: lpSrRate >= 50 ? ACCENT.emerald : lpSrRate >= 25 ? ACCENT.amber : ACCENT.coral }}>
                              {lpSrRate.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              <Box sx={{ position: 'relative', height: 8, bgcolor: '#f3f4f6', borderRadius: 4 }}>
                                <Box sx={{
                                  position: 'absolute', left: 0, top: 0, bottom: 0,
                                  width: `${Math.min(lpSyncRate, 100)}%`,
                                  bgcolor: lpSyncRate >= 70 ? ACCENT.emerald : lpSyncRate >= 40 ? ACCENT.amber : ACCENT.coral,
                                  borderRadius: 4, transition: 'width 0.6s ease',
                                }} />
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ position: 'relative', height: 8, bgcolor: '#f3f4f6', borderRadius: 4 }}>
                                <Box sx={{
                                  position: 'absolute', left: 0, top: 0, bottom: 0,
                                  width: `${Math.min(lpSrRate, 100)}%`,
                                  bgcolor: lpSrRate >= 50 ? ACCENT.emerald : lpSrRate >= 25 ? ACCENT.amber : ACCENT.coral,
                                  borderRadius: 4, transition: 'width 0.6s ease',
                                }} />
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!stats.labProviderCompliance || stats.labProviderCompliance.length === 0) && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
                  <GaugeChart value={syncRate} label="Overall Sync" color={syncRate >= 70 ? ACCENT.emerald : ACCENT.coral} />
                  <GaugeChart value={smartReportRate} label="Overall SR" color={smartReportRate >= 50 ? ACCENT.emerald : ACCENT.coral} />
                </Box>
              </ChartCard>
            </Grid>

            {/* Daily Trend */}
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard color={ACCENT.coral} title="Daily Order Trend"
                subtitle="Health check orders per day (last 90 days)"
                tooltip="Shows the number of health check orders placed each day. Use this to identify volume spikes and plan capacity."
                minHeight={380}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={stats.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af"
                      tickFormatter={(v: string) => v ? v.slice(5) : ''} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="count" name="Orders" stroke={ACCENT.blue} fill={ACCENT.blue} fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                {stats.dailyTrend.length > 1 && (
                  <InsightCallout text={`${stats.dailyTrend.length} days of data. Peak: ${Math.max(...stats.dailyTrend.map(d => d.count)).toLocaleString()} orders in a single day.`} />
                )}
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── SECTION 4: CUG Intelligence ───────────────────────────────── */}
          <SectionHeader color={ACCENT.blue} title="CUG Intelligence" subtitle="Health check volumes and smart report completion by corporate user group" />

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* CUG Treemap */}
            <Grid size={{ xs: 12, md: 5 }}>
              <ChartCard color={ACCENT.blue} title="CUG Distribution - Treemap"
                subtitle="Relative volume of health checks per CUG"
                tooltip="Larger blocks indicate CUGs with more health check orders. Hover for exact counts.">
                {cugTreemapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <Treemap
                      data={cugTreemapData}
                      dataKey="value"
                      aspectRatio={4 / 3}
                      content={<TreemapContent />}
                    >
                      <RechartsTooltip />
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>No data</Typography>
                )}
                {stats.cugBreakdown.length > 0 && (
                  <InsightCallout text={`${stats.cugBreakdown[0].cugCode} leads with ${stats.cugBreakdown[0].totalOrders.toLocaleString()} orders (${pct(stats.cugBreakdown[0].totalOrders, funnel.totalBooked)} of total).`} />
                )}
              </ChartCard>
            </Grid>

            {/* CUG Breakdown Table */}
            <Grid size={{ xs: 12, md: 7 }}>
              <ChartCard color={ACCENT.blue} title="CUG-Level Breakdown"
                subtitle="Health checks, sync rate, and smart report completion per CUG"
                tooltip="SR Rate = Smart Reports / Total Orders for each CUG. Higher is better.">
                <TableContainer sx={{ maxHeight: 340 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>CUG Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">HC</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Synced</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Smart Reports</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">SR Rate</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 100 }}>Progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.cugBreakdown.map((cug: CugBreakdownItem, i: number) => {
                        const rate = cug.totalOrders ? (cug.smartReports / cug.totalOrders) * 100 : 0;
                        return (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontSize: 12 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{cug.cugCode}</Typography>
                              <Typography variant="caption" color="text.secondary">{cug.cugCode}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{cug.totalOrders}</TableCell>
                            <TableCell align="right" sx={{ fontSize: 12 }}>{cug.synced}</TableCell>
                            <TableCell align="right" sx={{ fontSize: 12 }}>{cug.smartReports}</TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: rate >= 70 ? ACCENT.emerald : rate >= 30 ? ACCENT.amber : ACCENT.coral }}>
                              {rate.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              <Box sx={{ position: 'relative', height: 8, bgcolor: '#f3f4f6', borderRadius: 4 }}>
                                <Box sx={{
                                  position: 'absolute', left: 0, top: 0, bottom: 0,
                                  width: `${Math.min(rate, 100)}%`,
                                  bgcolor: rate >= 70 ? ACCENT.emerald : rate >= 30 ? ACCENT.amber : ACCENT.coral,
                                  borderRadius: 4,
                                  transition: 'width 0.6s ease',
                                }} />
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {stats.cugBreakdown.length === 0 && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── SECTION 5: Provider & Distribution Analysis ───────────────── */}
          <SectionHeader color={ACCENT.purple} title="Provider & Distribution Analysis" subtitle="Lab provider volumes, vendor types, and smart report error distribution" />

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Lab Provider Radar */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChartCard color={ACCENT.purple} title="Lab Provider Distribution"
                subtitle="Top 8 lab providers by volume"
                tooltip="Radar chart showing the relative volume of orders across top lab providers.">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      {/* @ts-ignore recharts type issue */}
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} />
                      <Radar name="Orders" dataKey="count" stroke={ACCENT.purple} fill={ACCENT.purple} fillOpacity={0.25} strokeWidth={2} />
                      <RechartsTooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>No data</Typography>
                )}
              </ChartCard>
            </Grid>

            {/* Vendor Type Pie */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChartCard color={ACCENT.emerald} title="Vendor Type Split"
                subtitle="Integrated vs Non-Integrated vendors"
                tooltip="Integrated vendors have automated report sync. Non-integrated vendors require manual digitization.">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Integrated', value: stats.integratedCount },
                        { name: 'Non-Integrated', value: stats.nonIntegratedCount },
                      ]}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      dataKey="value" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      <Cell fill={ACCENT.emerald} />
                      <Cell fill="#d1d5db" />
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>

            {/* Smart Report Status Pie */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChartCard color={ACCENT.coral} title="Smart Report Status"
                subtitle="Success vs Error vs Pending"
                tooltip="Success = smart report generated. Error = generation failed. Pending = not yet attempted or no data.">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Success', value: funnel.totalSmartReports },
                        { name: 'Error', value: funnel.smartReportErrors },
                        { name: 'Pending', value: Math.max(0, funnel.totalBooked - funnel.totalSmartReports - funnel.smartReportErrors) },
                      ]}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      dataKey="value" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      <Cell fill={ACCENT.emerald} />
                      <Cell fill={ACCENT.coral} />
                      <Cell fill="#d1d5db" />
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── SECTION 6: Top Lab Providers + SR Errors by Provider ──────── */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Top Lab Providers horizontal bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard color={ACCENT.blue} title="Top Lab Providers by Volume"
                subtitle="Horizontal bar of top 10 lab providers"
                tooltip="Shows which lab providers are handling the most health check orders.">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.vendorDistribution.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="count" name="Orders" fill={ACCENT.blue} radius={[0, 4, 4, 0]} fillOpacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>

            {/* SR Errors by Provider */}
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard color={ACCENT.coral} title="Smart Report Errors by Lab Provider"
                subtitle="Top providers with failed smart report generation"
                tooltip="Investigate these providers to fix smart report generation failures.">
                {stats.smartReportErrorsByProvider.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.smartReportErrorsByProvider} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis type="category" dataKey="provider" width={120} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" name="Errors" fill={ACCENT.coral} radius={[0, 4, 4, 0]} fillOpacity={0.75} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <CheckIcon sx={{ fontSize: 48, color: ACCENT.emerald, mb: 1 }} />
                    <Typography color="text.secondary">No smart report errors detected</Typography>
                  </Box>
                )}
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── SECTION 7: Relationship & Status Breakdown ────────────────── */}
          <Grid container spacing={3}>
            {/* Relationship pie */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChartCard color={ACCENT.teal} title="Relationship Distribution"
                subtitle="Self vs Dependents breakdown"
                tooltip="Shows the proportion of health checks for employees (Self) versus their dependents.">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.relationshipBreakdown}
                      dataKey="count" cx="50%" cy="50%" outerRadius={90}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {stats.relationshipBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>

            {/* Status Breakdown */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChartCard color={ACCENT.amber} title="Order Status Breakdown"
                subtitle="Distribution of observation statuses"
                tooltip="Final = report completed and signed off. Other statuses indicate in-progress orders.">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.statusBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]}>
                      {stats.statusBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>

            {/* Billing Status */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChartCard color={ACCENT.purple} title="Billing Stage Overview"
                subtitle="Where orders are in the billing lifecycle"
                tooltip="Shows the distribution of orders across different billing stages.">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.statusBreakdown.filter(s => s.name !== 'Unknown')}
                      dataKey="count" cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {stats.statusBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: LIST                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 1 && (
        <Box>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth size="small" placeholder="Search Order ID / UHID"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                />
              </Grid>
              {filterOptions && (
                <>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>CUG Code</InputLabel>
                      <Select value={filters.cugCode} label="CUG Code" onChange={(e) => handleFilterChange('cugCode', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        {filterOptions.cugCodes.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Vendor Type</InputLabel>
                      <Select value={filters.vendorType} label="Vendor Type" onChange={(e) => handleFilterChange('vendorType', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        {filterOptions.vendorTypes.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sync Status</InputLabel>
                      <Select value={filters.syncStatus} label="Sync Status" onChange={(e) => handleFilterChange('syncStatus', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="true">Synced</MenuItem>
                        <MenuItem value="false">Not Synced</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Lab Provider</InputLabel>
                      <Select value={filters.labProvider} label="Lab Provider" onChange={(e) => handleFilterChange('labProvider', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        {filterOptions.labProviders.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select value={filters.status} label="Status" onChange={(e) => handleFilterChange('status', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        {filterOptions.statuses.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Report Status</InputLabel>
                      <Select value={filters.reportStatus} label="Report Status" onChange={(e) => handleFilterChange('reportStatus', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        {(filterOptions.reportStatuses || []).map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Relationship</InputLabel>
                      <Select value={filters.relationship} label="Relationship" onChange={(e) => handleFilterChange('relationship', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        {filterOptions.relationships.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Digitization</InputLabel>
                      <Select value={filters.digitizationStatus} label="Digitization" onChange={(e) => handleFilterChange('digitizationStatus', e.target.value)}>
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="Uploaded">Uploaded</MenuItem>
                        <MenuItem value="Not Uploaded">Not Uploaded</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <TextField
                      fullWidth size="small" type="date" label="From"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                    <TextField
                      fullWidth size="small" type="date" label="To"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                </>
              )}
              <Grid size={{ xs: 12, sm: 'auto' }}>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Clear Filters">
                    <IconButton onClick={clearFilters} size="small"><ClearFilterIcon /></IconButton>
                  </Tooltip>
                  <Button variant="outlined" startIcon={<DownloadIcon />} size="small" onClick={handleExport}>
                    Export
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 380px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {columns.map(col => (
                    <TableCell key={col.key} sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: col.width }}>
                      <TableSortLabel
                        active={sortBy === col.key}
                        direction={sortBy === col.key ? sortOrder : 'asc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {loading ? 'Loading...' : 'No records found. Try syncing or adjusting filters.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record._id} hover>
                      {columns.map(col => (
                        <TableCell key={col.key} sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {renderCellValue(record, col.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.page - 1}
            onPageChange={(_, p) => setPagination(prev => ({ ...prev, page: p + 1 }))}
            rowsPerPage={pagination.limit}
            onRowsPerPageChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Box>
      )}
    </Box>
  );
};

export default HealthCheckTracking;
