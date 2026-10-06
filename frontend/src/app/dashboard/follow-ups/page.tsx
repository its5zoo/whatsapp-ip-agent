"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchApi, getApiErrorMessage } from '@/lib/api';
import { FollowUp, Lead, LeadsResponse } from '@/types';
import DateTimePicker from '@/components/DateTimePicker';
import CustomSelect from '@/components/CustomSelect';

function getInitials(name: string) {
  const clean = name.replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LE';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFollowUpDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);

  if (isToday) {
    return `Today · ${timeStr}`;
  }
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function getDateTone(scheduledAt: string, isPending: boolean) {
  if (!isPending) return 'neutral';
  const time = new Date(scheduledAt).getTime();
  const now = Date.now();
  if (time < now) return 'overdue';
  const isToday = new Date(scheduledAt).toDateString() === new Date().toDateString();
  if (isToday) return 'today';
  return 'upcoming';
}

function FollowUpCard({
  followUp,
  onAction,
  onReschedule
}: {
  followUp: FollowUp;
  onAction: (id: string, action: 'complete' | 'cancel') => void;
  onReschedule: (id: string, scheduledAt: string, note: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [date, setDate] = useState(followUp.scheduledAt.slice(0, 16));
  const [note, setNote] = useState(followUp.note);

  const isPending = followUp.status === 'PENDING';
  const isOverdue = isPending && new Date(followUp.scheduledAt).getTime() < Date.now();
  const dateTone = getDateTone(followUp.scheduledAt, isPending);

  const handleSave = () => {
    if (!date || !note.trim()) return;
    onReschedule(followUp.id, new Date(date).toISOString(), note.trim());
    setIsEditing(false);
  };

  const handleDiscard = () => {
    setDate(followUp.scheduledAt.slice(0, 16));
    setNote(followUp.note);
    setIsEditing(false);
  };

  const leadName = followUp.lead?.name || 'Unnamed lead';
  const leadOrg = followUp.lead?.organization || '';
  const initials = getInitials(leadName);

  return (
    <article className={`followup-ticket tone-${dateTone} ${isPending ? 'is-pending' : 'is-resolved'}`}>
      {/* 1. Top Status Bar: Urgency Pill + Cancel link */}
      <div className="ticket-top-bar">
        <div className={`ticket-urgency-pill tone-${dateTone}`}>
          <span className="urgency-text">
            {isOverdue ? 'Overdue · ' : ''}{formatFollowUpDate(followUp.scheduledAt)}
          </span>
        </div>

        {isPending && (
          <button
            type="button"
            className="btn-cancel-link"
            title="Cancel this follow-up"
            onClick={() => onAction(followUp.id, 'cancel')}
          >
            Cancel
          </button>
        )}
      </div>

      {/* 2. Client Identity (Full width, no cramped truncation) */}
      <div className="ticket-client-row">
        <div className={`client-avatar tone-${dateTone}`} aria-hidden="true">
          {initials}
        </div>
        <div className="client-info">
          <Link
            href={`/dashboard/leads/${followUp.lead?.id || followUp.leadId}`}
            className="client-name"
            title={`View profile for ${leadName}`}
          >
            {leadName}
          </Link>
          {leadOrg && (
            <div className="client-org">
              <svg className="org-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span>{leadOrg}</span>
            </div>
          )}
        </div>
      </div>

      {!isEditing ? (
        <>
          {/* 3. Task Note Box */}
          <div className="ticket-task-card">
            <div className="task-card-header">
              <svg className="task-card-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <span className="task-card-tag">Follow-up Task</span>
            </div>
            <p className="task-card-note">{followUp.note}</p>
          </div>

          {/* 4. Action Row */}
          {isPending ? (
            <div className="ticket-action-bar">
              <button
                type="button"
                className="btn-complete-action"
                onClick={() => onAction(followUp.id, 'complete')}
              >
                <svg className="btn-action-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Complete</span>
              </button>
              <button
                type="button"
                className="btn-reschedule-action"
                onClick={() => setIsEditing(true)}
              >
                <svg className="btn-action-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>Reschedule</span>
              </button>
            </div>
          ) : (
            <div className="ticket-resolved-bar">
              {followUp.status === 'COMPLETED' ? (
                <span className="resolved-status-badge completed">
                  <svg className="resolved-status-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Completed</span>
                </span>
              ) : (
                <span className="resolved-status-badge cancelled">
                  <svg className="resolved-status-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Cancelled</span>
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        /* In-line Reschedule Form */
        <div className="ticket-reschedule-panel">
          <div className="reschedule-field">
            <label>New date & time</label>
            <DateTimePicker
              value={date}
              onChange={val => setDate(val)}
              placeholder="Select new date & time"
            />
          </div>
          <div className="reschedule-field">
            <label>Updated task note</label>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={3}
              className="reschedule-textarea"
              placeholder="What should the team follow up on?"
            />
          </div>
          <div className="reschedule-buttons-row">
            <button
              type="button"
              className="btn-save-reschedule"
              disabled={!date || !note.trim()}
              onClick={handleSave}
            >
              Save changes
            </button>
            <button
              type="button"
              className="btn-discard-reschedule"
              onClick={handleDiscard}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
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
    } catch (error) {
      setError(getApiErrorMessage(error, 'We could not load follow-ups. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const loadLeads = async () => {
      try {
        const data: LeadsResponse = await fetchApi('/admin/leads?page=1&limit=100');
        setLeads(data.leads || []);
        if (data.leads && data.leads[0]) setLeadId(data.leads[0].id);
      } catch (error) {
        setFormError(getApiErrorMessage(error, 'Leads could not be loaded, so a follow-up cannot be created yet.'));
      } finally {
        setFormLoading(false);
      }
    };
    void loadLeads();
  }, [load]);

  const groups = useMemo(() => {
    const now = Date.now();
    return {
      today: followUps.filter(item => item.status === 'PENDING' && new Date(item.scheduledAt).toDateString() === new Date().toDateString() && new Date(item.scheduledAt).getTime() >= now),
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
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'We could not create the follow-up. Check the details and try again.'));
    }
  };

  const action = async (id: string, actionName: 'complete' | 'cancel') => {
    try {
      const data = await fetchApi(`/admin/follow-ups/${id}/${actionName}`, { method: 'POST' });
      setFollowUps(current => current.map(item => item.id === id ? data.followUp : item));
      await load();
    } catch (error) {
      setError(getApiErrorMessage(error, 'The follow-up could not be updated. Please try again.'));
    }
  };

  const reschedule = async (id: string, nextDate: string, updatedNote: string) => {
    try {
      const data = await fetchApi(`/admin/follow-ups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt: nextDate, note: updatedNote })
      });
      setFollowUps(current => current.map(item => item.id === id ? data.followUp : item));
      await load();
    } catch (error) {
      setError(getApiErrorMessage(error, 'The follow-up could not be rescheduled. Please try again.'));
    }
  };

  const sectionMeta: Record<string, { tone: string; icon: React.ReactNode }> = {
    Overdue: {
      tone: 'overdue',
      icon: (
        <svg className="section-title-icon red" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    },
    Today: {
      tone: 'today',
      icon: (
        <svg className="section-title-icon blue" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      )
    },
    Upcoming: {
      tone: 'upcoming',
      icon: (
        <svg className="section-title-icon slate" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    },
    'Completed and cancelled': {
      tone: 'completed',
      icon: (
        <svg className="section-title-icon emerald" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    }
  };

  const renderSection = (title: string, items: FollowUp[]) => {
    const meta = sectionMeta[title] || { tone: 'default', icon: null };
    return (
      <section className="followup-simple-section">
        <div className="section-title-bar">
          <div className="section-title-wrap">
            {meta.icon}
            <h2>{title}</h2>
          </div>
          <span className={`count-pill tone-${meta.tone}`}>{items.length}</span>
        </div>

        {items.length === 0 ? (
          <div className="section-empty-box">
            No {title.toLowerCase()} follow-ups.
          </div>
        ) : (
          <div className="followup-grid">
            {items.map(item => (
              <FollowUpCard
                key={item.id}
                followUp={item}
                onAction={action}
                onReschedule={reschedule}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  const leadOptions = useMemo(
    () =>
      leads.map(lead => ({
        value: lead.id,
        label: lead.name || 'Unnamed lead',
        sublabel: lead.organization ? `(${lead.organization})` : undefined
      })),
    [leads]
  );

  return (
    <div className="page-container followups-clean-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Follow-ups</h1>
          <p className="page-subtitle">Keep track of client conversations and scheduled reminders.</p>
        </div>
        <span className="record-count">{followUps.length} records</span>
      </header>

      {/* Schedule a reminder panel */}
      <section className="schedule-box">
        <div className="schedule-header">
          <h2>Schedule a reminder</h2>
          <p className="schedule-subtext">Set a reminder to follow up with any client on time.</p>
        </div>
        <form onSubmit={createFollowUp} className="schedule-form-grid">
          <div className="form-item">
            <label>Lead / Client</label>
            <CustomSelect
              required
              disabled={formLoading}
              value={leadId}
              onChange={val => setLeadId(val)}
              options={leadOptions}
              placeholder="Select a lead"
            />
          </div>

          <div className="form-item">
            <label>Date & Time</label>
            <DateTimePicker
              required
              value={scheduledAt}
              onChange={val => setScheduledAt(val)}
              placeholder="Select date & time"
            />
          </div>

          <div className="form-item note-grow">
            <label>Follow-up Note</label>
            <input
              required
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="e.g. Call to share registration details or quote"
              className="simple-input"
            />
          </div>

          <button
            className="btn-create"
            type="submit"
            disabled={formLoading || !leadId || !scheduledAt || !note.trim()}
          >
            + Add follow-up
          </button>
        </form>
        {formError && <div className="alert error-panel" role="alert">{formError}</div>}
      </section>

      {error && (
        <div className="alert error-panel" role="alert">
          <span>{error}</span>
          <button className="button subtle" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="panel empty-state">Loading follow-ups...</div>
      ) : (
        <div className="sections-container">
          {renderSection('Overdue', groups.overdue)}
          {renderSection('Today', groups.today)}
          {renderSection('Upcoming', groups.upcoming)}
          {renderSection('Completed and cancelled', groups.completed)}
        </div>
      )}
    </div>
  );
}
