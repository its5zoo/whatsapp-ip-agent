"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { FollowUp, Lead, LeadsResponse } from '@/types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function FollowUpCard({ followUp, onAction, onReschedule }: { followUp: FollowUp; onAction: (id: string, action: 'complete' | 'cancel') => void; onReschedule: (id: string, scheduledAt: string) => void }) {
  const [date, setDate] = useState(followUp.scheduledAt.slice(0, 16));
  return <article className="follow-up-card">
    <div className="follow-up-card-header">
      <div><strong>{followUp.lead.name || 'Unnamed lead'}</strong><small>{followUp.lead.organization || 'No organization'}</small></div>
      <span className={`status-pill follow-up-${followUp.status.toLowerCase()}`}>{followUp.status === 'PENDING' ? 'Pending' : followUp.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}</span>
    </div>
    <p className="follow-up-date">{formatDate(followUp.scheduledAt)}</p>
    <p className="follow-up-note">{followUp.note}</p>
    {followUp.status === 'PENDING' && <div className="follow-up-actions">
      <input aria-label={`Reschedule ${followUp.lead.name || 'follow-up'}`} type="datetime-local" value={date} onChange={event => setDate(event.target.value)} />
      <button className="button subtle" onClick={() => onReschedule(followUp.id, new Date(date).toISOString())}>Reschedule</button>
      <button className="button subtle" onClick={() => onAction(followUp.id, 'complete')}>Mark complete</button>
      <button className="button subtle" onClick={() => onAction(followUp.id, 'cancel')}>Cancel</button>
    </div>}
  </article>;
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [leadId, setLeadId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi('/admin/follow-ups');
      setFollowUps(data.followUps || []);
    } catch {
      setError('We could not load follow-ups. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const loadLeads = async () => {
      try {
        const data: LeadsResponse = await fetchApi('/admin/leads?page=1&limit=100');
        setLeads(data.leads);
        if (data.leads[0]) setLeadId(data.leads[0].id);
      } catch {
        setFormError('Leads could not be loaded, so a follow-up cannot be created yet.');
      } finally { setFormLoading(false); }
    };
    void loadLeads();
  }, [load]);

  const groups = useMemo(() => {
    const now = Date.now();
    return {
      today: followUps.filter(item => item.status === 'PENDING' && new Date(item.scheduledAt).toDateString() === new Date().toDateString()),
      upcoming: followUps.filter(item => item.status === 'PENDING' && new Date(item.scheduledAt).getTime() >= now && new Date(item.scheduledAt).toDateString() !== new Date().toDateString()),
      overdue: followUps.filter(item => item.status === 'PENDING' && new Date(item.scheduledAt).getTime() < now),
      completed: followUps.filter(item => item.status === 'COMPLETED' || item.status === 'CANCELLED')
    };
  }, [followUps]);

  const createFollowUp = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      await fetchApi('/admin/follow-ups', {
        method: 'POST',
        body: JSON.stringify({ leadId, scheduledAt: new Date(scheduledAt).toISOString(), note })
      });
      await load();
      setScheduledAt('');
      setNote('');
    } catch {
      setFormError('We could not create the follow-up. Check the details and try again.');
    }
  };

  const action = async (id: string, actionName: 'complete' | 'cancel') => {
    try {
      const data = await fetchApi(`/admin/follow-ups/${id}/${actionName}`, { method: 'POST' });
      setFollowUps(current => current.map(item => item.id === id ? data.followUp : item));
      await load();
    } catch {
      setError('The follow-up could not be updated. Please try again.');
    }
  };

  const reschedule = async (id: string, nextDate: string) => {
    try {
      const data = await fetchApi(`/admin/follow-ups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt: nextDate })
      });
      setFollowUps(current => current.map(item => item.id === id ? data.followUp : item));
      await load();
    } catch {
      setError('The follow-up could not be rescheduled. Please try again.');
    }
  };

  const section = (title: string, items: FollowUp[]) => <section className="follow-up-group">
    <div className="follow-up-group-header"><h2>{title}</h2><span>{items.length}</span></div>
    {items.length === 0 ? <div className="follow-up-empty">No {title.toLowerCase()} follow-ups.</div> : <div className="follow-up-list">{items.map(item => <FollowUpCard key={item.id} followUp={item} onAction={action} onReschedule={reschedule} />)}</div>}
  </section>;

  return <div className="page-container">
    <header className="page-header"><div><p className="eyebrow">Workspace</p><h1>Follow-ups</h1><p className="page-subtitle">Keep track of the conversations that need a personal touch.</p></div><span className="record-count">{followUps.length} records</span></header>
    <section className="panel follow-up-form"><div><p className="eyebrow">New follow-up</p><h2>Schedule a reminder</h2></div><form onSubmit={createFollowUp} className="follow-up-form-grid">
      <label>Lead<select required disabled={formLoading} value={leadId} onChange={event => setLeadId(event.target.value)}><option value="">Select a lead</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name || 'Unnamed lead'}{lead.organization ? ` — ${lead.organization}` : ''}</option>)}</select></label>
      <label>Date and time<input required type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} /></label>
      <label className="follow-up-note-field">Note<input required value={note} onChange={event => setNote(event.target.value)} placeholder="What should the team follow up on?" /></label>
      <button className="button primary" type="submit" disabled={formLoading || !leadId}>Create follow-up</button>
    </form>{formError && <div className="alert error-panel" role="alert">{formError}</div>}</section>
    {error && <div className="alert error-panel" role="alert"><span>{error}</span><button className="button subtle" onClick={load}>Retry</button></div>}
    {loading ? <div className="panel empty-state">Loading follow-ups...</div> : <>{section('Today', groups.today)}{section('Upcoming', groups.upcoming)}{section('Overdue', groups.overdue)}{section('Completed and cancelled', groups.completed)}</>}
  </div>;
}
