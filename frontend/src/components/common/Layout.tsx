import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Collapse,
  Paper,
  Popper,
  ClickAwayListener,
} from '@mui/material';
import api from '../../services/api';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  CloudUpload as UploadIcon,
  Assignment as ReportsIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  CheckCircle,
  Science as LabIcon,
  AdminPanelSettings as AdminIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  History as AuditIcon,
  ListAlt as ParameterIcon,
  Block as ExclusionIcon,
  Inbox as InboxIcon,
  MonitorHeart as HealthCheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BarChart as OverviewIcon,
  TableChart as ListIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const drawerWidth = 260;
const collapsedDrawerWidth = 70;

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
  children?: { title: string; path: string; icon: React.ReactElement; badge?: number }[];
}

const Layout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isNurse } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const [readyReportsCount, setReadyReportsCount] = useState(0);
  const [pendingParamSuggestions, setPendingParamSuggestions] = useState(0);
  const [pendingExclusionSuggestions, setPendingExclusionSuggestions] = useState(0);
  const [expandedNavs, setExpandedNavs] = useState<Record<string, boolean>>({ '/health-check-tracking': true, '/admin/masters': true });
  const [flyoutAnchor, setFlyoutAnchor] = useState<{ el: HTMLElement; item: NavItem } | null>(null);

  const isExpanded = desktopOpen || isMobile;

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
    const interval = setInterval(fetchPendingSuggestionsCount, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

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
          { title: 'Upload Report', path: '/nurse/upload', icon: <UploadIcon /> },
          { title: 'My Reports', path: '/nurse/reports', icon: <ReportsIcon /> },
          { title: 'Review Queue', path: '/nurse/review', icon: <CheckCircle />, badge: readyReportsCount >= 1 ? readyReportsCount : undefined },
          { title: 'My Requests', path: '/nurse/my-requests', icon: <InboxIcon /> },
        ]
      : []),
    ...(isAdmin
      ? [
          { title: 'All Reports', path: '/admin/reports', icon: <ReportsIcon /> },
          { title: 'Configuration', path: '/admin/config', icon: <SettingsIcon /> },
          {
            title: 'Masters',
            path: '/admin/masters',
            icon: <AdminIcon />,
            badge: (pendingParamSuggestions + pendingExclusionSuggestions) >= 1
              ? pendingParamSuggestions + pendingExclusionSuggestions : undefined,
            children: [
              { title: 'Parameter Master', path: '/admin/parameter-master', icon: <ParameterIcon />, badge: pendingParamSuggestions >= 1 ? pendingParamSuggestions : undefined },
              { title: 'Exclusion Master', path: '/admin/exclusion-master', icon: <ExclusionIcon />, badge: pendingExclusionSuggestions >= 1 ? pendingExclusionSuggestions : undefined },
              { title: 'User Management', path: '/admin/users', icon: <PeopleIcon /> },
            ],
          },
          { title: 'Audit Logs', path: '/admin/audit', icon: <AuditIcon /> },
        ]
      : []),
    {
      title: 'Health Check',
      path: '/health-check-tracking',
      icon: <HealthCheckIcon />,
      children: [
        { title: 'Overview', path: '/health-check-tracking/overview', icon: <OverviewIcon /> },
        { title: 'List', path: '/health-check-tracking/list', icon: <ListIcon /> },
      ],
    },
  ];

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isChildActive = hasChildren && item.children!.some(c => location.pathname === c.path);
    const isDirectActive = !hasChildren && location.pathname === item.path;

    return (
      <React.Fragment key={item.path}>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={!isExpanded ? item.title : ''} placement="right">
            <ListItemButton
              onClick={(e) => {
                if (hasChildren) {
                  if (isExpanded) {
                    setExpandedNavs(prev => ({ ...prev, [item.path]: !prev[item.path] }));
                  } else {
                    setFlyoutAnchor(flyoutAnchor?.item.path === item.path ? null : { el: e.currentTarget as HTMLElement, item });
                  }
                } else {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }
              }}
              selected={isDirectActive || isChildActive}
              sx={{
                borderRadius: 2,
                justifyContent: isExpanded ? 'flex-start' : 'center',
                color: 'rgba(255,255,255,0.85)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                '&.Mui-selected': {
                  bgcolor: '#fff', color: brandColors.navyBlue,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                  '& .MuiListItemIcon-root': { color: brandColors.navyBlue },
                },
                '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.85)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: isExpanded ? 40 : 'auto', justifyContent: 'center' }}>
                {item.badge ? <Badge badgeContent={item.badge} color="error">{item.icon}</Badge> : item.icon}
              </ListItemIcon>
              {isExpanded && <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />}
              {isExpanded && hasChildren && (
                expandedNavs[item.path]
                  ? <ExpandLessIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                  : <ExpandMoreIcon sx={{ fontSize: 18, opacity: 0.7 }} />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        {hasChildren && isExpanded && (
          <Collapse in={expandedNavs[item.path]} timeout="auto" unmountOnExit>
            <List disablePadding sx={{ pl: 2 }}>
              {item.children!.map((child) => (
                <ListItem key={child.path} disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton
                    onClick={() => { navigate(child.path); if (isMobile) setMobileOpen(false); }}
                    selected={location.pathname === child.path}
                    sx={{
                      borderRadius: 2, py: 0.75,
                      color: 'rgba(255,255,255,0.7)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                      '&.Mui-selected': {
                        bgcolor: 'rgba(255,255,255,0.15)', color: '#fff',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                        '& .MuiListItemIcon-root': { color: brandColors.orange },
                      },
                      '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.6)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, justifyContent: 'center' }}>
                      {child.badge ? (
                        <Badge badgeContent={child.badge} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
                          {child.icon}
                        </Badge>
                      ) : child.icon}
                    </ListItemIcon>
                    <ListItemText primary={child.title} primaryTypographyProps={{ fontSize: 13 }} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawer = (
    <Box sx={{
      bgcolor: brandColors.navyBlue, height: '100%', color: '#fff',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* ── Brand ── */}
      <Box sx={{ px: 2, py: 2.5, flexShrink: 0, justifyContent: isExpanded ? 'flex-start' : 'center', display: 'flex' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/nurse/dashboard')}>
          <LabIcon sx={{ fontSize: 32, color: brandColors.orange, mr: isExpanded ? 1.5 : 0 }} />
          {isExpanded && (
            <Box>
              <Typography sx={{ fontWeight: 700, color: brandColors.orange, fontSize: 17, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                Lab Digitizer
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                Medical Report System
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 2 }} />

      {/* ── Navigation ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pt: 1.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 999 },
      }}>
        <List disablePadding>
          {navItems.map(renderNavItem)}
        </List>
      </Box>

      {/* ── Flyout Popper for collapsed sidebar ── */}
      {flyoutAnchor && !desktopOpen && !isMobile && (
        <Popper open anchorEl={flyoutAnchor.el} placement="right-start" sx={{ zIndex: 1300 }}>
          <ClickAwayListener onClickAway={() => setFlyoutAnchor(null)}>
            <Paper sx={{
              ml: 1, py: 1, px: 0.5, minWidth: 170, borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB',
            }}>
              <Typography sx={{ px: 2, py: 0.5, fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {flyoutAnchor.item.title}
              </Typography>
              {flyoutAnchor.item.children!.map((child) => (
                <ListItemButton
                  key={child.path}
                  onClick={() => { navigate(child.path); setFlyoutAnchor(null); }}
                  selected={location.pathname === child.path}
                  sx={{
                    borderRadius: 1.5, mx: 0.5, py: 0.75,
                    '&.Mui-selected': { bgcolor: 'rgba(30,64,136,0.08)', color: brandColors.navyBlue },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {child.badge ? (
                      <Badge badgeContent={child.badge} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
                        {child.icon}
                      </Badge>
                    ) : child.icon}
                  </ListItemIcon>
                  <ListItemText primary={child.title} primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
                </ListItemButton>
              ))}
            </Paper>
          </ClickAwayListener>
        </Popper>
      )}

      {/* ── Bottom section: Powered by + User + Collapse ── */}
      <Box sx={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Powered by - only when expanded */}
        {isExpanded && (
          <Box sx={{ px: 2, pt: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, mb: 0.5 }}>Powered by</Typography>
              <img
                src="/hcl-healthcare-logo-white.png" alt="HCL Healthcare"
                style={{ width: 130, height: 'auto', filter: 'contrast(1.1)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </Box>
          </Box>
        )}

        {/* User profile */}
        <Box
          onClick={(e) => setProfileAnchor(e.currentTarget)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.5, mx: 1.5, mt: 1.5, mb: 0.5,
            borderRadius: 2, cursor: 'pointer',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            transition: 'background 0.15s',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <Avatar sx={{
            width: 34, height: 34, fontSize: 14, fontWeight: 700,
            bgcolor: brandColors.orange, color: '#fff',
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </Avatar>
          {isExpanded && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                {user?.role?.replace('_', ' ')}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Collapse toggle - desktop only */}
        {!isMobile && (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <IconButton
              onClick={() => { setDesktopOpen(!desktopOpen); setFlyoutAnchor(null); }}
              sx={{
                width: '100%', borderRadius: 2, py: 0.75,
                bgcolor: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.7)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                display: 'flex', gap: 1,
              }}
            >
              {desktopOpen ? <ChevronLeftIcon sx={{ fontSize: 20 }} /> : <ChevronRightIcon sx={{ fontSize: 20 }} />}
              {isExpanded && <Typography sx={{ fontSize: 12, fontWeight: 500 }}>Collapse</Typography>}
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* Mobile hamburger */}
      {isMobile && (
        <IconButton
          onClick={() => setMobileOpen(!mobileOpen)}
          sx={{
            position: 'fixed', top: 12, left: 12, zIndex: 1300,
            bgcolor: brandColors.navyBlue, color: '#fff',
            width: 40, height: 40, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            '&:hover': { bgcolor: brandColors.navyBlueDark },
          }}
        >
          <MenuIcon sx={{ fontSize: 20 }} />
        </IconButton>
      )}

      <Box
        component="nav"
        sx={{ width: { md: desktopOpen ? drawerWidth : collapsedDrawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: desktopOpen ? drawerWidth : collapsedDrawerWidth,
              borderRight: 'none',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflow: 'visible',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content - no top bar spacer */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${desktopOpen ? drawerWidth : collapsedDrawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: '#F5F6FA',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Outlet />
      </Box>

      {/* Profile dropdown menu */}
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { width: 200, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</Typography>
          <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>{user?.email}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { navigate('/profile'); setProfileAnchor(null); }} sx={{ fontSize: 13 }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleLogout(); setProfileAnchor(null); }} sx={{ fontSize: 13 }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;
