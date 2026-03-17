import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, MenuItem, Select,
  FormControl, InputLabel, IconButton, Tooltip, LinearProgress,
  CircularProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, alpha, Card, CardContent, Grid, Stack,
} from '@mui/material';
import {
  Sync as SyncIcon,
  FilterListOff as ClearFilterIcon,
  CheckCircle as CheckIcon,
  Description as DescriptionIcon,
  SyncAlt as SyncAltIcon,
  SmartDisplay as SmartDisplayIcon,
  TrendingUp as TrendingUpIcon,
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
  HealthCheckStats, HealthCheckFilterOptions, FunnelData, CugBreakdownItem,
} from '../../types/healthCheckTracking';

// ─── Design tokens ──────────────────────────────────────────────────────────
const ACCENT = { teal: '#0d9488', coral: '#ef4444', blue: '#4f46e5', purple: '#7c3aed', amber: '#f59e0b', emerald: '#10b981' };
const COLORS = ['#4f46e5', '#0AB59E', '#F5A623', '#F06050', '#06b6d4', '#8b5cf6', '#ec4899', '#22C55E', '#14b8a6', '#f97316'];
const CARD_BG = '#fdf8f6';
const CARD_SX = { bgcolor: CARD_BG, border: '1px solid #f0e8e4', borderRadius: 3, height: '100%' };

// ─── Helpers ────────────────────────────────────────────────────────────────
function pct(num: number, den: number): string {
  if (!den) return '0%';
  return `${((num / den) * 100).toFixed(1)}%`;
}

function pctNum(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Section Header (accent bar + title + subtitle) ─────────────────────────
const SectionHeader: React.FC<{ color: string; title: string; subtitle: string }> = ({ color, title, subtitle }) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ width: 40, height: 4, bgcolor: color, borderRadius: 2, mb: 1 }} />
    <Typography variant="h6" fontWeight={700}>{title}</Typography>
    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
  </Box>
);

