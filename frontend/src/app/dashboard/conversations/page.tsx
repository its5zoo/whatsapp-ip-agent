"use client";

import { useEffect, useState } from 'react';
import { IncompleteConversation } from '@/types';
import { fetchApi } from '@/lib/api';
import { formatWhatsAppDisplayIdentity } from '@/lib/formatters';
import Link from 'next/link';

export default function IncompleteConversations() {
  const [conversations, setConversations] = useState<IncompleteConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const data = await fetchApi('/admin/conversations');
        setConversations(data.conversations || []);
      } catch {
        setError('We could not load incomplete conversations. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, []);

  return (
    <div className="page-container">
      <header className="page-header"><div><p className="eyebrow">Work queue</p><h1>Incomplete Conversations</h1><p className="page-subtitle">People who started an enquiry but have not finished it yet.</p></div><span className="record-count">{conversations.length} active</span></header>

      {error && <div className="alert error-panel" role="alert"><span>{error}</span><button className="button subtle" onClick={() => window.location.reload()}>Retry</button></div>}
      {loading ? (
        <div className="panel empty-state"><div className="skeleton line-skeleton" style={{ width: '80%' }} /><div className="skeleton line-skeleton" style={{ width: '65%' }} /></div>
      ) : error ? (
        <div className="panel empty-state"><strong>Conversation queue unavailable</strong><p>Retry to see current customer progress.</p></div>
      ) : conversations.length === 0 ? (
        <div className="panel empty-state"><span className="empty-icon">✓</span><strong>No incomplete conversations</strong><p>Everyone is currently caught up.</p></div>
      ) : (
        <section className="panel table-panel"><table className="data-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Channel</th>
              <th>Progress</th>
              <th>Current Question</th>
              <th>Last Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map(conversation => (
              <tr key={conversation.id}>
                <td><Link href={`/dashboard/conversations/${conversation.id}`} className="lead-cell"><span className="avatar">{formatWhatsAppDisplayIdentity(conversation.externalUserId).slice(0, 1)}</span><span><strong>{formatWhatsAppDisplayIdentity(conversation.externalUserId)}</strong><small>Incomplete enquiry</small></span></Link></td>
                <td>{conversation.channel}</td>
                <td><span className="progress-track"><span style={{ width: `${Math.min(92, Math.max(12, Object.keys(conversation.data || {}).filter(key => key !== '_conversationMeta').length * 14))}%` }} /></span><small className="progress-label">{Object.keys(conversation.data || {}).filter(key => key !== '_conversationMeta').length} collected</small></td>
                <td>{conversation.currentQuestionId || 'Main menu'}</td>
                <td>{new Date(conversation.updatedAt).toLocaleString()}</td>
                <td><Link href={`/dashboard/conversations/${conversation.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table></section>
      )}
    </div>
  );
}
