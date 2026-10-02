"use client";

import { useEffect, useState, use } from 'react';
import { IncompleteConversation } from '@/types';
import { fetchApi } from '@/lib/api';
import { formatWhatsAppDisplayIdentity } from '@/lib/formatters';
import Link from 'next/link';

function labelFor(key: string) {
  return key.replace(/^shared_/, '').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

export default function IncompleteConversationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [conversation, setConversation] = useState<IncompleteConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadConversation = async () => {
      try {
        const data = await fetchApi(`/admin/conversations/${id}`);
        setConversation(data.conversation);
      } catch {
        setConversation(null);
        setError('This conversation could not be loaded.');
      } finally { setLoading(false); }
    };
    void loadConversation();
  }, [id]);

  if (loading) return <div className="page-container"><div className="panel empty-state">Loading conversation...</div></div>;
  if (!conversation) return <div className="page-container"><div className="panel empty-state"><strong>{error || 'Conversation not found'}</strong><p>It may have been completed or removed.</p></div></div>;

  return <div className="page-container">
    <Link href="/dashboard/conversations" className="back-link">← Back to incomplete conversations</Link>
    <div className="detail-card">
      <div className="detail-title-row"><div><p className="eyebrow">Incomplete conversation</p><h1>{formatWhatsAppDisplayIdentity(conversation.externalUserId)}</h1></div><span className="status-pill">Waiting for customer</span></div>
      <div className="meta-grid">
        <div><strong>Customer</strong>{formatWhatsAppDisplayIdentity(conversation.externalUserId)}</div>
        <div><strong>Channel</strong>{conversation.channel}</div>
        <div><strong>Started</strong>{new Date(conversation.createdAt).toLocaleString()}</div>
        <div><strong>Last activity</strong>{new Date(conversation.updatedAt).toLocaleString()}</div>
        <div><strong>Current step</strong>{labelFor(conversation.currentQuestionId || 'main_menu')}</div>
        <div><strong>Progress</strong><span className="progress-track detail-progress"><span style={{ width: `${Math.min(92, Math.max(12, Object.keys(conversation.data || {}).filter(key => key !== '_conversationMeta').length * 14))}%` }} /></span><small>{Object.keys(conversation.data || {}).filter(key => key !== '_conversationMeta').length} answers collected</small></div>
      </div>
      <div className="current-step"><p className="eyebrow">Current step</p><strong>{labelFor(conversation.currentQuestionId || 'main_menu')}</strong><span>Waiting for customer response</span></div>
      <h2>Collected enquiry details</h2>
      <table className="table"><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>
        {Object.entries(conversation.data || {}).filter(([key]) => key !== '_conversationMeta').map(([key, value]) => <tr key={key}><td>{labelFor(key)}</td><td>{typeof value === 'string' ? value : String(value)}</td></tr>)}
      </tbody></table>
    </div>
  </div>;
}
