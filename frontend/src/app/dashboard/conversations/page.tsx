"use client";

import { useEffect, useState } from 'react';
import { IncompleteConversation } from '@/types';
import { fetchApi } from '@/lib/api';
import { formatWhatsAppIdentity } from '@/lib/formatters';
import Link from 'next/link';

export default function IncompleteConversations() {
  const [conversations, setConversations] = useState<IncompleteConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const data = await fetchApi('/admin/conversations');
        setConversations(data.conversations || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, []);

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Incomplete Conversations</h1>
      </header>

      {loading ? (
        <div>Loading conversations...</div>
      ) : conversations.length === 0 ? (
        <div className="empty-state">No incomplete conversations.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Channel</th>
              <th>WhatsApp Identity</th>
              <th>Current Question</th>
              <th>Last Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map(conversation => (
              <tr key={conversation.id}>
                <td><span className="badge">Incomplete</span></td>
                <td>{conversation.channel}</td>
                <td>{formatWhatsAppIdentity(conversation.externalUserId)}</td>
                <td>{conversation.currentQuestionId || 'Main menu'}</td>
                <td>{new Date(conversation.updatedAt).toLocaleString()}</td>
                <td><Link href={`/dashboard/conversations/${conversation.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
