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
          <span className="brand-mark">G</span>
          <span><strong>GenioBrain</strong><small>Lead Management</small></span>
        </Link>
        <nav className="sidebar-nav">
          <Link className={pathname === '/dashboard' ? 'nav-link active' : 'nav-link'} href="/dashboard">Overview</Link>
          <Link className={pathname === '/dashboard/leads' || pathname.startsWith('/dashboard/leads/') ? 'nav-link active' : 'nav-link'} href="/dashboard/leads">Leads</Link>
          <Link className={pathname.startsWith('/dashboard/conversations') ? 'nav-link active' : 'nav-link'} href="/dashboard/conversations">Incomplete Conversations</Link>
          <Link className={pathname.startsWith('/dashboard/follow-ups') ? 'nav-link active' : 'nav-link'} href="/dashboard/follow-ups">Follow-ups</Link>
          <Link className={pathname.startsWith('/dashboard/settings') ? 'nav-link active' : 'nav-link'} href="/dashboard/settings">Settings</Link>
        </nav>
        <button className="logout-btn" onClick={handleLogout}><span>↪</span> Sign out</button>
      </aside>
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
