'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  text: string;
  path: string;
  icon: string;
  children?: NavChild[];
  adminOnly?: boolean;
}

interface NavChild {
  text: string;
  path: string;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, userProfile, isAllowedModule, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  // Check if we should hide sidebar for enquiry pages
  const shouldHideSidebar = pathname?.includes('/enquiries/new') || pathname?.includes('/enquiries/edit');

  // Navigation items
  const navigationItems: NavItem[] = [
    { text: 'Dashboard', path: '/dashboard', icon: '📊' },
    { text: 'Inventory', path: '/inventory', icon: '📦' },
    {
      text: 'Interaction',
      path: '/interaction',
      icon: '👥',
      children: [
        { text: 'Visitors', path: '/interaction/visitors' },
        { text: 'Enquiries', path: '/interaction/enquiries' },
        { text: 'Telecalling Records', path: '/telecalling-records' },
      ]
    },
    { text: 'Sales', path: '/sales', icon: '💰' },
    { text: 'Purchases', path: '/purchases', icon: '🛒' },
    { text: 'Material In', path: '/material-in', icon: '📥' },
    { text: 'Material Out', path: '/material-out', icon: '📤' },
    { text: 'Material Management', path: '/material-management', icon: '🔧' },
    { text: 'Purchase Management', path: '/purchase-management', icon: '📋' },
    { text: 'Stock Transfer', path: '/stock-transfer', icon: '🔄' },
    { text: 'Distribution Sales', path: '/distribution-sales', icon: '🚚' },
    { text: 'Cash Register', path: '/cash-register', icon: '💳' },
    { text: 'Reports', path: '/reports', icon: '📈' },
    { text: 'Staff', path: '/staff', icon: '👨‍💼' },
    { text: 'Parties', path: '/parties', icon: '🤝' },
    { text: 'Products', path: '/products', icon: '🎧' },
    { text: 'Centers', path: '/centers', icon: '🏢' },
    { text: 'Appointments', path: '/appointments', icon: '📅' },
    { text: 'Users', path: '/users', icon: '👤', adminOnly: true },
    { text: 'Admin Cleanup', path: '/admin-cleanup', icon: '🧹', adminOnly: true },
  ];

