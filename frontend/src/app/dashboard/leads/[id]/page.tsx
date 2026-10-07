"use client";

import { FormEvent, useEffect, useState, use } from 'react';
import { Activity, FollowUp, InternalNote, Lead, LeadStatus } from '@/types';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { formatPhoneDisplay } from '@/lib/formatters';
import CustomSelect, { SelectOption } from '@/components/CustomSelect';

const statusOptions: SelectOption[] = [
  { value: 'NEW', label: 'New Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'CLOSED', label: 'Closed' }
];

function getInitials(name?: string): string {
  if (!name) return 'LD';
  const clean = name.replace(/^Dr\.\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'LD';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const loadLead = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}`);
        setLead(data.lead);
      } catch {
        setLead(null);
      } finally {
        setLoading(false);
      }
    };
    void loadLead();

    const loadFollowUps = async () => {
      try {
        const data = await fetchApi(`/admin/follow-ups?leadId=${id}`);
        setFollowUps(data.followUps || []);
      } catch {
        setFollowUpsError('Follow-ups could not be loaded.');
      } finally {
        setFollowUpsLoading(false);
      }
    };
    void loadFollowUps();

    const loadNotes = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}/notes`);
        setNotes(data.notes || []);
      } catch {
        setNotesError('Internal notes could not be loaded.');
      } finally {
        setNotesLoading(false);
      }
    };
    const loadActivity = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}/activity`);
        setActivities(data.activities || []);
      } catch {
        setActivityError('Activity history could not be loaded.');
      } finally {
        setActivityLoading(false);
      }
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

  const copyText = (text: string, copyKey: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(copyKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveNote = async (event: FormEvent) => {
    event.preventDefault();
    const content = noteContent.trim();
    if (!content) return;
    setNoteSaving(true);
    setNotesError('');
    try {
      const endpoint = editingNoteId ? `/admin/notes/${editingNoteId}` : `/admin/leads/${id}/notes`;
      const data = await fetchApi(endpoint, {
        method: editingNoteId ? 'PATCH' : 'POST',
        body: JSON.stringify({ content })
      });
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
    } finally {
      setNoteSaving(false);
    }
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

  if (loading) {
    return (
      <div className="page-container formal-lead-page">
        <div className="panel empty-state">
          <div className="empty-icon">⏳</div>
          <strong>Loading client details...</strong>
          <p>Retrieving intake discovery and CRM record</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="page-container formal-lead-page">
        <div className="panel empty-state">
          <div className="empty-icon">🔍</div>
          <strong>Lead record not found</strong>
          <p>This record may have been archived or removed from the workspace.</p>
          <Link href="/dashboard/leads" className="button primary" style={{ marginTop: '14px' }}>
            Back to Leads
          </Link>
        </div>
      </div>
    );
  }

  const rawPhone = lead.mobile ? lead.mobile.replace(/[^\d]/g, '') : '';
  const waUrl = rawPhone ? `https://wa.me/${rawPhone}` : null;
  const telUrl = lead.mobile ? `tel:${lead.mobile}` : null;
  const mailUrl = lead.email ? `mailto:${lead.email}` : null;

  return (
    <div className="page-container formal-lead-page">
      {/* 1. Formal Top Navigation Bar */}
      <div className="formal-breadcrumb-row">
        <Link href="/dashboard/leads" className="formal-back-link">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span>Back to leads</span>
        </Link>
        <nav className="formal-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="formal-sep">/</span>
          <Link href="/dashboard/leads">Leads</Link>
          <span className="formal-sep">/</span>
          <span className="formal-current">{lead.name || 'Lead Record'}</span>
        </nav>
      </div>

      {/* 2. Formal Header Banner */}
      <div className="formal-header-card">
        <div className="formal-header-main">
          <div className="formal-avatar">
            {getInitials(lead.name)}
          </div>
          <div className="formal-header-details">
            <div className="formal-meta-line-top">
              <span className={`formal-status-tag status-${lead.status.toLowerCase()}`}>
                {lead.status.replace(/_/g, ' ')}
              </span>
              <span className="formal-id-tag">ID: {lead.id}</span>
              <span className="formal-flow-tag">{lead.flowType}</span>
            </div>

            <h1 className="formal-lead-title">{lead.name || 'Unnamed Lead'}</h1>

            <div className="formal-meta-line-sub">
              {lead.organization && (
                <span className="formal-meta-item">
                  <strong>Organization:</strong> {lead.organization}
                </span>
              )}
              {lead.city && (
                <span className="formal-meta-item">
                  <strong>Location:</strong> {lead.city}
                </span>
              )}
              <span className="formal-meta-item">
                <strong>Ingested:</strong> {formatDate(lead.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions: Clean Status Control & Formal Action Buttons */}
        <div className="formal-header-actions">
          <div className="formal-status-control">
            <label className="formal-control-label">Lead Status</label>
            <CustomSelect
              value={lead.status}
              onChange={val => void updateStatus(val as LeadStatus)}
              options={statusOptions}
              disabled={statusSaving}
              className="formal-status-select"
            />
          </div>

          <div className="formal-contact-control">
            <label className="formal-control-label">Quick Actions</label>
            <div className="formal-contact-buttons">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="formal-btn formal-btn-wa"
                  title="Open WhatsApp chat"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#16a34a">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.67-1.39 1.29-1.93 1.37-.5.08-1.12.12-3.63-.91-3.21-1.32-5.27-4.57-5.43-4.78-.16-.21-1.3-1.73-1.3-3.3 0-1.57.82-2.34 1.11-2.66.29-.32.64-.4.86-.4.21 0 .43.01.62.01.2 0 .46-.07.72.55.26.63.89 2.18.97 2.34.08.16.13.35.03.56-.11.21-.16.35-.32.53-.16.19-.34.42-.48.56-.16.16-.33.34-.14.66.19.32.84 1.38 1.8 2.24 1.24 1.1 2.29 1.44 2.61 1.6.32.16.51.13.7-.08.19-.21.82-.96 1.04-1.29.22-.32.45-.27.75-.16.3.11 1.9.9 2.23 1.06.32.16.54.24.62.38.08.14.08.82-.16 1.49z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>
              )}
              {mailUrl && (
                <a
                  href={mailUrl}
                  className="formal-btn"
                  title="Send email"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  <span>Email</span>
                </a>
              )}
              {telUrl && (
                <a
                  href={telUrl}
                  className="formal-btn"
                  title="Place phone call"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  <span>Call</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {statusError && (
        <div className="alert error-panel" role="alert" style={{ marginBottom: '22px' }}>
          <span>{statusError}</span>
          <button type="button" className="button subtle" onClick={() => setStatusError('')}>
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main 2-Column Responsive Layout */}
      <div className="formal-layout-grid">
        {/* Left Column (65% width): Profile Record & Discovery Questions */}
        <div className="formal-main-col">
          {/* Card 1: Client & Enquiry Record (Formal Structured Specification) */}
          <section className="formal-panel">
            <div className="formal-panel-header">
              <div>
                <h2 className="formal-panel-title">Client Profile & Contact Specifications</h2>
                <p className="formal-panel-desc">Primary customer records and contact preferences</p>
              </div>
            </div>

            <div className="formal-divider" />

            <div className="formal-spec-grid">
              {/* Column 1: Client Details */}
              <div className="formal-spec-col">
                <div className="formal-spec-row">
                  <span className="formal-spec-key">Full Name</span>
                  <span className="formal-spec-val highlight">{lead.name || '—'}</span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Organization</span>
                  <span className="formal-spec-val">{lead.organization || 'Individual / None'}</span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Email Address</span>
                  <span className="formal-spec-val">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="formal-link">
                        {lead.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Mobile Number</span>
                  <span className="formal-spec-val">
                    {lead.mobile ? (
                      <a href={`tel:${lead.mobile}`} className="formal-link">
                        {formatPhoneDisplay(lead.mobile)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Record ID</span>
                  <span className="formal-spec-val">{lead.id}</span>
                </div>
              </div>

              {/* Column 2: Ingestion & Contact Window */}
              <div className="formal-spec-col">
                <div className="formal-spec-row">
                  <span className="formal-spec-key">City / Country</span>
                  <span className="formal-spec-val">{lead.city || '—'}</span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Service Category</span>
                  <span className="formal-spec-val">
                    <span className="formal-solid-pill">{lead.flowType}</span>
                  </span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Preferred Channel</span>
                  <span className="formal-spec-val">{lead.preferredComm || 'WhatsApp'}</span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Contact Window</span>
                  <span className="formal-spec-val">{lead.phoneCallTime || 'Office hours'}</span>
                </div>

                <div className="formal-spec-row">
                  <span className="formal-spec-key">Created Date</span>
                  <span className="formal-spec-val">{formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Intake Questionnaire Discovery (Executive Formal Q&A Record) */}
          <section className="formal-panel">
            <div className="formal-panel-header">
              <div>
                <h2 className="formal-panel-title">Intake Questionnaire Discovery</h2>
                <p className="formal-panel-desc">Recorded responses from automated client discovery session</p>
              </div>
              <span className="formal-count-badge">
                {lead.decodedAnswers?.length || 0} Responses
              </span>
            </div>

            <div className="formal-divider" />

            {lead.decodedAnswers && lead.decodedAnswers.length > 0 ? (
              <div className="formal-qa-list">
                {lead.decodedAnswers.map((answer, index) => {
                  const itemKey = `${answer.questionId}-${index}`;
                  const answerVal = answer.displayValue || answer.rawValue || '—';
                  const padIndex = (index + 1).toString().padStart(2, '0');
                  return (
                    <div className="formal-qa-item" key={itemKey}>
                      <div className="formal-qa-header">
                        <span className="formal-qa-label">
                          {padIndex}. {answer.questionLabel}
                        </span>
                        <button
                          type="button"
                          className="formal-copy-btn"
                          onClick={() => copyText(answerVal, itemKey)}
                          title="Copy response to clipboard"
                        >
                          {copiedId === itemKey ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="formal-qa-body">
                        {answerVal}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="formal-empty-box">
                <p>No questionnaire responses on file for this lead.</p>
              </div>
            )}
          </section>

          {/* Card 3: Other Enquiries by this Customer */}
          {lead.otherEnquiries && lead.otherEnquiries.length > 0 && (
            <section className="formal-panel">
              <div className="formal-panel-header">
                <div>
                  <h2 className="formal-panel-title">Other Enquiries by this Customer</h2>
                  <p className="formal-panel-desc">Related applications and cross-referenced matters</p>
                </div>
                <span className="formal-count-badge">
                  {lead.otherEnquiries.length} Linked
                </span>
              </div>

              <div className="formal-divider" />

              <div className="formal-linked-list">
                {lead.otherEnquiries.map(other => (
                  <Link
                    href={`/dashboard/leads/${other.id}`}
                    className="formal-linked-item"
                    key={other.id}
                  >
                    <div className="formal-linked-info">
                      <span className="formal-linked-title">{other.flowType}</span>
                      <span className="formal-linked-sub">Submitted {formatDate(other.createdAt)}</span>
                    </div>
                    <div className="formal-linked-meta">
                      <span className={`formal-status-tag status-${other.status.toLowerCase()}`}>
                        {other.status.replace(/_/g, ' ')}
                      </span>
                      <span className="formal-linked-arrow">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (35% width): Follow-ups, Internal Notes, Activity */}
        <div className="formal-side-col">
          {/* Card 4: Scheduled Follow-ups */}
          <section className="formal-panel">
            <div className="formal-panel-header">
              <div>
                <h2 className="formal-panel-title">Scheduled Follow-ups</h2>
                <p className="formal-panel-desc">Upcoming tasks & reminders</p>
              </div>
              <Link href="/dashboard/follow-ups" className="formal-panel-link">
                Calendar →
              </Link>
            </div>

            <div className="formal-divider" />

            {followUpsLoading ? (
              <div className="formal-empty-box">Loading follow-ups...</div>
            ) : followUpsError ? (
              <div className="formal-empty-box error-text">{followUpsError}</div>
            ) : followUps.length === 0 ? (
              <div className="formal-empty-box">
                <p>No follow-ups scheduled for this client.</p>
                <Link href="/dashboard/follow-ups" className="button subtle" style={{ fontSize: '12px', marginTop: '8px' }}>
                  + Add in Calendar
                </Link>
              </div>
            ) : (
              <div className="formal-followup-list">
                {followUps.map(fu => (
                  <div className="formal-followup-item" key={fu.id}>
                    <div className="formal-followup-top">
                      <span className="formal-followup-date">{formatDate(fu.scheduledAt)}</span>
                      <span className={`formal-status-tag status-${fu.status.toLowerCase()}`}>
                        {fu.status}
                      </span>
                    </div>
                    <p className="formal-followup-note">{fu.note}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Card 5: Internal Team Notes */}
          <section className="formal-panel">
            <div className="formal-panel-header">
              <div>
                <h2 className="formal-panel-title">Internal Team Notes</h2>
                <p className="formal-panel-desc">Legal briefing notes & internal consultation logs</p>
              </div>
              <span className="formal-count-badge">{notes.length} Notes</span>
            </div>

            <div className="formal-divider" />

            {notesError && (
              <div className="alert error-panel" role="alert" style={{ marginBottom: '14px' }}>
                {notesError}
              </div>
            )}

            <form onSubmit={saveNote} className="formal-note-form">
              <textarea
                className="formal-note-input"
                aria-label="Internal note"
                value={noteContent}
                onChange={event => setNoteContent(event.target.value)}
                placeholder="Write an internal briefing or consultation note..."
                maxLength={5000}
                rows={3}
              />
              <div className="formal-note-actions">
                {editingNoteId && (
                  <button
                    type="button"
                    className="button subtle"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteContent('');
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="formal-submit-btn"
                  disabled={noteSaving || !noteContent.trim()}
                >
                  {noteSaving ? 'Saving...' : editingNoteId ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </form>

            {notesLoading ? (
              <div className="formal-empty-box">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="formal-empty-box">No internal notes recorded yet.</div>
            ) : (
              <div className="formal-notes-list">
                {notes.map(note => (
                  <article className="formal-note-item" key={note.id}>
                    <div className="formal-note-header">
                      <span className="formal-note-author">Associate Counsel</span>
                      <span className="formal-note-time">{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="formal-note-content">{note.content}</p>
                    <div className="formal-note-actions-row">
                      <button
                        type="button"
                        className="formal-action-link"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setNoteContent(note.content);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="formal-action-link danger"
                        onClick={() => void deleteNote(note.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Card 6: CRM Activity Audit Trail */}
          <section className="formal-panel">
            <div className="formal-panel-header">
              <div>
                <h2 className="formal-panel-title">Audit Trail & Activity</h2>
                <p className="formal-panel-desc">Chronological record of status progression</p>
              </div>
              <span className="formal-count-badge">{activities.length} Events</span>
            </div>

            <div className="formal-divider" />

            {activityLoading ? (
              <div className="formal-empty-box">Loading activity...</div>
            ) : activityError ? (
              <div className="formal-empty-box error-text">{activityError}</div>
            ) : activities.length === 0 ? (
              <div className="formal-empty-box">No activity events recorded yet.</div>
            ) : (
              <div className="formal-timeline">
                {activities.map(act => (
                  <div className="formal-timeline-item" key={act.id}>
                    <div className="formal-timeline-dot" />
                    <div className="formal-timeline-body">
                      <p className="formal-timeline-desc">{act.description}</p>
                      <span className="formal-timeline-date">{formatDate(act.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
