import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  LinearProgress,
  useTheme,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Chip,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People as PeopleIcon,
  Assessment as ReportsIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Schedule as ProcessingIcon,
  Warning as FlagIcon,
  Refresh as RefreshIcon,
  CloudUpload as UploadIcon,
  Speed as SpeedIcon,
  Science as LabIcon,
  Timeline as TimelineIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  totalReports: number;
  totalUsers: number;
  processingTime: number;
  accuracyRate: number;
  reportsByStatus: {
    uploaded: number;
    processing: number;
    ready: number;
    approved: number;
    rejected: number;
  };
  recentActivity: {
    date: string;
    total: number;
    approved: number;
    rejected: number;
  }[];
  topUsers: {
    name: string;
    email: string;
    role: string;
    totalUploads: number;
    processed: number;
  }[];
  labDistribution: {
    name: string;
    count: number;
    percentage: number;
    color?: string;
  }[];
  trends: {
    totalReports: number;
    activeUsers: number;
    processingTime: number;
    approvalRate: number;
  };
}

const AdminDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7days');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Map timeRange to backend range parameter
      const rangeMap: Record<string, string> = {
        '24hours': 'today',
        '7days': 'week',
        '30days': 'month',
        '90days': 'year'
      };
      const backendRange = rangeMap[timeRange] || 'week';

      // Fetch stats and metrics in parallel
      const [statsResponse, metricsResponse] = await Promise.all([
        api.get(`/dashboard/stats?range=${backendRange}`),
        api.get('/dashboard/metrics?days=7')
      ]);

      const statsData = statsResponse.data.data;
      const metricsData = metricsResponse.data.data;

      // Map backend data to frontend interface
      const dashboardStats: DashboardStats = {
        totalReports: statsData.overview.totalReports,
        totalUsers: statsData.users.total,
        processingTime: statsData.processingTime.avgTime,
        accuracyRate: statsData.overview.approvalRate,
        reportsByStatus: {
          uploaded: statsData.status.uploaded,
          processing: statsData.status.processing,
          ready: statsData.status.ready,
          approved: statsData.status.approved,
          rejected: statsData.status.rejected,
        },
        recentActivity: metricsData.dailyReports.map((day: any) => ({
          date: format(new Date(day.date), 'MMM dd'),
          total: day.total,
          approved: day.approved,
          rejected: day.rejected,
        })),
        topUsers: metricsData.userPerformance.map((user: any) => ({
          name: user.name,
          email: user.email,
          role: user.role,
          totalUploads: user.totalUploads,
          processed: user.processed,
        })),
        labDistribution: statsData.labDistribution.map((lab: any, index: number) => {
          const colors = [
            theme.palette.primary.main,
            theme.palette.secondary.main,
            theme.palette.success.main,
            theme.palette.warning.main,
            theme.palette.info.main,
            theme.palette.grey[500],
          ];
          return {
            name: lab.name,
            count: lab.count,
            percentage: lab.percentage,
            color: colors[index % colors.length],
          };
        }),
        trends: statsData.trends,
      };

      setStats(dashboardStats);
    } catch (error: any) {
      console.error('Dashboard data fetch error:', error);
      enqueueSnackbar(
        error?.response?.data?.message || 'Failed to fetch dashboard data',
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value);
  };

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }

  const formatTrendValue = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const statCards = [
    {
      title: 'Total Reports',
      value: stats?.totalReports || 0,
      change: stats?.trends ? formatTrendValue(stats.trends.totalReports) : '+0%',
      trend: (stats?.trends?.totalReports || 0) >= 0 ? 'up' : 'down',
      icon: <ReportsIcon />,
      color: theme.palette.primary.main,
    },
    {
      title: 'Active Users',
      value: stats?.totalUsers || 0,
      change: stats?.trends ? formatTrendValue(stats.trends.activeUsers) : '+0%',
      trend: (stats?.trends?.activeUsers || 0) >= 0 ? 'up' : 'down',
      icon: <PeopleIcon />,
      color: theme.palette.secondary.main,
    },
    {
      title: 'Avg Processing Time',
      value: `${Math.round(stats?.processingTime || 0)}s`,
      change: stats?.trends ? formatTrendValue(stats.trends.processingTime) : '+0%',
      trend: (stats?.trends?.processingTime || 0) <= 0 ? 'up' : 'down', // Lower is better for processing time
      icon: <SpeedIcon />,
      color: theme.palette.success.main,
    },
    {
      title: 'Accuracy Rate',
      value: `${stats?.accuracyRate || 0}%`,
      change: stats?.trends ? formatTrendValue(stats.trends.approvalRate) : '+0%',
      trend: (stats?.trends?.approvalRate || 0) >= 0 ? 'up' : 'down',
      icon: <TimelineIcon />,
      color: theme.palette.info.main,
    },
  ];

  const pieData = stats ? Object.entries(stats.reportsByStatus).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
  })) : [];

  const pieColors = [
    theme.palette.grey[400],
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.success.main,
    theme.palette.error.main,
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            System overview and analytics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              displayEmpty
            >
              <MenuItem value="24hours">24 Hours</MenuItem>
              <MenuItem value="7days">7 Days</MenuItem>
              <MenuItem value="30days">30 Days</MenuItem>
              <MenuItem value="90days">90 Days</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon className={refreshing ? 'spinning' : ''} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                      {stat.value}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {stat.trend === 'up' ? (
                        <TrendingUp sx={{ fontSize: 16, color: theme.palette.success.main }} />
                      ) : (
                        <TrendingDown sx={{ fontSize: 16, color: theme.palette.success.main }} />
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          color: stat.trend === 'up' ? theme.palette.success.main : theme.palette.error.main,
                        }}
                      >
                        {stat.change}
                      </Typography>
                    </Box>
                  </Box>
                  <Avatar sx={{ bgcolor: `${stat.color}20`, color: stat.color, width: 56, height: 56 }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Report Activity Trend
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={stats?.recentActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="date" stroke={theme.palette.text.secondary} />
                <YAxis stroke={theme.palette.text.secondary} />
                <ChartTooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total Reports"
                  stackId="1"
                  stroke={theme.palette.primary.main}
                  fill={theme.palette.primary.light}
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Approved"
                  stackId="2"
                  stroke={theme.palette.success.main}
                  fill={theme.palette.success.light}
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  name="Rejected"
                  stackId="2"
                  stroke={theme.palette.error.main}
                  fill={theme.palette.error.light}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Report Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Lab Distribution Chart */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Lab Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={stats?.labDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="count"
                  label={(entry) => entry.name}
                >
                  {stats?.labDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Users Table */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Top Performing Users
          </Typography>
          <Button variant="text" onClick={() => navigate('/admin/users')}>
            View All Users
          </Button>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Total Uploads</TableCell>
                <TableCell align="right">Processed</TableCell>
                <TableCell>Processing Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats?.topUsers.map((user, index) => {
                const processingRate = user.totalUploads > 0
                  ? Math.round((user.processed / user.totalUploads) * 100)
                  : 0;

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}>
                          {user.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {user.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={user.role} size="small" />
                    </TableCell>
                    <TableCell align="right">{user.totalUploads}</TableCell>
                    <TableCell align="right">{user.processed}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: processingRate > 80 ? theme.palette.success.main : theme.palette.text.primary,
                        }}
                      >
                        {processingRate}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AdminDashboard;