'use client';

import React, { useEffect } from 'react';
import { Box, CircularProgress, CssBaseline, Drawer, AppBar, Toolbar, Typography, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Avatar, Collapse, Tooltip, Menu, MenuItem } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import UniversalSearch from '@/components/universal-search/UniversalSearch';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StoreIcon from '@mui/icons-material/Store';
import MailIcon from '@mui/icons-material/Mail';
import HearingIcon from '@mui/icons-material/Hearing';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ContactsIcon from '@mui/icons-material/Contacts';
import EventIcon from '@mui/icons-material/Event';
import DistributionIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

const drawerWidth = 240;
const collapsedDrawerWidth = 56;

// Define types for navigation items
interface NavChild {
  text: string;
  path: string;
}

interface NavItem {
  text: string;
  icon: React.ReactNode;
  path?: string;
  requiredModule?: string;
  adminOnly?: boolean;
  children?: NavChild[];
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, userProfile, isAllowedModule, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(true);
  // Add state to track open status of collapsible menu items
  const [openMenus, setOpenMenus] = React.useState<Record<string, boolean>>({});
  // Universal search state
  const [searchOpen, setSearchOpen] = React.useState(false);
  // Profile menu state
  const [profileMenuAnchor, setProfileMenuAnchor] = React.useState<null | HTMLElement>(null);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Handle toggle of collapsible menu
  const handleMenuToggle = (menuText: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuText]: !prev[menuText]
    }));
  };

  // Handle profile menu
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleAdminCleanup = () => {
    router.push('/admin-cleanup');
    handleProfileMenuClose();
  };

  const handleSignOut = async () => {
    await signOut();
    handleProfileMenuClose();
  };

  // Keyboard shortcut for search (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Redirect to login if not authenticated (except for enquiry form pages)
  useEffect(() => {
    if (!loading && !user && !shouldHideSidebar) {
      router.push('/login');
    }
  }, [user, loading, router, shouldHideSidebar]);

  // If there's an error, show error message
  if (error) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh" p={3}>
        <Typography variant="h6" color="error" gutterBottom>
          Firebase Connection Error
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
          {error}
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          Please check your internet connection and try refreshing the page.
        </Typography>
      </Box>
    );
  }

  // If still loading, show minimal loading
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={24} />
      </Box>
    );
  }

  // If not authenticated, don't render children
  if (!user) {
    return null;
  }

  const navItems: NavItem[] = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Products', icon: <HearingIcon />, path: '/products', requiredModule: 'products' },
    { text: 'Inventory', icon: <InventoryIcon />, path: '/inventory', requiredModule: 'inventory' },
    { text: 'Purchases', icon: <LocalShippingIcon />, path: '/purchase-management', requiredModule: 'purchases' },
    { text: 'Material In', icon: <ReceiptLongIcon />, path: '/material-in', requiredModule: 'materials' },
    { text: 'Material Out', icon: <LocalShippingIcon />, path: '/material-out', requiredModule: 'materials' },
    { text: 'Distribution Sales', icon: <DistributionIcon />, path: '/distribution-sales', requiredModule: 'sales' },
    { text: 'Sales', icon: <ReceiptIcon />, path: '/sales', requiredModule: 'sales' },
    { text: 'Parties', icon: <StoreIcon />, path: '/parties', requiredModule: 'parties' },
    { text: 'Centers', icon: <StoreIcon />, path: '/centers', requiredModule: 'centers' },
    { 
      text: 'Interaction', 
      icon: <ContactsIcon />, 
      requiredModule: 'interaction',
      children: [
        { text: 'Visitors', path: '/interaction/visitors' },
        { text: 'Enquiries', path: '/interaction/enquiries' },
        { text: 'Telecalling Records', path: '/telecalling-records' }
      ] 
    },
    { text: 'Stock Transfer', icon: <TransferWithinAStationIcon />, path: '/stock-transfer', requiredModule: 'stock' },
    { text: 'Cash Register', icon: <AttachMoneyIcon />, path: '/cash-register', requiredModule: 'cash' },
    { text: 'Appointment Scheduler', icon: <EventIcon />, path: '/appointments', requiredModule: 'interaction' },
    { text: 'Reports', icon: <BarChartIcon />, path: '/reports', requiredModule: 'reports' },
    { 
      text: 'Staff', 
      icon: <PeopleIcon />, 
      adminOnly: true,
      children: [
        { text: 'Staff Management', path: '/staff' },
        { text: 'Loans & Advances', path: '/staff/loans-advances' }
      ] 
    },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', adminOnly: true },
  ];

  const currentPage = navItems.find(item => pathname === item.path)?.text || 'Dashboard';
  
  // Check if current page should hide sidebar (enquiry form pages)
  const shouldHideSidebar = pathname === '/interaction/enquiries/new' || pathname.startsWith('/interaction/enquiries/edit/');

  const drawer = (
    <>
      <Toolbar sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Image
            src="/images/logohope.svg"
            alt="Hearing Hope Logo"
            width={40}
            height={40}
            style={{ marginRight: drawerOpen ? '8px' : '0' }}
          />
          {drawerOpen && (
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Hearing Hope
            </Typography>
          )}
        </Box>
        {/* Only show toggle button on mobile */}
        <IconButton 
          onClick={toggleDrawer} 
          sx={{ 
            ml: 1,
            display: { xs: 'block', sm: 'none' }
          }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>
      <Divider />
      <List>
        {navItems.map((item) => {
          // Check if user is allowed to access this item
          const isAllowed = 
            (item.adminOnly ? userProfile?.role === 'admin' : true) && 
            (item.requiredModule ? isAllowedModule(item.requiredModule) : true);
            
          if (!isAllowed) return null;
          
          // Handle nested items - don't show when collapsed
          if (item.children && drawerOpen) {
            const isOpen = openMenus[item.text] || false;
            
            return (
              <React.Fragment key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleMenuToggle(item.text)}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map((child) => (
                      <ListItem key={child.text} disablePadding>
                        <Link href={child.path} style={{ textDecoration: 'none', width: '100%', color: 'inherit' }}>
                          <ListItemButton sx={{ pl: 4 }} selected={pathname === child.path}>
                            <ListItemText primary={child.text} />
                          </ListItemButton>
                        </Link>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }
          
          // For collapsed state, show first child of nested items as the main item
          if (item.children && !drawerOpen && item.children.length > 0) {
            const firstChild = item.children[0];
            return (
              <ListItem key={item.text} disablePadding>
                <Link href={firstChild.path} style={{ textDecoration: 'none', width: '100%', color: 'inherit' }}>
                  <ListItemButton 
                    selected={item.children.some(child => pathname === child.path)}
                    sx={{ 
                      minHeight: 48,
                      justifyContent: 'center',
                      px: 2.5,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 0, mr: 0, justifyContent: 'center' }}>
                      {item.icon}
                    </ListItemIcon>
                  </ListItemButton>
                </Link>
              </ListItem>
            );
          }
          
          // Handle regular items
          return (
            <ListItem key={item.text} disablePadding>
              {item.path ? (
                <Link href={item.path} style={{ textDecoration: 'none', width: '100%', color: 'inherit' }}>
                  <ListItemButton 
                    selected={pathname === item.path}
                    sx={drawerOpen ? {} : {
                      minHeight: 48,
                      justifyContent: 'center',
                      px: 2.5,
                    }}
                  >
                    <ListItemIcon sx={drawerOpen ? {} : { minWidth: 0, mr: 0, justifyContent: 'center' }}>
                      {item.icon}
                    </ListItemIcon>
                    {drawerOpen && <ListItemText primary={item.text} />}
                  </ListItemButton>
                </Link>
              ) : (
                <ListItemButton
                  sx={drawerOpen ? {} : {
                    minHeight: 48,
                    justifyContent: 'center',
                    px: 2.5,
                  }}
                >
                  <ListItemIcon sx={drawerOpen ? {} : { minWidth: 0, mr: 0, justifyContent: 'center' }}>
                    {item.icon}
                  </ListItemIcon>
                  {drawerOpen && <ListItemText primary={item.text} />}
                </ListItemButton>
              )}
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ mt: 'auto' }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => signOut()}
            sx={drawerOpen ? {} : {
              minHeight: 48,
              justifyContent: 'center',
              px: 2.5,
            }}
          >
            <ListItemIcon sx={drawerOpen ? {} : { minWidth: 0, mr: 0, justifyContent: 'center' }}>
              <LogoutIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary="Logout" />}
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );

  // If on enquiry form pages, render without sidebar (but still check auth)
  if (shouldHideSidebar) {
    // Still need authentication for enquiry pages
    if (!user || !userProfile) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress size={24} />
        </Box>
      );
    }
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <CssBaseline />
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: drawerOpen ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${collapsedDrawerWidth}px)` },
          ml: { sm: drawerOpen ? `${drawerWidth}px` : `${collapsedDrawerWidth}px` },
          transition: theme => theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2, display: { xs: 'block', sm: 'block' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {currentPage}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Universal Search Button */}
            <Tooltip title="Search everything (Ctrl+K)" arrow>
              <IconButton
                color="inherit"
                aria-label="search"
                onClick={() => setSearchOpen(true)}
                sx={{ 
                  mr: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                <SearchIcon />
              </IconButton>
            </Tooltip>
            
            <Typography variant="body2" sx={{ mr: 1 }}>
              {userProfile?.displayName || user?.email}
            </Typography>
            <Tooltip title="Profile Menu" arrow>
              <IconButton
                color="inherit"
                onClick={handleProfileMenuOpen}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  {userProfile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Drawer */}
      <Box
        component="nav"
        sx={{ 
          width: { sm: drawerOpen ? drawerWidth : collapsedDrawerWidth }, 
          flexShrink: { sm: 0 },
          transition: theme => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={toggleDrawer}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerOpen ? drawerWidth : collapsedDrawerWidth,
              transition: theme => theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              overflowX: 'hidden'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      {/* Main content */}
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3,
          transition: theme => theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          marginTop: '64px' // height of AppBar
        }}
      >
        {children}
      </Box>
      
      {/* Universal Search Dialog */}
      <UniversalSearch 
        open={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />

      {/* Profile Menu */}
      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {/* Admin-only options */}
        {userProfile?.role === 'admin' && (
          <>
            <MenuItem onClick={handleAdminCleanup}>
              <ListItemIcon>
                <CleaningServicesIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Database Cleanup" />
            </MenuItem>
            <MenuItem>
              <ListItemIcon>
                <AdminPanelSettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Admin Settings" />
            </MenuItem>
            <Divider />
          </>
        )}
        
        {/* Common options */}
        <MenuItem>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Profile Settings" />
        </MenuItem>
        
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sign Out" />
        </MenuItem>
      </Menu>
    </Box>
  );
} 