'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

// Simple interfaces
interface NavItem {
  text: string;
  path: string;
  icon?: string;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Simple navigation items
  const navItems: NavItem[] = [
    { text: 'Dashboard', path: '/dashboard', icon: '📊' },
    { text: 'Inventory', path: '/inventory', icon: '📦' },
    { text: 'Sales', path: '/sales', icon: '💰' },
    { text: 'Purchases', path: '/purchases', icon: '🛒' },
    { text: 'Reports', path: '/reports', icon: '📈' },
    { text: 'Staff', path: '/staff', icon: '👥' },
    { text: 'Centers', path: '/centers', icon: '🏢' },
    { text: 'Parties', path: '/parties', icon: '🤝' },
    { text: 'Products', path: '/products', icon: '🎧' },
  ];

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    width: sidebarOpen ? '240px' : '60px',
    backgroundColor: '#1976d2',
    color: 'white',
    transition: 'width 0.3s ease',
    overflowY: 'auto',
    zIndex: 1000,
  };

  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: sidebarOpen ? '240px' : '60px',
    right: 0,
    height: '64px',
    backgroundColor: '#1976d2',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    transition: 'left 0.3s ease',
    zIndex: 999,
  };

  const contentStyle: React.CSSProperties = {
    marginLeft: sidebarOpen ? '240px' : '60px',
    marginTop: '64px',
    padding: '20px',
    transition: 'margin-left 0.3s ease',
    minHeight: 'calc(100vh - 64px)',
    backgroundColor: '#f5f5f5',
  };

  const navItemStyle: React.CSSProperties = {
    display: 'block',
    padding: '12px 16px',
    color: 'white',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
  };

  const activeNavItemStyle: React.CSSProperties = {
    ...navItemStyle,
    backgroundColor: 'rgba(255,255,255,0.1)',
  };

  return (
    <div>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
          <h2 style={{ margin: 0, fontSize: sidebarOpen ? '18px' : '0px', overflow: 'hidden' }}>
            {sidebarOpen ? 'Hope CRM' : ''}
          </h2>
        </div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              style={pathname === item.path ? activeNavItemStyle : navItemStyle}
            >
              <span style={{ marginRight: sidebarOpen ? '12px' : '0' }}>
                {item.icon}
              </span>
              {sidebarOpen && item.text}
            </Link>
          ))}
        </nav>
      </div>

      {/* Header */}
      <div style={headerStyle}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            marginRight: '20px',
            cursor: 'pointer',
          }}
        >
          ☰
        </button>
        <h1 style={{ margin: 0, fontSize: '20px' }}>
          Hope Hearing CRM System
        </h1>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => router.push('/login')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
