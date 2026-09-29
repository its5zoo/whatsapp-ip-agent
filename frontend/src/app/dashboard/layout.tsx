"use client";

import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

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
        <div className="sidebar-brand">GenioBrain Admin</div>
        <nav className="sidebar-nav">
          <a href="/dashboard">Leads</a>
        </nav>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </aside>
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
