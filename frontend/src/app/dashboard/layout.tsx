"use client";

import { usePathname, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetchApi('/admin/logout', { method: 'POST', body: '{}' });
    } catch {
      // Ignore errors — cookie may already be expired/missing
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <Link href="/dashboard" className="sidebar-brand">
          <div className="brand-logo">
            <span className="brand-letter">G</span>
          </div>
          <div className="brand-info">
            <span className="brand-name">GenioBrain</span>
            <span className="brand-tag">IP SOLUTION</span>
          </div>
        </Link>

        <nav className="sidebar-nav">
          <Link
            className={pathname === '/dashboard' ? 'nav-link active' : 'nav-link'}
            href="/dashboard"
          >
            <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4z" />
            </svg>
            <span>Overview</span>
          </Link>

          <Link
            className={pathname === '/dashboard/leads' || pathname.startsWith('/dashboard/leads/') ? 'nav-link active' : 'nav-link'}
            href="/dashboard/leads"
          >
            <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            <span>Leads</span>
          </Link>

          <Link
            className={pathname.startsWith('/dashboard/conversations') ? 'nav-link active' : 'nav-link'}
            href="/dashboard/conversations"
          >
            <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span>Incomplete Conversations</span>
          </Link>

          <Link
            className={pathname.startsWith('/dashboard/follow-ups') ? 'nav-link active' : 'nav-link'}
            href="/dashboard/follow-ups"
          >
            <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span>Follow-ups</span>
          </Link>

          <Link
            className={pathname.startsWith('/dashboard/settings') ? 'nav-link active' : 'nav-link'}
            href="/dashboard/settings"
          >
            <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span>Settings</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-pill">
            <div className="user-avatar">A</div>
            <div className="user-meta">
              <span className="user-name">Admin User</span>
              <span className="user-role">Administrator</span>
            </div>
            <button className="logout-icon-btn" onClick={handleLogout} title="Sign out" aria-label="Sign out">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
