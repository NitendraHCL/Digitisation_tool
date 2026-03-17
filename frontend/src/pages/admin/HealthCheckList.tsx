import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Select,
  FormControl, InputLabel, IconButton, Tooltip, LinearProgress,
  CircularProgress, InputAdornment, Chip, Drawer, Divider, Slider,
} from '@mui/material';
import {
  Sync as SyncIcon,
  Download as DownloadIcon,
  FilterListOff as ClearFilterIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import type {
  HealthCheckRecord, HealthCheckFilters, HealthCheckFilterOptions, Pagination,
} from '../../types/healthCheckTracking';

const defaultFilters: HealthCheckFilters = {
  search: '', cugCode: '', relativeCugCode: '', vendorType: '', syncStatus: '',
  labProvider: '', status: '', reportStatus: '', smartReportStatus: '',
  relationship: '', digitizationStatus: '', packageName: '',
  dateFrom: '', dateTo: '', timeDiffMin: '', timeDiffMax: '',
};

function formatTimeDiff(ms: number | null): string {
  if (!ms) return '-';
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const columns: { key: string; label: string; width: number; align?: 'right' }[] = [
  { key: 'orderId', label: 'ORDER ID', width: 130 },
  { key: 'uhid', label: 'UHID', width: 100 },
  { key: 'labProvider', label: 'LAB PROVIDER', width: 140 },
  { key: 'vendorType', label: 'VENDOR TYPE', width: 110 },
  { key: 'orderDate', label: 'ORDER DATE', width: 110 },
  { key: 'serviceDate', label: 'SERVICE DATE', width: 110 },
  { key: 'status', label: 'STATUS', width: 80 },
  { key: 'reportStatus', label: 'REPORT STATUS', width: 120 },
  { key: 'syncStatus', label: 'REPORT SYNC STATUS', width: 130 },
  { key: 'cugCode', label: 'CUG CODE', width: 120 },
  { key: 'relativeCugCode', label: 'RELATIVE CUG', width: 130 },
  { key: 'packageName', label: 'PACKAGE', width: 200 },
  { key: 'relationship', label: 'RELATIONSHIP', width: 120 },
  { key: 'digitizationStatus', label: 'DIGITIZATION', width: 110 },
  { key: 'smartReportDate', label: 'SMARTREPORT DATE', width: 130 },
  { key: 'smartReportStatus', label: 'SR STATUS', width: 90 },
  { key: 'timeDiffMs', label: 'TIME_DIFF', width: 80, align: 'right' },
];

// Shared styles
const selectSx = { borderRadius: '8px', fontSize: 13 };
const labelSx = { fontSize: 13 };
const drawerFilterSx = { width: '100%' };

const HealthCheckList: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [records, setRecords] = useState<HealthCheckRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 });
  const [sortBy, setSortBy] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<HealthCheckFilters>(defaultFilters);
  const [filterOptions, setFilterOptions] = useState<HealthCheckFilterOptions | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Count active filters (excluding search, dateFrom, dateTo)
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([k, v]) =>
      v && k !== 'search'
    ).length;
  }, [filters]);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.page, limit: pagination.limit, sortBy, sortOrder,
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

  useEffect(() => { fetchRecords(); fetchFilterOptions(); }, [fetchRecords, fetchFilterOptions]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/health-check-tracking/sync');
      const synced = res.data.data.synced || 0;
      enqueueSnackbar(synced === 0 ? 'No new records found' : `Sync complete: ${synced} records`, { variant: synced === 0 ? 'info' : 'success' });
      fetchRecords();
      fetchFilterOptions();
    } catch (err: any) {
      enqueueSnackbar(err.response?.data?.message || 'Sync failed', { variant: 'error' });
    } finally {
      setSyncing(false);
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/health-check-tracking/export', { params });
      const data = res.data.data as HealthCheckRecord[];
      const headers = columns.map(c => c.label);
      const rows = data.map(r => columns.map(c => {
        const val = r[c.key as keyof HealthCheckRecord];
        if (c.key === 'orderDate' || c.key === 'serviceDate' || c.key === 'smartReportDate') return formatDate(val as string | null);
        if (c.key === 'syncStatus') return val ? 'Yes' : 'No';
        if (c.key === 'timeDiffMs') return formatTimeDiff(val as number | null);
        return (val ?? '') as string;
      }));
      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `health-check-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      enqueueSnackbar(`Exported ${data.length} records`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Export failed', { variant: 'error' });
    }
  };

  const renderCell = (record: HealthCheckRecord, key: string) => {
    switch (key) {
      case 'orderDate':
      case 'serviceDate':
      case 'smartReportDate':
        return formatDate(record[key as keyof HealthCheckRecord] as string | null);
      case 'status':
        if (!record.status) return <span style={{ color: '#9CA3AF' }}>-</span>;
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700,
            background: record.status === 'Final' ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
            color: record.status === 'Final' ? '#059669' : '#d97706',
          }}>
            {record.status}
          </span>
        );
      case 'vendorType':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700,
            background: record.vendorType === 'Integrated' ? 'rgba(10,181,158,0.1)' : '#F3F4F6',
            color: record.vendorType === 'Integrated' ? '#0AB59E' : '#6B7280',
          }}>
            {record.vendorType}
          </span>
        );
      case 'syncStatus':
        return record.syncStatus
          ? <CheckIcon sx={{ color: '#0AB59E', fontSize: 18 }} />
          : <CancelIcon sx={{ color: '#F06050', fontSize: 18 }} />;
      case 'digitizationStatus':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700,
            background: record.digitizationStatus === 'Uploaded' ? 'rgba(79,70,229,0.08)' : '#F3F4F6',
            color: record.digitizationStatus === 'Uploaded' ? '#4f46e5' : '#9CA3AF',
          }}>
            {record.digitizationStatus}
          </span>
        );
      case 'smartReportStatus':
        if (!record.smartReportStatus) return <span style={{ color: '#9CA3AF' }}>-</span>;
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700,
            background: record.smartReportStatus === 'Success' ? 'rgba(5,150,105,0.08)' : 'rgba(240,96,80,0.08)',
            color: record.smartReportStatus === 'Success' ? '#059669' : '#F06050',
          }}>
            {record.smartReportStatus}
          </span>
        );
      case 'timeDiffMs':
        return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTimeDiff(record.timeDiffMs)}</span>;
      default:
        return (record[key as keyof HealthCheckRecord] as string) ?? <span style={{ color: '#D1D5DB' }}>-</span>;
    }
  };

  // Render a dropdown filter inside the drawer
  const renderDropdown = (
    label: string, filterKey: keyof HealthCheckFilters, options: string[]
  ) => (
    <FormControl size="small" sx={drawerFilterSx}>
      <InputLabel sx={labelSx}>{label}</InputLabel>
      <Select value={filters[filterKey]} label={label}
        onChange={(e) => handleFilterChange(filterKey, e.target.value)}
        sx={selectSx}>
        <MenuItem value="">All</MenuItem>
        {options.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </Select>
    </FormControl>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, animation: 'fadeIn 0.35s ease-out forwards', '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
      {loading && <LinearProgress sx={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 1200 }} />}

      {/* ── Top Action Bar ── */}
      <Paper sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
        borderRadius: '16px', p: '12px 20px',
        border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
      }}>
        {/* Search */}
        <TextField
          size="small" placeholder="Search Order ID / UHID"
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} /></InputAdornment> } }}
        />

        {/* Quick filters inline */}
        {filterOptions && (
          <>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={labelSx}>CUG Code</InputLabel>
              <Select value={filters.cugCode} label="CUG Code" onChange={(e) => handleFilterChange('cugCode', e.target.value)} sx={selectSx}>
                <MenuItem value="">All</MenuItem>
                {filterOptions.cugCodes.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel sx={labelSx}>Sync</InputLabel>
              <Select value={filters.syncStatus} label="Sync" onChange={(e) => handleFilterChange('syncStatus', e.target.value)} sx={selectSx}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Synced</MenuItem>
                <MenuItem value="false">Not Synced</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel sx={labelSx}>SR Status</InputLabel>
              <Select value={filters.smartReportStatus} label="SR Status" onChange={(e) => handleFilterChange('smartReportStatus', e.target.value)} sx={selectSx}>
                <MenuItem value="">All</MenuItem>
                {filterOptions.smartReportStatuses.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <Chip
            label={`${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`}
            size="small"
            onDelete={clearFilters}
            sx={{ bgcolor: '#EEF2FF', color: '#4f46e5', fontWeight: 600, fontSize: 11, height: 28,
              '& .MuiChip-deleteIcon': { color: '#4f46e5', fontSize: 16 } }}
          />
        )}

        {/* Filter drawer toggle */}
        <Tooltip title="All Filters">
          <IconButton onClick={() => setDrawerOpen(true)} size="small"
            sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', width: 36, height: 36,
              bgcolor: drawerOpen ? '#EEF2FF' : 'transparent' }}>
            <FilterIcon sx={{ fontSize: 18, color: activeFilterCount > 0 ? '#4f46e5' : '#9CA3AF' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear Filters">
          <IconButton onClick={clearFilters} size="small" sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', width: 36, height: 36 }}>
            <ClearFilterIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Export CSV">
          <IconButton onClick={handleExport} size="small" sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', width: 36, height: 36 }}>
            <DownloadIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
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
          }}
        >
          {syncing ? 'Syncing...' : 'Sync'}
        </Button>
      </Paper>

      {/* ── Filter Drawer ── */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 360, p: 0, borderRadius: '16px 0 0 16px' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2, borderBottom: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon sx={{ fontSize: 20, color: '#4f46e5' }} />
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Filters</Typography>
              {activeFilterCount > 0 && (
                <Chip label={activeFilterCount} size="small"
                  sx={{ bgcolor: '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 11, height: 22, minWidth: 22 }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button size="small" onClick={clearFilters}
                sx={{ textTransform: 'none', fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                Reset All
              </Button>
              <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Filter sections */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {filterOptions && (
              <>
                {/* ── CUG & Organization ── */}
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', mt: 0.5 }}>
                  CUG & Organization
                </Typography>
                {renderDropdown('CUG Code', 'cugCode', filterOptions.cugCodes)}
                {renderDropdown('Relative CUG', 'relativeCugCode', filterOptions.relativeCugCodes)}
                {renderDropdown('Relationship', 'relationship', filterOptions.relationships)}

                <Divider sx={{ my: 0.5 }} />

                {/* ── Report & Status ── */}
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                  Report & Status
                </Typography>
                {renderDropdown('Status', 'status', filterOptions.statuses)}
                {renderDropdown('Report Status', 'reportStatus', filterOptions.reportStatuses)}
                <FormControl size="small" sx={drawerFilterSx}>
                  <InputLabel sx={labelSx}>Sync Status</InputLabel>
                  <Select value={filters.syncStatus} label="Sync Status"
                    onChange={(e) => handleFilterChange('syncStatus', e.target.value)} sx={selectSx}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Synced</MenuItem>
                    <MenuItem value="false">Not Synced</MenuItem>
                  </Select>
                </FormControl>
                {renderDropdown('Smart Report Status', 'smartReportStatus', filterOptions.smartReportStatuses)}
                {renderDropdown('Digitization', 'digitizationStatus', filterOptions.digitizationStatuses)}

                <Divider sx={{ my: 0.5 }} />

                {/* ── Vendor & Provider ── */}
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                  Vendor & Provider
                </Typography>
                {renderDropdown('Vendor Type', 'vendorType', filterOptions.vendorTypes)}
                {renderDropdown('Lab Provider', 'labProvider', filterOptions.labProviders)}
                {renderDropdown('Package', 'packageName', filterOptions.packageNames)}

                <Divider sx={{ my: 0.5 }} />

                {/* ── Date Range ── */}
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                  Date Range
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    size="small" type="date" label="From" value={filters.dateFrom} fullWidth
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
                    slotProps={{ inputLabel: { shrink: true, sx: labelSx } }}
                  />
                  <TextField
                    size="small" type="date" label="To" value={filters.dateTo} fullWidth
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
                    slotProps={{ inputLabel: { shrink: true, sx: labelSx } }}
                  />
                </Box>

                <Divider sx={{ my: 0.5 }} />

                {/* ── Time Difference ── */}
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                  Time Since Service (days)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    size="small" type="number" label="Min Days" value={filters.timeDiffMin} fullWidth
                    onChange={(e) => handleFilterChange('timeDiffMin', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
                    slotProps={{ inputLabel: { shrink: true, sx: labelSx }, htmlInput: { min: 0 } }}
                  />
                  <TextField
                    size="small" type="number" label="Max Days" value={filters.timeDiffMax} fullWidth
                    onChange={(e) => handleFilterChange('timeDiffMax', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: 13 } }}
                    slotProps={{ inputLabel: { shrink: true, sx: labelSx }, htmlInput: { min: 0 } }}
                  />
                </Box>
              </>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5 }}>
            <Button fullWidth variant="outlined" onClick={clearFilters}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: 13, borderColor: '#E5E7EB', color: '#6B7280' }}>
              Reset
            </Button>
            <Button fullWidth variant="contained" onClick={() => setDrawerOpen(false)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: 13,
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}>
              Apply
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* ── Data Table with Dark Header ── */}
      <Paper sx={{
        borderRadius: '16px', border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      textAlign: col.align || 'left',
                      padding: '14px 16px',
                      fontSize: 10, fontWeight: 800,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      color: '#ffffff',
                      background: i === 0 ? 'linear-gradient(135deg, #1E4088 0%, #2851A3 100%)' : '#2851A3',
                      backgroundImage: 'linear-gradient(135deg, #1E4088 0%, #2851A3 100%)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, zIndex: 2,
                      borderRadius: i === 0 ? '12px 0 0 0' : i === columns.length - 1 ? '0 12px 0 0' : 0,
                      minWidth: col.width,
                      userSelect: 'none',
                    }}
                  >
                    {col.label}
                    {sortBy === col.key && (
                      <span style={{ marginLeft: 4, opacity: 0.7 }}>
                        {sortOrder === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    {loading ? 'Loading...' : 'No records found. Try syncing or adjusting filters.'}
                  </td>
                </tr>
              ) : (
                records.map((record, ri) => (
                  <tr
                    key={record._id}
                    style={{
                      background: ri % 2 === 0 ? '#ffffff' : '#fafbfd',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2ff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ri % 2 === 0 ? '#ffffff' : '#fafbfd'; }}
                  >
                    {columns.map(col => (
                      <td key={col.key} style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid #F3F4F6',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        fontSize: 12,
                        textAlign: col.align || 'left',
                      }}>
                        {renderCell(record, col.key)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Box>

        {/* Pagination */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5, borderTop: '1px solid #E5E7EB', bgcolor: '#fafbfd',
        }}>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 70 }}>
              <Select value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                sx={{ borderRadius: '8px', fontSize: 12, height: 32 }}>
                {[10, 25, 50, 100].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <IconButton size="small" disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', width: 32, height: 32 }}>
              <KeyboardArrowLeft sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography sx={{ fontSize: 12, color: '#4B5563', mx: 0.5 }}>
              {pagination.page} / {pagination.pages}
            </Typography>
            <IconButton size="small" disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', width: 32, height: 32 }}>
              <KeyboardArrowRight sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default HealthCheckList;
