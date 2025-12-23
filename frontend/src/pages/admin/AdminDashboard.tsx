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
    published: number;
    rejected: number;
    error: number;
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

interface LabAccuracyStat {
  labName: string;
  totalReports: number;
  avgParameterCount: number;
  avgProcessingTime: number;
  avgReviewTime: number;
  avgAccuracyRate: number;
}

const AdminDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [labAccuracyStats, setLabAccuracyStats] = useState<LabAccuracyStat[]>([]);
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

      // Map timeRange to days parameter for metrics endpoint
      const daysMap: Record<string, number> = {
        '24hours': 1,
        '7days': 7,
        '30days': 30,
        '90days': 90
      };
      const days = daysMap[timeRange] || 7;

      // Fetch stats, metrics, and lab accuracy in parallel
      const [statsResponse, metricsResponse, labAccuracyResponse] = await Promise.all([
        api.get(`/dashboard/stats?range=${backendRange}`),
        api.get(`/dashboard/metrics?days=${days}`),
        api.get('/dashboard/lab-accuracy')
      ]);

      const statsData = statsResponse.data.data;
      const metricsData = metricsResponse.data.data;
      const labAccuracyData = labAccuracyResponse.data.data || [];

      // Set lab accuracy stats
      setLabAccuracyStats(labAccuracyData);

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
          published: statsData.status.published,
          rejected: statsData.status.rejected,
          error: statsData.status.error,
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

  // Map status keys to user-friendly labels
  const statusLabels: Record<string, string> = {
    processing: 'Processing',
    ready: 'Ready for Review',
    approved: 'Approved',
    published: 'Published',
    rejected: 'Rejected',
    error: 'Error',
  };

  // Map status keys to colors
  const statusColors: Record<string, string> = {
    processing: theme.palette.info.main,
    ready: theme.palette.warning.main,
    approved: theme.palette.success.main,
    published: '#64B5F6', // Light blue
    rejected: theme.palette.error.main,
    error: theme.palette.grey[600],
  };

  // Filter out 'uploaded' status and map to pie data with labels
  const pieData = stats ? Object.entries(stats.reportsByStatus)
    .filter(([key]) => key !== 'uploaded') // Exclude 'uploaded' status
    .map(([key, value]) => ({
      name: statusLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
      value,
      key, // Keep original key for color mapping
    })) : [];

  const pieColors = pieData.map(item => statusColors[item.key] || theme.palette.grey[400]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography sx={{ fontSize: '32px', fontWeight: 700, mb: 1 }}>
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
            <Card
              sx={{
                background: `linear-gradient(135deg, ${stat.color}08 0%, ${stat.color}04 50%, #ffffff 100%)`,
                boxShadow: '0 6px 20px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -4px rgba(0, 0, 0, 0.08)',
                border: `1px solid ${stat.color}20`,
                borderRadius: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 12px 28px -8px rgba(0, 0, 0, 0.18), 0 8px 16px -8px rgba(0, 0, 0, 0.12)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
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
                  <Avatar sx={{ bgcolor: `${stat.color}15`, color: stat.color, width: 56, height: 56 }}>
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
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{
            p: 3,
            height: 400,
            boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.1), 0 2px 8px -4px rgba(0, 0, 0, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Report Activity Trend
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={stats?.recentActivity}>
                <defs>
                  <linearGradient id="totalReportsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A6EB5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4A6EB5" stopOpacity={0.08}/>
                  </linearGradient>
                  <linearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.08}/>
                  </linearGradient>
                </defs>
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
                  stroke="#3A5A9F"
                  strokeWidth={2}
                  fill="url(#totalReportsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Approved"
                  stackId="2"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#approvedGradient)"
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
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{
            p: 3,
            height: 400,
            boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.1), 0 2px 8px -4px rgba(0, 0, 0, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Reports Status Distribution
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: 340 }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      innerRadius={55}
                      outerRadius={95}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 1.5,
                pt: 1,
              }}>
                {pieData.map((entry, index) => (
                  <Box
                    key={entry.key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: pieColors[index],
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '12px',
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {entry.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      ({entry.value})
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Lab Distribution - Horizontal Bar Chart */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{
            p: 3,
            height: 400,
            boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.1), 0 2px 8px -4px rgba(0, 0, 0, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Lab Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={stats?.labDistribution.slice().sort((a, b) => b.count - a.count).slice(0, 6)}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                <XAxis type="number" stroke={theme.palette.text.secondary} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke={theme.palette.text.secondary}
                  tick={{ fontSize: 12 }}
                  width={90}
                />
                <ChartTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                  formatter={(value: any, name: string | undefined, props: any) => [
                    `${value} reports (${props?.payload?.percentage?.toFixed(1) || 0}%)`,
                    'Count'
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(() => {
                    const sortedData = stats?.labDistribution.slice().sort((a, b) => b.count - a.count).slice(0, 6) || [];
                    const maxCount = sortedData.length > 0 ? sortedData[0].count : 1;
                    return sortedData.map((entry, index) => {
                      // Calculate opacity based on count (higher count = more opaque)
                      const opacity = 0.4 + (entry.count / maxCount) * 0.6;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={`rgba(180, 134, 95, ${opacity})`}
                        />
                      );
                    });
                  })()}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Users Table */}
      <Paper sx={{
        p: 3,
        boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.1), 0 2px 8px -4px rgba(0, 0, 0, 0.06)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}>
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

      {/* Lab Accuracy Rate Table */}
      <Paper sx={{
        p: 3,
        mt: 4,
        boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.1), 0 2px 8px -4px rgba(0, 0, 0, 0.06)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          Lab Accuracy Rate
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Includes only reports with Approved, Rejected, or Published status
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Lab Name</TableCell>
                <TableCell align="right">Total Reports Uploaded</TableCell>
                <TableCell align="right">Avg Parameter Count</TableCell>
                <TableCell align="right">Avg Processing Time</TableCell>
                <TableCell align="right">Avg Review Time</TableCell>
                <TableCell align="right">Avg Accuracy Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {labAccuracyStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No lab accuracy data available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                labAccuracyStats.map((lab, index) => {
                  // Color-code accuracy rate
                  let accuracyColor = theme.palette.error.main; // Red for < 70%
                  if (lab.avgAccuracyRate >= 90) {
                    accuracyColor = theme.palette.success.main; // Green for >= 90%
                  } else if (lab.avgAccuracyRate >= 70) {
                    accuracyColor = theme.palette.warning.main; // Yellow for >= 70%
                  }

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.secondary.main }}>
                            <LabIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {lab.labName || 'Unknown Lab'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{lab.totalReports}</TableCell>
                      <TableCell align="right">{lab.avgParameterCount}</TableCell>
                      <TableCell align="right">{lab.avgProcessingTime}s</TableCell>
                      <TableCell align="right">{lab.avgReviewTime}s</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: accuracyColor,
                          }}
                        >
                          {lab.avgAccuracyRate}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AdminDashboard;