import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Avatar,
  Menu,
  Tooltip,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  useTheme,
  SelectChangeEvent,
  Switch,
  FormControlLabel,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  LocalHospital as NurseIcon,
  Block as BlockIcon,
  CheckCircle as ActiveIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Badge as BadgeIcon,
  TrendingUp,
  Assignment as ReportsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'nurse';
  status: 'active' | 'inactive' | 'blocked';
  createdAt: string;
  lastLogin?: string;
  stats?: {
    totalReports: number;
    approvedReports: number;
    accuracy: number;
  };
}

const UserManagement: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    password: string;
    role: 'super_admin' | 'admin' | 'nurse';
    status: 'active' | 'inactive' | 'blocked';
  }>({
    name: '',
    email: '',
    password: '',
    role: 'nurse',
    status: 'active',
  });

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    nurses: 0,
    admins: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');

      // Handle nested response structure: response.data.data.users
      const usersData = response.data.data?.users || response.data.data || response.data;

      // Ensure usersData is an array
      const usersArray = Array.isArray(usersData) ? usersData : [];
      setUsers(usersArray);

      // Calculate stats
      setStats({
        totalUsers: usersArray.length,
        activeUsers: usersArray.filter((u: User) => u.status === 'active').length,
        nurses: usersArray.filter((u: User) => u.role === 'nurse').length,
        admins: usersArray.filter((u: User) => u.role === 'admin' || u.role === 'super_admin').length,
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
      enqueueSnackbar('Failed to fetch users', { variant: 'error' });
      // Set empty array on error
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditMode(false);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'nurse',
      status: 'active',
    });
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditMode(true);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      if (editMode && selectedUser) {
        // Update user
        await api.put(`/admin/users/${selectedUser._id}`, formData);
        enqueueSnackbar('User updated successfully', { variant: 'success' });
      } else {
        // Create new user
        await api.post('/admin/users', formData);
        enqueueSnackbar('User created successfully', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || 'Failed to save user', { variant: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await api.delete(`/admin/users/${userId}`);
      enqueueSnackbar('User deleted successfully', { variant: 'success' });
      fetchUsers();
    } catch (error) {
      enqueueSnackbar('Failed to delete user', { variant: 'error' });
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/admin/users/${user._id}/status`, { status: newStatus });
      enqueueSnackbar(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, { variant: 'success' });
      fetchUsers();
    } catch (error) {
      enqueueSnackbar('Failed to update user status', { variant: 'error' });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return <AdminIcon />;
      case 'nurse':
        return <NurseIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string): any => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'admin':
        return 'warning';
      case 'nurse':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string): any => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'blocked':
        return 'error';
      default:
        return 'default';
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Paginate filtered results
  const paginatedUsers = filteredUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: <PersonIcon />,
      color: theme.palette.primary.main,
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: <ActiveIcon />,
      color: theme.palette.success.main,
    },
    {
      title: 'Nurses',
      value: stats.nurses,
      icon: <NurseIcon />,
      color: theme.palette.info.main,
    },
    {
      title: 'Administrators',
      value: stats.admins,
      icon: <AdminIcon />,
      color: theme.palette.warning.main,
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage system users and their permissions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddUser}
          size="large"
        >
          Add New User
        </Button>
      </Box>

      {/* Stats Cards */}
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
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: `${stat.color}20`, color: stat.color }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Users Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, maxWidth: 400 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={roleFilter}
              onChange={(e: SelectChangeEvent) => setRoleFilter(e.target.value)}
              displayEmpty
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="nurse">Nurses</MenuItem>
              <MenuItem value="admin">Admins</MenuItem>
              <MenuItem value="super_admin">Super Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={statusFilter}
              onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
              displayEmpty
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="blocked">Blocked</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <LinearProgress />
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Total Reports</TableCell>
                    <TableCell>Approved Reports</TableCell>
                    <TableCell>Last Login</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedUsers.map((user) => {
                    const roleIcon = getRoleIcon(user.role);
                    return (
                    <TableRow key={user._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}>
                            {user.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {user.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role.replace('_', ' ').toUpperCase()}
                          color={getRoleColor(user.role)}
                          size="small"
                          {...(roleIcon && { icon: roleIcon })}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Unknown'}
                          color={getStatusColor(user.status || 'default')}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {user.stats ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ReportsIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {user.stats.totalReports}
                            </Typography>
                          </Box>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {user.stats ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUp
                              fontSize="small"
                              sx={{ color: theme.palette.success.main }}
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: theme.palette.success.main
                              }}
                            >
                              {user.stats.approvedReports}
                            </Typography>
                          </Box>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? (
                          <Tooltip title={format(new Date(user.lastLogin), 'PPpp')}>
                            <Typography variant="body2">
                              {format(new Date(user.lastLogin), 'MMM dd, HH:mm')}
                            </Typography>
                          </Tooltip>
                        ) : 'Never'}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Tooltip title="Edit User">
                            <IconButton
                              size="small"
                              onClick={() => handleEditUser(user)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={user.status === 'active' ? 'Deactivate' : 'Activate'}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleStatus(user)}
                              color={user.status === 'active' ? 'error' : 'success'}
                            >
                              {user.status === 'active' ? <BlockIcon /> : <ActiveIcon />}
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, user)}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedUser) {
            handleEditUser(selectedUser);
          }
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit User
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedUser) {
            navigate(`/admin/users/${selectedUser._id}/activity`);
          }
          handleMenuClose();
        }}>
          <ReportsIcon sx={{ mr: 1 }} fontSize="small" />
          View Activity
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedUser) {
            handleDeleteUser(selectedUser._id);
          }
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" color="error" />
          Delete User
        </MenuItem>
      </Menu>

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BadgeIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {!editMode && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  label="Role"
                >
                  <MenuItem value="nurse">Nurse</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="super_admin">Super Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="blocked">Blocked</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveUser}>
            {editMode ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;