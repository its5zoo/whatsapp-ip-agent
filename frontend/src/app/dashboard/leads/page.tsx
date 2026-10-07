"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { Lead, LeadsResponse, LeadStatus } from '@/types';
import { formatPhoneDisplay } from '@/lib/formatters';
import CustomSelect from '@/components/CustomSelect';
import DatePicker from '@/components/DatePicker';

const flowLabels: Record<string, string> = { patent: 'Patent', trademark: 'Trademark', design: 'Design', copyright: 'Copyright', notsure: 'Not sure' };
const statusLabels: Record<LeadStatus, string> = { NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold', CONVERTED: 'Converted', NOT_INTERESTED: 'Not Interested', CLOSED: 'Closed' };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function LeadsPage() {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [flowType, setFlowType] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const serviceOptions = useMemo(() => [
    { value: '', label: 'All services' },
    ...Object.entries(flowLabels).map(([value, label]) => ({ value, label }))
  ], []);

  const statusOptions = useMemo(() => [
    { value: '', label: 'All statuses' },
    ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))
  ], []);

  const sourceOptions = useMemo(() => [
    { value: '', label: 'All sources' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'simulator', label: 'Simulator' }
  ], []);

  const hasActiveFilters = Boolean(search || flowType || status || city || source || dateFrom || dateTo);

  const resetFilters = () => {
    setSearch('');
    setFlowType('');
    setStatus('');
    setCity('');
    setSource('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
        flowType,
        status,
        city,
        source,
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : '',
        dateTo: dateTo
          ? new Date(new Date(`${dateTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
          : ''
      });
      const result = await fetchApi(`/admin/leads?${params.toString()}`);
      setData(result);
    } catch {
      setError('We could not load leads. Please try again.');
    } finally { setLoading(false); }
  }, [page, search, flowType, status, city, source, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Leads</h1>
          <p className="page-subtitle">Completed enquiries ready for your team to review.</p>
        </div>
        <span className="record-count">{data?.pagination.total ?? 0} records</span>
      </header>

      {/* Modern Filter Toolbar Card */}
      <section className="leads-filter-card panel">
        {/* Search Row */}
        <div className="leads-search-row">
          <div className="leads-search-input-wrap">
            <svg className="leads-search-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              aria-label="Search leads"
              placeholder="Search by name, email, mobile, or organization..."
              value={search}
              onChange={event => { setSearch(event.target.value); setPage(1); }}
              className="leads-search-input"
            />
            {search && (
              <button
                type="button"
                className="leads-search-clear"
                onClick={() => { setSearch(''); setPage(1); }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button type="button" className="leads-reset-btn" onClick={resetFilters}>
              Reset filters
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="leads-filter-grid">
          <div className="leads-filter-col">
            <label className="leads-filter-label">Service</label>
            <CustomSelect
              value={flowType}
              onChange={val => { setFlowType(val); setPage(1); }}
              options={serviceOptions}
              placeholder="All services"
            />
          </div>

          <div className="leads-filter-col">
            <label className="leads-filter-label">Status</label>
            <CustomSelect
              value={status}
              onChange={val => { setStatus(val); setPage(1); }}
              options={statusOptions}
              placeholder="All statuses"
            />
          </div>

          <div className="leads-filter-col">
            <label className="leads-filter-label">City</label>
            <div className="leads-city-wrap">
              <input
                value={city}
                onChange={event => { setCity(event.target.value); setPage(1); }}
                placeholder="Any city"
                className="leads-city-input"
              />
              {city && (
                <button
                  type="button"
                  className="leads-input-clear"
                  onClick={() => { setCity(''); setPage(1); }}
                  aria-label="Clear city"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="leads-filter-col">
            <label className="leads-filter-label">Source</label>
            <CustomSelect
              value={source}
              onChange={val => { setSource(val); setPage(1); }}
              options={sourceOptions}
              placeholder="All sources"
            />
          </div>

          <div className="leads-filter-col">
            <label className="leads-filter-label">From</label>
            <DatePicker
              value={dateFrom}
              onChange={val => { setDateFrom(val); setPage(1); }}
              placeholder="From date"
            />
          </div>

          <div className="leads-filter-col">
            <label className="leads-filter-label">To</label>
            <DatePicker
              value={dateTo}
              onChange={val => { setDateTo(val); setPage(1); }}
              placeholder="To date"
              align="right"
            />
          </div>
        </div>
      </section>

      {error && <div className="alert error-panel" role="alert"><span>{error}</span><button onClick={load} className="button subtle">Retry</button></div>}

      <section className="panel table-panel">
        <div className="table-wrap">
          {loading ? (
            <div className="table-loading">
              <div className="skeleton line-skeleton" />
              <div className="skeleton line-skeleton" />
              <div className="skeleton line-skeleton" />
            </div>
          ) : data?.leads.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">⌕</span>
              <strong>No leads found</strong>
              <p>Try changing your search or service filter.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Created</th>
                  <th><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {data?.leads.map((lead: Lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/dashboard/leads/${lead.id}`} className="lead-cell">
                        <span className={`avatar flow-${lead.flowType}`}>
                          {(lead.name || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{lead.name || 'Unnamed lead'}</strong>
                          <small>{lead.organization || lead.email || 'No organization'}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`service-label flow-${lead.flowType}`}>
                        {flowLabels[lead.flowType] || lead.flowType}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${lead.status.toLowerCase()}`}>
                        {statusLabels[lead.status] || lead.status}
                      </span>
                    </td>
                    <td>
                      {lead.mobile ? <span className="phone-cell">{formatPhoneDisplay(lead.mobile)}</span> : '—'}
                    </td>
                    <td>{lead.city || '—'}</td>
                    <td>{formatDate(lead.createdAt)}</td>
                    <td>
                      <Link href={`/dashboard/leads/${lead.id}`} className="row-action">
                        View <span>→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="button subtle" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {data.pagination.totalPages}
            </span>
            <button className="button subtle" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
