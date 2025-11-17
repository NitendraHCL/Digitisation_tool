import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  CloudUpload as UploadIcon,
  Assignment as ReportsIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Assessment as AnalyticsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  CheckCircle,
  CheckCircle as ApprovedIcon,
  Warning as FlagIcon,
  Science as LabIcon,
  AdminPanelSettings as AdminIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  History as AuditIcon,
  ListAlt as ParameterIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const drawerWidth = 280;
const collapsedDrawerWidth = 70;

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactElement;
  roles?: string[];
  badge?: number;
}

const Layout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isNurse } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Navigation items based on role
  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      path: isAdmin ? '/admin/dashboard' : '/nurse/dashboard',
      icon: <DashboardIcon />,
    },
    ...(isNurse
      ? [
          {
            title: 'Upload Report',
            path: '/nurse/upload',
            icon: <UploadIcon />,
          },
          {
            title: 'My Reports',
            path: '/nurse/reports',
            icon: <ReportsIcon />,
          },
          {
            title: 'Review Queue',
            path: '/nurse/review',
            icon: <CheckCircle />,
            badge: 3, // Can be dynamic
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            title: 'All Reports',
            path: '/admin/reports',
            icon: <ReportsIcon />,
          },
          {
            title: 'User Management',
            path: '/admin/users',
            icon: <PeopleIcon />,
          },
          {
            title: 'Configuration',
            path: '/admin/config',
            icon: <SettingsIcon />,
          },
          {
            title: 'Parameter Master',
            path: '/admin/parameter-master',
            icon: <ParameterIcon />,
          },
          {
            title: 'Audit Logs',
            path: '/admin/audit',
            icon: <AuditIcon />,
          },
        ]
      : []),
  ];

  const getRoleColor = () => {
    switch (user?.role) {
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

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'super_admin':
      case 'admin':
        return <AdminIcon sx={{ fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const roleIcon = getRoleIcon();

  const drawer = (
    <Box>
      <Toolbar sx={{ px: 2, py: 3, justifyContent: desktopOpen || isMobile ? 'flex-start' : 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: desktopOpen || isMobile ? 'flex-start' : 'center' }}>
          <LabIcon sx={{ fontSize: 32, color: theme.palette.primary.main, mr: desktopOpen || isMobile ? 1 : 0 }} />
          {(desktopOpen || isMobile) && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                Lab Digitizer
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Medical Report System
              </Typography>
            </Box>
          )}
        </Box>
      </Toolbar>
      <Divider />

      {(desktopOpen || isMobile) && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ p: 2, bgcolor: theme.palette.grey[50], borderRadius: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Logged in as
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
              {user?.name}
            </Typography>
            <Chip
              label={user?.role.replace('_', ' ').toUpperCase()}
              size="small"
              color={getRoleColor() as any}
              {...(roleIcon && { icon: roleIcon })}
              sx={{ mt: 1 }}
            />
          </Box>
        </Box>
      )}

      <List sx={{ px: 2 }}>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={!desktopOpen && !isMobile ? item.title : ''} placement="right">
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: 2,
                  justifyContent: desktopOpen || isMobile ? 'flex-start' : 'center',
                  '&.Mui-selected': {
                    bgcolor: theme.palette.primary.main,
                    color: '#fff',
                    '&:hover': {
                      bgcolor: theme.palette.primary.dark,
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#fff',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: desktopOpen || isMobile ? 40 : 'auto', justifyContent: 'center' }}>
                  {item.badge ? (
                    <Badge badgeContent={item.badge} color="error">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                {(desktopOpen || isMobile) && <ListItemText primary={item.title} />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      {!isMobile && (
        <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, px: 2 }}>
          <IconButton
            onClick={() => setDesktopOpen(!desktopOpen)}
            sx={{
              width: '100%',
              borderRadius: 2,
              bgcolor: theme.palette.grey[100],
              '&:hover': {
                bgcolor: theme.palette.grey[200],
              },
            }}
          >
            {desktopOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: '#fff',
          color: theme.palette.text.primary,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navItems.find((item) => item.path === location.pathname)?.title || 'Dashboard'}
          </Typography>

          <Tooltip title="Notifications">
            <IconButton color="inherit" sx={{ mr: 2 }}>
              <Badge badgeContent={4} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Profile">
            <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
              <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                {user?.name?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: desktopOpen ? drawerWidth : collapsedDrawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: desktopOpen ? drawerWidth : collapsedDrawerWidth,
              borderRight: '1px solid',
              borderColor: theme.palette.divider,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${desktopOpen ? drawerWidth : collapsedDrawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: theme.palette.background.default,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        PaperProps={{
          sx: { width: 200, mt: 1.5 },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user?.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => navigate('/profile')}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;