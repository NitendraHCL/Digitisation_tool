import React, { useState, useEffect } from 'react';
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
import api from '../../services/api';
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
  CheckCircle,
  CheckCircle as ApprovedIcon,
  Warning as FlagIcon,
  Science as LabIcon,
  AdminPanelSettings as AdminIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  History as AuditIcon,
  ListAlt as ParameterIcon,
  Block as ExclusionIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const drawerWidth = 280;
const collapsedDrawerWidth = 70;

// Habit Health brand colors
const brandColors = {
  navyBlue: '#1E4088',
  navyBlueDark: '#162D5E',
  orange: '#F7941D',
  orangeLight: '#FDB347',
};

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
  const [readyReportsCount, setReadyReportsCount] = useState(0);
  const [pendingParamSuggestions, setPendingParamSuggestions] = useState(0);
  const [pendingExclusionSuggestions, setPendingExclusionSuggestions] = useState(0);

  // Fetch ready reports count for review queue badge
  useEffect(() => {
    const fetchReadyCount = async () => {
      if (!isNurse) return;
      try {
        const response = await api.get('/reports');
        const reports = response.data.data || [];
        const readyCount = reports.filter((r: any) => r.status === 'ready').length;
        setReadyReportsCount(readyCount);
      } catch (error) {
        console.error('Failed to fetch ready reports count:', error);
      }
    };

    fetchReadyCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchReadyCount, 30000);
    return () => clearInterval(interval);
  }, [isNurse]);

  // Fetch pending suggestions count for admin sidebar badges
  useEffect(() => {
    const fetchPendingSuggestionsCount = async () => {
      if (!isAdmin) return;
      try {
        const [paramRes, exclusionRes] = await Promise.all([
          api.get('/parameter-suggestions/stats'),
          api.get('/exclusion-suggestions/stats'),
        ]);
        setPendingParamSuggestions(paramRes.data.data?.pending || 0);
        setPendingExclusionSuggestions(exclusionRes.data.data?.pending || 0);
      } catch (error) {
        console.error('Failed to fetch pending suggestions count:', error);
      }
    };

    fetchPendingSuggestionsCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingSuggestionsCount, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

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
            badge: readyReportsCount >= 1 ? readyReportsCount : undefined,
          },
          {
            title: 'My Requests',
            path: '/nurse/my-requests',
            icon: <InboxIcon />,
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
            title: 'Parameters Master',
            path: '/admin/parameter-master',
            icon: <ParameterIcon />,
            badge: pendingParamSuggestions >= 1 ? pendingParamSuggestions : undefined,
          },
          {
            title: 'Exclusion Master',
            path: '/admin/exclusion-master',
            icon: <ExclusionIcon />,
            badge: pendingExclusionSuggestions >= 1 ? pendingExclusionSuggestions : undefined,
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
    <Box sx={{ bgcolor: brandColors.navyBlue, minHeight: '100%', color: '#fff' }}>
      <Toolbar sx={{ px: 2, py: 3, justifyContent: desktopOpen || isMobile ? 'flex-start' : 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: desktopOpen || isMobile ? 'flex-start' : 'center', width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <LabIcon sx={{ fontSize: 32, color: brandColors.orange, mr: desktopOpen || isMobile ? 1 : 0 }} />
            {(desktopOpen || isMobile) && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: brandColors.orange }}>
                  Lab Digitizer
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Medical Report System
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      <List sx={{ px: 2, pt: 2 }}>
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
                  color: 'rgba(255,255,255,0.85)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                  '&.Mui-selected': {
                    bgcolor: '#fff',
                    color: brandColors.navyBlue,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.9)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: brandColors.navyBlue,
                    },
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'rgba(255,255,255,0.85)',
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

      {/* Powered by HCL Healthcare Card - only show when drawer is expanded */}
      {(desktopOpen || isMobile) && (
        <Box sx={{ px: 2, mt: 'auto', pt: 4, mb: !isMobile ? 8 : 2 }}>
          <Box
            sx={{
              p: 2,
              bgcolor: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.15)',
              textAlign: 'center',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                display: 'block',
                mb: 1.5,
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              Powered by
            </Typography>
            <img
              src="/hcl-healthcare-logo-white.png"
              alt="HCL Healthcare"
              style={{
                width: '160px',
                height: 'auto',
                imageRendering: 'crisp-edges',
                WebkitFontSmoothing: 'antialiased',
                filter: 'contrast(1.1)',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </Box>
        </Box>
      )}

      {!isMobile && (
        <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, px: 2 }}>
          <IconButton
            onClick={() => setDesktopOpen(!desktopOpen)}
            sx={{
              width: '100%',
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.85)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.2)',
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
          width: { md: `calc(100% - ${desktopOpen ? drawerWidth : collapsedDrawerWidth}px)` },
          ml: { md: `${desktopOpen ? drawerWidth : collapsedDrawerWidth}px` },
          bgcolor: brandColors.navyBlue,
          color: '#fff',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
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

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Profile">
            <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
              <Avatar sx={{ bgcolor: brandColors.orange }}>
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