// ─── Chart Card wrapper ─────────────────────────────────────────────────────
const ChartCard: React.FC<{
  color: string; title: string; subtitle?: string; tooltip?: string;
  children: React.ReactNode; minHeight?: number;
}> = ({ color, title, subtitle, tooltip, children, minHeight }) => (
  <Card sx={CARD_SX}>
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
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const strokeDasharray = `${(clampedValue / 100) * 251.2}, 251.2`;

  return (
    <Box sx={{ textAlign: 'center', position: 'relative' }}>
      <svg width="120" height="70" viewBox="0 0 120 70" style={{ overflow: 'visible' }}>
        {/* Background arc */}
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <Typography variant="h5" fontWeight={700} sx={{ color, mt: 0.5 }}>{clampedValue.toFixed(0)}%</Typography>
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
const HealthCheckOverview: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<HealthCheckStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean; lastSyncAt: string | null; lastSyncCount: number; recordCount: number;
  } | null>(null);
  const [filterOptions, setFilterOptions] = useState<HealthCheckFilterOptions | null>(null);

  // Filters
  const [cugCode, setCugCode] = useState('');
  const [vendorType, setVendorType] = useState('');
  const [labProvider, setLabProvider] = useState('');
  const [syncFilter, setSyncFilter] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, syncRes, filtersRes] = await Promise.all([
        api.get('/health-check-tracking/stats'),
        api.get('/health-check-tracking/sync-status'),
        api.get('/health-check-tracking/filters'),
      ]);
      setStats(statsRes.data.data);
      setSyncStatus(syncRes.data.data);
      setFilterOptions(filtersRes.data.data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/health-check-tracking/sync');
      const synced = res.data.data.synced || 0;
      enqueueSnackbar(synced === 0 ? 'No new records found' : `Sync complete: ${synced} records in ${(res.data.data.duration / 1000).toFixed(1)}s`, { variant: synced === 0 ? 'info' : 'success' });
      fetchData();
    } catch (err: any) {
      enqueueSnackbar(err.response?.data?.message || 'Sync failed', { variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const clearFilters = () => {
    setCugCode(''); setVendorType(''); setLabProvider(''); setSyncFilter('');
  };

  // ─── Derived data (null-safe) ───────────────────────────────────────────────
  const funnel: FunnelData = stats?.funnel || {
    totalBooked: stats?.totalOrders || 0, synced: stats?.syncedCount || 0, notSynced: 0,
    smartReportFromSynced: 0, digitizedFromNotSynced: 0,
    smartReportFromNotSynced: 0, totalSmartReports: 0, smartReportErrors: 0,
  };

  const syncRate = pctNum(funnel.synced, funnel.totalBooked);
  const smartReportRate = pctNum(funnel.totalSmartReports, funnel.totalBooked);

  const cugBreakdown = stats?.cugBreakdown || [];
  const srErrorsByProvider = stats?.smartReportErrorsByProvider || [];
  const vendorDist = stats?.vendorDistribution || [];
  const cugDist = stats?.cugDistribution || [];
  const statusBkdn = stats?.statusBreakdown || [];
  const relBkdn = stats?.relationshipBreakdown || [];
  const dailyTrend = stats?.dailyTrend || [];

  const cugTreemapData = cugBreakdown.map(c => ({
    name: c.cugCode, value: c.totalOrders,
  }));

  const radarData = vendorDist.slice(0, 8).map(v => ({
    subject: v.name?.length > 12 ? v.name.slice(0, 11) + '..' : v.name,
    count: v.count, fullName: v.name,
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, animation: 'fadeIn 0.35s ease-out forwards', '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
      {loading && <LinearProgress sx={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 1200 }} />}

      {/* ── Filter Bar ── */}
      <Paper sx={{
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
        borderRadius: '16px', p: '14px 20px',
        border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
      }}>
        {filterOptions && (
          <>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={{ fontSize: 13 }}>CUG Code</InputLabel>
              <Select value={cugCode} label="CUG Code" onChange={(e) => setCugCode(e.target.value)}
                sx={{ borderRadius: '8px', fontSize: 13 }}>
                <MenuItem value="">All</MenuItem>
                {filterOptions.cugCodes.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: 13 }}>Vendor Type</InputLabel>
              <Select value={vendorType} label="Vendor Type" onChange={(e) => setVendorType(e.target.value)}
                sx={{ borderRadius: '8px', fontSize: 13 }}>
                <MenuItem value="">All</MenuItem>
                {filterOptions.vendorTypes.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={{ fontSize: 13 }}>Lab Provider</InputLabel>
              <Select value={labProvider} label="Lab Provider" onChange={(e) => setLabProvider(e.target.value)}
                sx={{ borderRadius: '8px', fontSize: 13 }}>
                <MenuItem value="">All</MenuItem>
                {filterOptions.labProviders.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: 13 }}>Sync Status</InputLabel>
              <Select value={syncFilter} label="Sync Status" onChange={(e) => setSyncFilter(e.target.value)}
                sx={{ borderRadius: '8px', fontSize: 13 }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Synced</MenuItem>
                <MenuItem value="false">Not Synced</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Clear Filters">
          <IconButton onClick={clearFilters} size="small" sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', width: 36, height: 36 }}>
            <ClearFilterIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon sx={{ fontSize: 16 }} />}
          onClick={handleSync}
          disabled={syncing}
          sx={{
            height: 36, px: 2.5, borderRadius: '8px', textTransform: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)', fontWeight: 700, fontSize: 13,
            boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
            '&:hover': { opacity: 0.9 },
          }}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </Paper>

      {/* ── Glance Box (Blue Gradient) ── */}
      <Box sx={{
        borderRadius: '16px', p: '24px 28px',
        background: 'linear-gradient(135deg, #1E4088 0%, #2851A3 100%)', color: 'white',
      }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Health Check Tracking
        </Typography>
        <Typography sx={{ fontSize: 13, opacity: 0.85, mt: 0.5 }}>
          AHC order monitoring, vendor sync status, and digitization progress
        </Typography>
        {stats && (
          <>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, mt: 2.5, mb: 1.5 }}>
              AT A GLANCE
            </Typography>
            <Typography sx={{ fontSize: 13, lineHeight: 1.7, opacity: 0.92 }}>
              Tracking <strong>{stats.totalOrders.toLocaleString()}</strong> health check orders.{' '}
              <strong>{stats.integratedCount}</strong> from integrated vendors, <strong>{stats.nonIntegratedCount}</strong> non-integrated.{' '}
              <strong>{funnel.synced}</strong> synced via integrator, <strong>{funnel.totalSmartReports}</strong> smart reports generated, and <strong>{stats.digitizedCount}</strong> digitized.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {[
                { label: `Integrated: ${stats.integratedCount}`, bg: 'rgba(10,181,158,0.25)', color: '#A7F3D0' },
                { label: `Non-Integrated: ${stats.nonIntegratedCount}`, bg: 'rgba(245,166,35,0.25)', color: '#FDE68A' },
                { label: `Synced: ${funnel.synced}`, bg: 'rgba(240,96,80,0.25)', color: '#FCA5A5' },
                { label: `Smart Reports: ${funnel.totalSmartReports}`, bg: 'rgba(139,92,246,0.25)', color: '#c4b5fd' },
              ].map(pill => (
                <Box key={pill.label} sx={{ display: 'inline-flex', alignItems: 'center', px: 1.5, py: 0.5, borderRadius: 999, fontSize: 11, fontWeight: 700, bgcolor: pill.bg, color: pill.color }}>
                  {pill.label}
                </Box>
              ))}
            </Box>
          </>
        )}
        <Typography sx={{ fontSize: 11, opacity: 0.6, mt: 2 }}>
          Last synced: {formatDateTime(syncStatus?.lastSyncAt || null)} &middot; {syncStatus?.recordCount || 0} records
        </Typography>
      </Box>

      {stats && (
        <>
          {/* ── KPI Cards ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            {[
              { label: 'TOTAL HC BOOKED', value: funnel.totalBooked, color: '#4f46e5', icon: <DescriptionIcon />, sub: `${stats.integratedCount} integrated, ${stats.nonIntegratedCount} non-integrated` },
              { label: 'REPORTS SYNCED', value: funnel.synced, color: '#0AB59E', icon: <SyncAltIcon />, sub: `${pct(funnel.synced, funnel.totalBooked)} of total booked` },
              { label: 'SMART REPORTS', value: funnel.totalSmartReports, color: '#8b5cf6', icon: <SmartDisplayIcon />, sub: funnel.smartReportErrors > 0 ? `${funnel.smartReportErrors} errors detected` : 'All reports OK' },
              { label: 'DIGITIZED', value: stats.digitizedCount, color: '#F5A623', icon: <TrendingUpIcon />, sub: `${pct(stats.digitizedCount, funnel.totalBooked)} uploaded to tool` },
            ].map((kpi) => (
              <Paper key={kpi.label} sx={{
                p: 3, borderRadius: '16px', border: '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
                transition: 'all 0.15s', '&:hover': { transform: 'translateY(-1px)' },
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                      {kpi.label}
                    </Typography>
                    <Typography sx={{ fontSize: 36, fontWeight: 800, mt: 1, lineHeight: 1, letterSpacing: '-0.02em', color: kpi.color }}>
                      {kpi.value.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.5 }}>{kpi.sub}</Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(kpi.color, 0.1), color: kpi.color }}>
                    {kpi.icon}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>

          {/* ═══ SECTION: Report Processing Pipeline ═══ */}
          <SectionHeader color={ACCENT.coral} title="Report Processing Pipeline" subtitle="How are health check reports flowing through sync, digitization, and smart report generation?" />

          <Card sx={{ ...CARD_SX, mb: 0 }}>
            <CardContent sx={{ p: 3 }}>
              {/* Main pipeline */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <PipelineStep label="HC Booked" count={funnel.totalBooked} total={funnel.totalBooked} color={ACCENT.blue} showArrow={false} />
              </Box>

              {/* Branch split */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {/* Branch A: Synced Path */}
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(ACCENT.teal, 0.04), border: `1px solid ${alpha(ACCENT.teal, 0.15)}` }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: ACCENT.teal, mb: 1.5 }}>
                    Synced (Report Sync Status = Synced)
                  </Typography>
                  <Stack spacing={1.5}>
                    <PipelineStep label="Reports Synced" count={funnel.synced} total={funnel.totalBooked} color={ACCENT.teal} />
                    <PipelineStep label="Smart Report Generated" count={funnel.smartReportFromSynced} total={funnel.synced} color={ACCENT.emerald} showArrow={false} />
                  </Stack>
                </Box>

                {/* Branch B: Not Synced / Digitization Path */}
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
              </Box>

              <InsightCallout
                text={`Overall sync rate is ${pct(funnel.synced, funnel.totalBooked)}. ${funnel.totalSmartReports} smart reports generated across both paths (${pct(funnel.totalSmartReports, funnel.totalBooked)} of total).${funnel.smartReportErrors > 0 ? ` ${funnel.smartReportErrors} reports had errors.` : ''}`}
              />
            </CardContent>
          </Card>

          {/* ═══ SECTION: Lab Provider Compliance + Daily Trend ═══ */}
          <SectionHeader color={ACCENT.teal} title="Sync & Smart Report Compliance" subtitle="Sync rate and smart report generation rate by lab provider" />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {/* Lab Provider Compliance Table */}
            <ChartCard color={ACCENT.teal} title="Lab Provider Compliance"
              subtitle="Sync and SR rates per lab provider"
              tooltip="Sync Rate = synced / total orders per provider. SR Rate = successful smart reports / total orders per provider."
              minHeight={380}>
              <TableContainer sx={{ maxHeight: 340 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Lab Provider</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Orders</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Sync Rate</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">SR Rate</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 80 }}>Sync</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, minWidth: 80 }}>SR</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(stats.labProviderCompliance || []).map((lp, i) => {
                      const lpSyncRate = pctNum(lp.synced, lp.totalOrders);
                      const lpSrRate = pctNum(lp.smartReports, lp.totalOrders);
                      return (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontSize: 12, fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <GaugeChart value={syncRate} label="Overall Sync" color={syncRate >= 70 ? ACCENT.emerald : ACCENT.coral} />
                  <GaugeChart value={smartReportRate} label="Overall SR" color={smartReportRate >= 50 ? ACCENT.emerald : ACCENT.coral} />
                </Box>
              </Box>
            </ChartCard>

            {/* Daily Trend */}
            <ChartCard color={ACCENT.coral} title="Daily Order Trend"
              subtitle="Health check orders per day (last 90 days)"
              tooltip="Shows the number of health check orders placed each day. Use this to identify volume spikes and plan capacity."
              minHeight={380}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af"
                    tickFormatter={(v: string) => v ? v.slice(5) : ''} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="count" name="Orders" stroke={ACCENT.blue} fill={ACCENT.blue} fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              {dailyTrend.length > 1 && (
                <InsightCallout text={`${dailyTrend.length} days of data. Peak: ${Math.max(...dailyTrend.map(d => d.count)).toLocaleString()} orders in a single day.`} />
              )}
            </ChartCard>
          </Box>

          {/* ═══ SECTION: CUG Intelligence ═══ */}
          <SectionHeader color={ACCENT.blue} title="CUG Intelligence" subtitle="Health check volumes and smart report completion by corporate user group" />

          <Box sx={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 2 }}>
            {/* CUG Treemap */}
            <ChartCard color={ACCENT.blue} title="CUG Distribution - Treemap"
              subtitle="Relative volume of health checks per CUG"
              tooltip="Larger blocks indicate CUGs with more health check orders.">
              {cugTreemapData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <Treemap data={cugTreemapData} dataKey="value" aspectRatio={4 / 3} content={<TreemapContent />}>
                    <RechartsTooltip />
                  </Treemap>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>No data</Typography>
              )}
              {cugBreakdown.length > 0 && (
                <InsightCallout text={`${cugBreakdown[0].cugCode} leads with ${cugBreakdown[0].totalOrders.toLocaleString()} orders (${pct(cugBreakdown[0].totalOrders, funnel.totalBooked)} of total).`} />
              )}
            </ChartCard>

            {/* CUG Breakdown Table */}
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
                    {cugBreakdown.map((cug: CugBreakdownItem, i: number) => {
                      const rate = pctNum(cug.smartReports, cug.totalOrders);
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
                                borderRadius: 4, transition: 'width 0.6s ease',
                              }} />
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {cugBreakdown.length === 0 && (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </ChartCard>
          </Box>

          {/* ═══ SECTION: Provider & Distribution Analysis ═══ */}
          <SectionHeader color={ACCENT.purple} title="Provider & Distribution Analysis" subtitle="Lab provider volumes, vendor types, and smart report error distribution" />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
            {/* Lab Provider Radar */}
            <ChartCard color={ACCENT.purple} title="Lab Provider Distribution"
              subtitle="Top 8 lab providers by volume"
              tooltip="Radar chart showing the relative volume of orders across top lab providers.">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
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

            {/* Vendor Type Pie */}
            <ChartCard color={ACCENT.emerald} title="Vendor Type Split"
              subtitle="Integrated vs Non-Integrated vendors"
              tooltip="Integrated vendors have automated report sync. Non-integrated vendors require manual digitization.">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Integrated', value: stats.integratedCount },
                      { name: 'Non-Integrated', value: stats.nonIntegratedCount },
                    ]}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9CA3AF' }}
                  >
                    <Cell fill={ACCENT.emerald} />
                    <Cell fill="#D1D5DB" />
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E5E7EB' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Smart Report Status Pie */}
            <ChartCard color={ACCENT.coral} title="Smart Report Status"
              subtitle="Success vs Error vs Pending"
              tooltip="Success = smart report generated. Error = generation failed. Pending = not yet attempted.">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Success', value: funnel.totalSmartReports },
                      { name: 'Error', value: funnel.smartReportErrors },
                      { name: 'Pending', value: Math.max(0, funnel.totalBooked - funnel.totalSmartReports - funnel.smartReportErrors) },
                    ]}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9CA3AF' }}
                  >
                    <Cell fill={ACCENT.emerald} />
                    <Cell fill={ACCENT.coral} />
                    <Cell fill="#D1D5DB" />
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E5E7EB' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </Box>

          {/* ═══ Top Providers + SR Errors ═══ */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {/* Top Lab Providers horizontal bar */}
            <ChartCard color={ACCENT.blue} title="Top Lab Providers by Volume"
              subtitle="Top 10 lab providers handling health check orders"
              tooltip="Shows which lab providers are handling the most health check orders.">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorDist.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="count" name="Orders" fill={ACCENT.blue} radius={[0, 4, 4, 0]} fillOpacity={0.75} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* SR Errors by Provider */}
            <ChartCard color={ACCENT.coral} title="Smart Report Errors by Lab Provider"
              subtitle="Top providers with failed smart report generation"
              tooltip="Investigate these providers to fix smart report generation failures.">
              {srErrorsByProvider && srErrorsByProvider.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={srErrorsByProvider} layout="vertical">
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
          </Box>

          {/* ═══ Relationship & Status ═══ */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
            {/* Relationship pie */}
            <ChartCard color={ACCENT.teal} title="Relationship Distribution"
              subtitle="Self vs Dependents breakdown"
              tooltip="Shows the proportion of health checks for employees (Self) versus their dependents.">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={relBkdn} dataKey="count" cx="50%" cy="50%" outerRadius={85}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9CA3AF' }}
                  >
                    {relBkdn.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E5E7EB' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Status Breakdown */}
            <ChartCard color={ACCENT.amber} title="Order Status Breakdown"
              subtitle="Distribution of observation statuses"
              tooltip="Final = report completed and signed off. Other statuses indicate in-progress orders.">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusBkdn}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]}>
                    {statusBkdn.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* CUG Distribution pie (compact) */}
            <ChartCard color={ACCENT.purple} title="CUG Distribution"
              subtitle="Orders by corporate user group"
              tooltip="Proportion of orders across different CUGs.">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={cugDist} cx="50%" cy="50%" innerRadius={45} outerRadius={85} dataKey="count"
                    label={({ name, percent }) => (percent ?? 0) > 0.05 ? `${name}: ${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                    labelLine={{ stroke: '#9CA3AF' }}>
                    {cugDist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E5E7EB' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </Box>
        </>
      )}
    </Box>
  );
};

export default HealthCheckOverview;
