"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { FollowUp, IncompleteConversation, Lead, LeadStats } from '@/types';
import { formatWhatsAppIdentity } from '@/lib/formatters';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function Dashboard() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [incomplete, setIncomplete] = useState<IncompleteConversation[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [statusLeads, setStatusLeads] = useState<Lead[]>([]);
  const [now] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, leadsData, conversationsData, followUpsData, statusLeadsData] = await Promise.all([
        fetchApi('/admin/stats'),
        fetchApi('/admin/leads?page=1&limit=5'),
        fetchApi('/admin/conversations'),
        fetchApi('/admin/follow-ups'),
        fetchApi('/admin/leads?page=1&limit=100')
      ]);
      setStats(statsData);
      setLeads(leadsData.leads || []);
      setIncomplete(conversationsData.conversations || []);
      setFollowUps(followUpsData.followUps || []);
      setStatusLeads(statusLeadsData.leads || []);
      setLoaded(true);
    } catch {
      setLoaded(false);
      setError('We could not load the overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const statusCounts = statusLeads.reduce<Record<string, number>>((counts, lead) => {
    counts[lead.status] = (counts[lead.status] || 0) + 1;
    return counts;
  }, {});
  const pendingFollowUps = followUps.filter(item => item.status === 'PENDING');
  const overdueFollowUps = pendingFollowUps.filter(item => new Date(item.scheduledAt).getTime() < now);
  const statusOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'IN_PROGRESS', 'ON_HOLD', 'CONVERTED', 'NOT_INTERESTED', 'CLOSED'];
  const statusLabels: Record<string, string> = { NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', IN_PROGRESS: 'In progress', ON_HOLD: 'On hold', CONVERTED: 'Converted', NOT_INTERESTED: 'Not interested', CLOSED: 'Closed' };
  const cards = [
    { label: 'Total leads', value: stats?.totalLeads ?? 0, note: 'All completed enquiries', tone: 'navy' },
    { label: 'Incomplete', value: incomplete.length, note: 'Conversations needing attention', tone: 'amber' },
    { label: 'Follow-ups due', value: overdueFollowUps.length, note: 'Overdue reminders', tone: 'red' },
    { label: 'Patent enquiries', value: stats?.byFlowType?.patent ?? 0, note: 'By service type', tone: 'blue' },
    { label: 'Trademark enquiries', value: stats?.byFlowType?.trademark ?? 0, note: 'By service type', tone: 'green' },
  ];

  return (
    <div className="page-container">
      <header className="page-header">
        <div><p className="eyebrow">Lead management</p><h1>Overview</h1><p className="page-subtitle">A clear view of the enquiries that need your team today.</p></div>
        <Link href="/dashboard/leads" className="button primary">View all leads <span>→</span></Link>
      </header>

      {error && <div className="alert error-panel" role="alert"><span>{error}</span><button onClick={load} className="button subtle">Retry</button></div>}
      {loading ? <div className="skeleton-grid">{[1, 2, 3, 4].map(item => <div className="skeleton stat-skeleton" key={item} />)}</div> : loaded ? (
        <section className="stats-grid" aria-label="Lead summary">
          {cards.map(card => <div className={`stat-card ${card.tone}`} key={card.label}><div className="stat-label">{card.label}</div><strong className="stat-value">{card.value}</strong><div className="stat-note">{card.note}</div></div>)}
        </section>
      ) : null}

      {loading ? <div className="skeleton status-summary-skeleton" /> : loaded && <section className="panel status-summary">
        <div className="section-heading"><div><p className="eyebrow">Pipeline</p><h2>Leads by status</h2></div><span className="summary-note">Latest {statusLeads.length} loaded</span></div>
        <div className="status-summary-grid">{statusOrder.map(status => <div className="status-summary-item" key={status}><span className={`status-pill status-${status.toLowerCase()}`}>{statusLabels[status]}</span><strong>{statusCounts[status] || 0}</strong></div>)}</div>
      </section>}

      <div className="overview-grid">
        <section className="panel attention-panel">
          <div className="section-heading"><div><p className="eyebrow">Work queue</p><h2>Needs attention</h2></div><Link href="/dashboard/conversations" className="text-link">View all →</Link></div>
          {loading ? <div className="skeleton list-skeleton" /> : !loaded ? <div className="empty-state compact"><strong>Overview unavailable</strong><p>Retry to load current conversations.</p></div> : incomplete.length === 0 ? <div className="empty-state compact"><span className="empty-icon">✓</span><strong>No incomplete conversations</strong><p>Everyone is currently caught up.</p></div> : <div className="attention-list">{incomplete.slice(0, 5).map(item => <Link href={`/dashboard/conversations/${item.id}`} className="attention-item" key={item.id}><span className="attention-icon">!</span><span><strong>{formatWhatsAppIdentity(item.externalUserId)}</strong><small>{item.currentQuestionId || 'Main menu'} · Updated {formatDate(item.updatedAt)}</small></span><span className="row-arrow">→</span></Link>)}</div>}
        </section>
        <section className="panel">
          <div className="section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent leads</h2></div><Link href="/dashboard/leads" className="text-link">View all →</Link></div>
          {loading ? <div className="skeleton list-skeleton" /> : !loaded ? <div className="empty-state compact"><strong>Overview unavailable</strong><p>Retry to load current leads.</p></div> : leads.length === 0 ? <div className="empty-state compact"><strong>No leads yet</strong><p>Completed enquiries will appear here.</p></div> : <div className="recent-list">{leads.map(lead => <Link href={`/dashboard/leads/${lead.id}`} className="recent-item" key={lead.id}><span className={`avatar flow-${lead.flowType}`}>{(lead.name || '?').slice(0, 1).toUpperCase()}</span><span><strong>{lead.name || 'Unnamed lead'}</strong><small>{lead.flowType} · {formatDate(lead.createdAt)}</small></span><span className={`status-pill status-${lead.status.toLowerCase()}`}>{statusLabels[lead.status]}</span></Link>)}</div>}
        </section>
        <section className="panel attention-panel">
          <div className="section-heading"><div><p className="eyebrow">CRM queue</p><h2>Follow-ups needing attention</h2></div><Link href="/dashboard/follow-ups" className="text-link">View all →</Link></div>
          {loading ? <div className="skeleton list-skeleton" /> : !loaded ? <div className="empty-state compact"><strong>Follow-ups unavailable</strong><p>Retry to load the current queue.</p></div> : pendingFollowUps.length === 0 ? <div className="empty-state compact"><span className="empty-icon">✓</span><strong>No pending follow-ups</strong><p>Your CRM queue is clear.</p></div> : <div className="attention-list">{pendingFollowUps.slice().sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).slice(0, 5).map(item => <Link href="/dashboard/follow-ups" className="attention-item" key={item.id}><span className={`attention-icon ${new Date(item.scheduledAt).getTime() < now ? 'overdue-icon' : ''}`}>!</span><span><strong>{item.lead.name || 'Unnamed lead'}</strong><small>{item.note} · {formatDate(item.scheduledAt)}</small></span><span className="row-arrow">→</span></Link>)}</div>}
        </section>
      </div>
    </div>
  );
}
