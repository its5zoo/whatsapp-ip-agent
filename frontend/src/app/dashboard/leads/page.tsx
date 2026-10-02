"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { Lead, LeadsResponse, LeadStatus } from '@/types';
import { formatPhoneDisplay } from '@/lib/formatters';

const flowLabels: Record<string, string> = { patent: 'Patent', trademark: 'Trademark', design: 'Design', copyright: 'Copyright', notsure: 'Not sure' };
const statusLabels: Record<LeadStatus, string> = { NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold', CONVERTED: 'Converted', NOT_INTERESTED: 'Not Interested', CLOSED: 'Closed' };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function LeadsPage() {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [flowType, setFlowType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchApi(`/admin/leads?page=${page}&limit=20&search=${encodeURIComponent(search)}&flowType=${encodeURIComponent(flowType)}`);
      setData(result);
    } catch {
      setError('We could not load leads. Please try again.');
    } finally { setLoading(false); }
  }, [page, search, flowType]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <div className="page-container">
    <header className="page-header"><div><p className="eyebrow">Workspace</p><h1>Leads</h1><p className="page-subtitle">Completed enquiries ready for your team to review.</p></div><span className="record-count">{data?.pagination.total ?? 0} records</span></header>
    <section className="toolbar panel"><label className="search-box"><span>⌕</span><input aria-label="Search leads" placeholder="Search name, email, mobile or organization" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><label className="select-wrap"><span>Service</span><select value={flowType} onChange={event => { setFlowType(event.target.value); setPage(1); }}><option value="">All services</option>{Object.entries(flowLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></section>
    {error && <div className="alert error-panel" role="alert"><span>{error}</span><button onClick={load} className="button subtle">Retry</button></div>}
    <section className="panel table-panel"><div className="table-wrap">{loading ? <div className="table-loading"><div className="skeleton line-skeleton" /><div className="skeleton line-skeleton" /><div className="skeleton line-skeleton" /></div> : data?.leads.length === 0 ? <div className="empty-state"><span className="empty-icon">⌕</span><strong>No leads found</strong><p>Try changing your search or service filter.</p></div> : <table className="data-table"><thead><tr><th>Lead</th><th>Service</th><th>Status</th><th>Phone</th><th>Location</th><th>Created</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{data?.leads.map((lead: Lead) => <tr key={lead.id}><td><Link href={`/dashboard/leads/${lead.id}`} className="lead-cell"><span className={`avatar flow-${lead.flowType}`}>{(lead.name || '?').slice(0, 1).toUpperCase()}</span><span><strong>{lead.name || 'Unnamed lead'}</strong><small>{lead.organization || lead.email || 'No organization'}</small></span></Link></td><td><span className={`service-label flow-${lead.flowType}`}>{flowLabels[lead.flowType] || lead.flowType}</span></td><td><span className={`status-pill status-${lead.status.toLowerCase()}`}>{statusLabels[lead.status] || lead.status}</span></td><td>{lead.mobile ?     <span className="phone-cell">{formatPhoneDisplay(lead.mobile)}</span> : '—'}</td><td>{lead.city || '—'}</td><td>{formatDate(lead.createdAt)}</td><td><Link href={`/dashboard/leads/${lead.id}`} className="row-action">View <span>→</span></Link></td></tr>)}</tbody></table>}</div>{data && data.pagination.totalPages > 1 && <div className="pagination"><button className="button subtle" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.pagination.totalPages}</span><button className="button subtle" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}</section>
  </div>;
}