  // Styles
  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
    },
    sidebar: {
      position: 'fixed' as const,
      left: 0,
      top: 0,
      height: '100vh',
      width: drawerOpen ? '240px' : '60px',
      backgroundColor: '#ff6b35',
      color: 'white',
      transition: 'width 0.3s ease',
      overflowY: 'auto' as const,
      zIndex: 1200,
      boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
    },
    sidebarHeader: {
      padding: '16px',
      borderBottom: '1px solid rgba(255,255,255,0.12)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    logo: {
      width: '32px',
      height: '32px',
      backgroundColor: 'white',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    sidebarTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      margin: 0,
      opacity: drawerOpen ? 1 : 0,
      transition: 'opacity 0.3s ease',
    },
    navList: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
    },
    navItem: {
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    navLink: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      color: 'white',
      textDecoration: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backgroundColor: pathname === '/dashboard' ? 'rgba(255,255,255,0.15)' : 'transparent',
      borderRadius: '0',
    },
    navIcon: {
      fontSize: '20px',
      marginRight: drawerOpen ? '12px' : '0',
      minWidth: '20px',
    },
    navText: {
      fontSize: '14px',
      opacity: drawerOpen ? 1 : 0,
      transition: 'opacity 0.3s ease',
      whiteSpace: 'nowrap' as const,
    },
    appBar: {
      position: 'fixed' as const,
      top: 0,
      left: shouldHideSidebar ? 0 : (drawerOpen ? '240px' : '60px'),
      right: 0,
      height: '64px',
      backgroundColor: '#ff6b35',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      transition: 'left 0.3s ease',
      zIndex: 1100,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    menuButton: {
      background: 'none',
      border: 'none',
      color: 'white',
      fontSize: '24px',
      marginRight: '20px',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '4px',
      transition: 'background 0.2s ease',
    },
    appBarTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      margin: 0,
    },
    appBarActions: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    searchButton: {
      background: 'none',
      border: 'none',
      color: 'white',
      fontSize: '20px',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '4px',
      transition: 'background 0.2s ease',
    },
    profileButton: {
      background: 'rgba(255,255,255,0.1)',
      border: 'none',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '20px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'background 0.2s ease',
    },
    content: {
      marginLeft: shouldHideSidebar ? 0 : (drawerOpen ? '240px' : '60px'),
      marginTop: '64px',
      padding: '24px',
      transition: 'margin-left 0.3s ease',
      minHeight: 'calc(100vh - 64px)',
      width: '100%',
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '50vh',
      fontSize: '18px',
      color: '#666',
    },
    errorContainer: {
      backgroundColor: '#ff6b35',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      margin: '16px',
      textAlign: 'center' as const,
      boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
    },
  };

  // Handle menu toggle
  const toggleMenu = (menuText: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuText]: !prev[menuText]
    }));
  };

  // Handle profile menu
  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(profileMenuAnchor ? null : event.currentTarget);
  };

  const handleSignOut = async () => {
    try {
    await signOut();
      setProfileMenuAnchor(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Show loading spinner during authentication
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div>🔄 Loading your dashboard...</div>
      </div>
    );
  }

  // Show error if Firebase connection fails
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ padding: '8px 16px', backgroundColor: 'white', color: '#ff6b35', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Retry
        </button>
      </div>
    );
  }

  // Redirect to login if not authenticated (but not for enquiry pages)
  if (!user && !shouldHideSidebar) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return (
      <div style={styles.loadingContainer}>
        <div>🔄 Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      {!shouldHideSidebar && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={styles.logo}>🎧</div>
            <h2 style={styles.sidebarTitle}>Hope CRM</h2>
          </div>
          
          <nav>
            <ul style={styles.navList}>
              {navigationItems
                .filter(item => !item.adminOnly || (userProfile?.role === 'admin'))
                .filter(item => isAllowedModule?.(item.text.toLowerCase()) !== false)
                .map((item) => (
                <li key={item.text} style={styles.navItem}>
                  {item.children ? (
                    <>
                      <div
                        style={{
                          ...styles.navLink,
                          backgroundColor: item.children.some(child => pathname?.startsWith(child.path)) ? 'rgba(255,255,255,0.15)' : 'transparent'
                        }}
                        onClick={() => toggleMenu(item.text)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = item.children.some(child => pathname?.startsWith(child.path)) ? 'rgba(255,255,255,0.15)' : 'transparent'}
                      >
                        <span style={styles.navIcon}>{item.icon}</span>
                        <span style={styles.navText}>{item.text}</span>
                        {drawerOpen && (
                          <span style={{ marginLeft: 'auto', fontSize: '12px' }}>
                            {openMenus[item.text] ? '▼' : '▶'}
                          </span>
                        )}
                      </div>
                      {openMenus[item.text] && drawerOpen && (
                        <ul style={{ ...styles.navList, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                          {item.children.map((child) => (
                            <li key={child.path}>
                              <Link
                                href={child.path}
                                style={{
                                  ...styles.navLink,
                                  paddingLeft: '48px',
                                  backgroundColor: pathname === child.path ? 'rgba(255,255,255,0.2)' : 'transparent'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = pathname === child.path ? 'rgba(255,255,255,0.2)' : 'transparent'}
                              >
                                <span style={styles.navText}>{child.text}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.path}
                      style={{
                        ...styles.navLink,
                        backgroundColor: pathname === item.path ? 'rgba(255,255,255,0.15)' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = pathname === item.path ? 'rgba(255,255,255,0.15)' : 'transparent'}
                    >
                      <span style={styles.navIcon}>{item.icon}</span>
                      <span style={styles.navText}>{item.text}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      {/* App Bar */}
      <header style={styles.appBar}>
        {!shouldHideSidebar && (
          <button
            style={styles.menuButton}
            onClick={() => setDrawerOpen(!drawerOpen)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ☰
          </button>
        )}
        
        <h1 style={styles.appBarTitle}>
          {shouldHideSidebar ? 'Hope Hearing CRM - Enquiry Form' : 'Hope Hearing CRM'}
        </h1>
        
        <div style={styles.appBarActions}>
          <button
            style={styles.searchButton}
                onClick={() => setSearchOpen(true)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            🔍
          </button>
          
          <button
            style={styles.profileButton}
            onClick={handleProfileClick}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          >
            <span>👤</span>
            <span>{userProfile?.displayName || userProfile?.email?.split('@')[0] || 'User'}</span>
          </button>
        </div>
      </header>

      {/* Profile Menu */}
      {profileMenuAnchor && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            right: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 1300,
            minWidth: '200px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
              {userProfile?.displayName || 'User'}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {userProfile?.email}
            </div>
            <div style={{ fontSize: '12px', color: '#999', textTransform: 'capitalize' }}>
              {userProfile?.role} Access
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ff6b35',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              transition: 'background 0.2s ease',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            🚪 Sign Out
          </button>
        </div>
      )}

      {/* Click outside to close profile menu */}
      {profileMenuAnchor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
          }}
          onClick={() => setProfileMenuAnchor(null)}
        />
      )}

      {/* Main Content */}
      <main style={styles.content}>
        {children}
      </main>
    </div>
  );
}
