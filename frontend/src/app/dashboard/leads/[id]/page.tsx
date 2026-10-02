"use client";

import { FormEvent, useEffect, useState, use } from 'react';
import { Activity, FollowUp, InternalNote, Lead, LeadStatus } from '@/types';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { formatPhoneDisplay } from '@/lib/formatters';

const statusOptions: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'CLOSED', label: 'Closed' }
];

export default function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(true);
  const [followUpsError, setFollowUpsError] = useState('');
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [notesError, setNotesError] = useState('');
  const [activityError, setActivityError] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const loadLead = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}`);
        setLead(data.lead);
      } catch {
        setLead(null);
      } finally { setLoading(false); }
    };
    void loadLead();
    const loadFollowUps = async () => {
      try {
        const data = await fetchApi(`/admin/follow-ups?leadId=${id}`);
        setFollowUps(data.followUps || []);
      } catch {
        setFollowUpsError('Follow-ups could not be loaded.');
      } finally { setFollowUpsLoading(false); }
    };
    void loadFollowUps();
    const loadNotes = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}/notes`);
        setNotes(data.notes || []);
      } catch {
        setNotesError('Internal notes could not be loaded.');
      } finally { setNotesLoading(false); }
    };
    const loadActivity = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}/activity`);
        setActivities(data.activities || []);
      } catch {
        setActivityError('Activity history could not be loaded.');
      } finally { setActivityLoading(false); }
    };
    void loadNotes();
    void loadActivity();
  }, [id]);

  const updateStatus = async (status: LeadStatus) => {
    if (!lead || status === lead.status) return;
    setStatusError('');
    setStatusSaving(true);
    try {
      const data = await fetchApi(`/admin/leads/${lead.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setLead(data.lead);
      const activity = await fetchApi(`/admin/leads/${id}/activity`);
      setActivities(activity.activities || []);
    } catch {
      setStatusError('We could not update the lead status. Please try again.');
    } finally {
      setStatusSaving(false);
    }
  };

  const saveNote = async (event: FormEvent) => {
    event.preventDefault();
    const content = noteContent.trim();
    if (!content) return;
    setNoteSaving(true);
    setNotesError('');
    try {
      const endpoint = editingNoteId ? `/admin/notes/${editingNoteId}` : `/admin/leads/${id}/notes`;
      const data = await fetchApi(endpoint, { method: editingNoteId ? 'PATCH' : 'POST', body: JSON.stringify({ content }) });
      if (editingNoteId) {
        setNotes(current => current.map(note => note.id === editingNoteId ? data.note : note));
      } else {
        setNotes(current => [data.note, ...current]);
      }
      const activity = await fetchApi(`/admin/leads/${id}/activity`);
      setActivities(activity.activities || []);
      setNoteContent('');
      setEditingNoteId(null);
    } catch {
      setNotesError('The note could not be saved. Please try again.');
    } finally { setNoteSaving(false); }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await fetchApi(`/admin/notes/${noteId}`, { method: 'DELETE' });
      setNotes(current => current.filter(note => note.id !== noteId));
      const activity = await fetchApi(`/admin/leads/${id}/activity`);
      setActivities(activity.activities || []);
    } catch {
      setNotesError('The note could not be deleted. Please try again.');
    }
  };

  if (loading) return <div className="page-container"><div className="panel empty-state">Loading lead...</div></div>;
  if (!lead) return <div className="page-container"><div className="panel empty-state"><strong>Lead not found</strong><p>This lead may no longer be available.</p></div></div>;

  return <div className="page-container">
    <Link href="/dashboard/leads" className="back-link">← Back to leads</Link>
    <div className="detail-card">
      <div className="detail-title-row"><div><p className="eyebrow">Lead record</p><h1>{lead.name || 'Unnamed lead'}</h1></div><label className="status-select"><span className="sr-only">Lead status</span><select value={lead.status} disabled={statusSaving} onChange={event => { void updateStatus(event.target.value as LeadStatus); }}>{statusOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div>
      {statusError && <div className="alert error-panel" role="alert">{statusError}</div>}
      <section><h2 className="detail-section-title">Customer</h2><div className="meta-grid">
        <div><strong>Name</strong>{lead.name || '—'}</div><div><strong>Organization</strong>{lead.organization || '—'}</div><div><strong>Email</strong>{lead.email || '—'}</div><div><strong>Mobile</strong>{lead.mobile ? formatPhoneDisplay(lead.mobile) : '—'}</div><div><strong>City / country</strong>{lead.city || '—'}</div><div><strong>Created</strong>{new Date(lead.createdAt).toLocaleString()}</div>
      </div></section>
      <section><h2 className="detail-section-title">Enquiry</h2><div className="meta-grid">
        <div><strong>Service</strong><span className={`service-label flow-${lead.flowType}`}>{lead.flowType}</span></div><div><strong>Preferred communication</strong>{lead.preferredComm || '—'}</div><div><strong>Contact time</strong>{lead.phoneCallTime || '—'}</div>
      </div></section>
      <section><h2 className="detail-section-title">Questionnaire answers</h2><table className="table"><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>
        {lead.decodedAnswers?.map((answer, index) => <tr key={`${answer.questionId}-${index}`}><td>{answer.questionLabel}</td><td>{answer.displayValue}</td></tr>)}
      </tbody></table></section>
      <section><h2 className="detail-section-title">Follow-ups</h2>{followUpsLoading ? <div className="notice-box">Loading follow-ups...</div> : followUpsError ? <div className="notice-box error-text" role="alert">{followUpsError}</div> : followUps.length === 0 ? <div className="notice-box">No follow-ups scheduled for this Lead.</div> : <div className="detail-follow-ups">{followUps.map(followUp => <div className="detail-follow-up" key={followUp.id}><div><strong>{followUp.note}</strong><span>{new Date(followUp.scheduledAt).toLocaleString()}</span></div><span className={`status-pill follow-up-${followUp.status.toLowerCase()}`}>{followUp.status}</span></div>)}</div>}</section>
      <section><h2 className="detail-section-title">Internal notes</h2>{notesLoading ? <div className="notice-box">Loading notes...</div> : notesError ? <div className="notice-box error-text" role="alert">{notesError}</div> : <><form className="note-form" onSubmit={saveNote}><textarea aria-label="Internal note" value={noteContent} onChange={event => setNoteContent(event.target.value)} placeholder="Add an internal note for your team..." maxLength={5000} /><div><button className="button primary" disabled={noteSaving || !noteContent.trim()}>{editingNoteId ? 'Save note' : 'Add note'}</button>{editingNoteId && <button type="button" className="button subtle" onClick={() => { setEditingNoteId(null); setNoteContent(''); }}>Cancel</button>}</div></form>{notes.length === 0 ? <div className="notice-box">No internal notes yet.</div> : <div className="notes-list">{notes.map(note => <article className="note-card" key={note.id}><p>{note.content}</p><small>{new Date(note.updatedAt).toLocaleString()}</small><div><button className="text-button" onClick={() => { setEditingNoteId(note.id); setNoteContent(note.content); }}>Edit</button><button className="text-button danger-text" onClick={() => { void deleteNote(note.id); }}>Delete</button></div></article>)}</div>}</>}</section>
      <section><h2 className="detail-section-title">Activity</h2>{activityLoading ? <div className="notice-box">Loading activity...</div> : activityError ? <div className="notice-box error-text" role="alert">{activityError}</div> : activities.length === 0 ? <div className="notice-box">No CRM activity yet.</div> : <div className="activity-timeline">{activities.map(activity => <article className="activity-item" key={activity.id}><span className="activity-dot" /><div><strong>{activity.description}</strong><small>{new Date(activity.createdAt).toLocaleString()}</small></div></article>)}</div>}</section>
    </div>
  </div>;
}
