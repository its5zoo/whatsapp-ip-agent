"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { FollowUp, IncompleteConversation, Lead, LeadStats } from '@/types';
import { formatWhatsAppDisplayIdentity, formatStepDisplay } from '@/lib/formatters';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function getLeadInitials(name?: string, org?: string): string {
  if (name) {
    const clean = name.replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (clean.length > 0) return clean.slice(0, 2).toUpperCase();
  }
  if (org) {
    const parts = org.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return org.slice(0, 2).toUpperCase();
  }
  return 'IP';
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

  const [timeRange, setTimeRange] = useState('current_month');

  const timeRanges = [
    { id: 'current_month', label: 'This Month', shortLabel: 'Month' },
    { id: 'last_30_days', label: 'Last 30 Days', shortLabel: '30D' },
    { id: 'last_7_days', label: 'Last 7 Days', shortLabel: '7D' },
    { id: 'all_time', label: 'All Time', shortLabel: 'All' }
  ];

  const statusCounts = statusLeads.reduce<Record<string, number>>((counts, lead) => {
    counts[lead.status] = (counts[lead.status] || 0) + 1;
    return counts;
  }, {});
  const pendingFollowUps = followUps.filter(item => item.status === 'PENDING');
  const overdueFollowUps = pendingFollowUps.filter(item => new Date(item.scheduledAt).getTime() < now);
  const statusOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'IN_PROGRESS', 'ON_HOLD', 'CONVERTED', 'NOT_INTERESTED', 'CLOSED'];
  const statusLabels: Record<string, string> = { NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', IN_PROGRESS: 'In progress', ON_HOLD: 'On hold', CONVERTED: 'Converted', NOT_INTERESTED: 'Not interested', CLOSED: 'Closed' };
  const flowLabels: Record<string, string> = {
    patent: 'Patent',
    trademark: 'Trademark',
    design: 'Design',
    copyright: 'Copyright',
    notsure: 'General IP'
  };

  const statusIcons: Record<string, React.ReactNode> = {
    NEW: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
    CONTACTED: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
      </svg>
    ),
    QUALIFIED: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    IN_PROGRESS: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
    ON_HOLD: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    CONVERTED: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    NOT_INTERESTED: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
    CLOSED: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  };
  
  const cards = [
    {
      label: 'Total leads',
      value: stats?.totalLeads ?? 0,
      note: 'All completed enquiries',
      tone: 'blue',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      )
    },
    {
      label: 'Incomplete',
      value: incomplete.length,
      note: 'Needing attention',
      tone: 'amber',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      label: 'Follow-ups due',
      value: overdueFollowUps.length,
      note: 'Overdue reminders',
      tone: 'rose',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      label: 'Patent enquiries',
      value: stats?.byFlowType?.patent ?? 0,
      note: 'Inventions & specs',
      tone: 'indigo',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.82-7.915A4.002 4.002 0 0112 6c1.933 0 3.535 1.368 3.918 3.208A4.003 4.003 0 0112 14z" />
        </svg>
      )
    },
    {
      label: 'Trademark enquiries',
      value: stats?.byFlowType?.trademark ?? 0,
      note: 'Brand & marks',
      tone: 'emerald',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
  ];

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="page-header-text">
          <p className="eyebrow">Lead management</p>
          <h1>Overview</h1>
          <p className="page-subtitle">A clear view of the enquiries that need your team today.</p>
        </div>
        <div className="header-actions">
          <div className="time-toggle-group" role="tablist" aria-label="Select timeframe">
            {timeRanges.map(range => {
              const isActive = timeRange === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`time-toggle-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setTimeRange(range.id)}
                >
                  <span className="toggle-label-full">{range.label}</span>
                  <span className="toggle-label-short">{range.shortLabel}</span>
                </button>
              );
            })}
          </div>
          <Link href="/dashboard/leads" className="button primary view-leads-btn">
            <span>View all leads</span>
            <span className="btn-arrow">→</span>
          </Link>
        </div>
      </header>

      {error && <div className="alert error-panel" role="alert"><span>{error}</span><button onClick={load} className="button subtle">Retry</button></div>}
      {loading ? (
        <div className="skeleton-grid">
          {[1, 2, 3, 4, 5].map(item => <div className="skeleton stat-skeleton" key={item} />)}
        </div>
      ) : loaded ? (
        <section className="stats-grid" aria-label="Lead summary">
          {cards.map(card => (
            <div className={`stat-card tone-${card.tone}`} key={card.label}>
              <div className="stat-card-header">
                <span className="stat-label">{card.label}</span>
                <span className="stat-icon-wrapper">{card.icon}</span>
              </div>
              <strong className="stat-value">{card.value}</strong>
              <div className="stat-note">{card.note}</div>
            </div>
          ))}
        </section>
      ) : null}

      {loading ? (
        <div className="skeleton status-summary-skeleton" />
      ) : loaded ? (
        <section className="panel status-summary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pipeline</p>
              <h2>Leads by status</h2>
            </div>
            <div className="pipeline-meta">
              <span className="pipeline-badge">
                <svg className="pipeline-badge-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                <span>{statusLeads.length} leads total</span>
              </span>
            </div>
          </div>

          <div className="status-summary-grid">
            {statusOrder.map(status => {
              const count = statusCounts[status] || 0;
              const pct = statusLeads.length > 0 ? (count / statusLeads.length) * 100 : 0;
              return (
                <Link
                  key={status}
                  href={`/dashboard/leads?status=${status}`}
                  className={`status-summary-card tone-${status.toLowerCase()}`}
                  title={`View ${statusLabels[status]} leads`}
                >
                  <div className="status-card-left">
                    <span className="status-icon-box">
                      {statusIcons[status]}
                    </span>
                    <div className="status-name-wrap">
                      <span className="status-card-title">{statusLabels[status]}</span>
                      <span className="status-pct-label">{pct > 0 ? `${Math.round(pct)}% of leads` : '0 leads'}</span>
                    </div>
                  </div>
                  <div className="status-card-right">
                    <span className={`status-count-value ${count > 0 ? 'has-count' : 'zero-count'}`}>
                      {count}
                    </span>
                    <span className="status-card-arrow">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="overview-grid">
        <section className="panel attention-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Work queue</p>
              <h2>Needs attention</h2>
            </div>
            <Link href="/dashboard/conversations" className="text-link">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="skeleton list-skeleton" />
          ) : !loaded ? (
            <div className="empty-state compact">
              <strong>Overview unavailable</strong>
              <p>Retry to load current conversations.</p>
            </div>
          ) : incomplete.length === 0 ? (
            <div className="empty-state compact">
              <span className="empty-icon">✓</span>
              <strong>No incomplete conversations</strong>
              <p>Everyone is currently caught up.</p>
            </div>
          ) : (
            <div className="feed-list">
              {incomplete.slice(0, 5).map(item => {
                const stepInfo = formatStepDisplay(item.currentQuestionId);
                return (
                  <Link
                    href={`/dashboard/conversations/${item.id}`}
                    className="feed-item"
                    key={item.id}
                  >
                    <div className="feed-icon-box">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="feed-body">
                      <div className="feed-main-line">
                        <strong className="feed-title">
                          {formatWhatsAppDisplayIdentity(item.externalUserId)}
                        </strong>
                        {stepInfo.service && (
                          <span className="feed-tag">
                            {stepInfo.service}
                          </span>
                        )}
                      </div>
                      <div className="feed-sub-line">
                        <span className="step-label">{stepInfo.step}</span>
                        <span className="sep-bullet">·</span>
                        <span className="date-label">Updated {formatDate(item.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="feed-trail">
                      <span className="status-badge status-pending">
                        Incomplete
                      </span>
                      <svg className="feed-chevron" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest activity</p>
              <h2>Recent leads</h2>
            </div>
            <Link href="/dashboard/leads" className="text-link">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="skeleton list-skeleton" />
          ) : !loaded ? (
            <div className="empty-state compact">
              <strong>Overview unavailable</strong>
              <p>Retry to load current leads.</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="empty-state compact">
              <strong>No leads yet</strong>
              <p>Completed enquiries will appear here.</p>
            </div>
          ) : (
            <div className="feed-list">
              {leads.map(lead => (
                <Link href={`/dashboard/leads/${lead.id}`} className="feed-item" key={lead.id}>
                  <div className="feed-avatar">
                    {getLeadInitials(lead.name, lead.organization)}
                  </div>
                  <div className="feed-body">
                    <div className="feed-main-line">
                      <strong className="feed-title">{lead.name || 'Unnamed lead'}</strong>
                      {lead.organization && (
                        <span className="feed-company">· {lead.organization}</span>
                      )}
                    </div>
                    <div className="feed-sub-line">
                      <span className="feed-tag">{flowLabels[lead.flowType] || lead.flowType}</span>
                      {lead.city && (
                        <>
                          <span className="sep-bullet">·</span>
                          <span>{lead.city}</span>
                        </>
                      )}
                      <span className="sep-bullet">·</span>
                      <span>{formatDate(lead.createdAt)}</span>
                    </div>
                  </div>
                  <div className="feed-trail">
                    <span className={`status-badge status-${lead.status.toLowerCase().replace(/_/g, '-')}`}>
                      {statusLabels[lead.status] || lead.status}
                    </span>
                    <svg className="feed-chevron" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="panel attention-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CRM queue</p>
              <h2>Follow-ups needing attention</h2>
            </div>
            <Link href="/dashboard/follow-ups" className="text-link">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="skeleton list-skeleton" />
          ) : !loaded ? (
            <div className="empty-state compact">
              <strong>Follow-ups unavailable</strong>
              <p>Retry to load the current queue.</p>
            </div>
          ) : pendingFollowUps.length === 0 ? (
            <div className="empty-state compact">
              <span className="empty-icon">✓</span>
              <strong>No pending follow-ups</strong>
              <p>Your CRM queue is clear.</p>
            </div>
          ) : (
            <div className="attention-list">
              {pendingFollowUps
                .slice()
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .slice(0, 5)
                .map(item => {
                  const isOverdue = new Date(item.scheduledAt).getTime() < now;
                  return (
                    <Link href="/dashboard/follow-ups" className="attention-item" key={item.id}>
                      <div className={`attention-avatar ${isOverdue ? 'is-overdue' : ''}`}>
                        <svg className="attention-avatar-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="attention-details">
                        <div className="attention-title-row">
                          <strong className="attention-phone">{item.lead.name || 'Unnamed lead'}</strong>
                          {isOverdue && <span className="overdue-tag">Overdue</span>}
                        </div>
                        <div className="attention-subtitle">
                          <span className="step-label">{item.note}</span>
                          <span className="sep-bullet">·</span>
                          <span className="date-label">{formatDate(item.scheduledAt)}</span>
                        </div>
                      </div>
                      <span className="row-arrow">→</span>
                    </Link>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
