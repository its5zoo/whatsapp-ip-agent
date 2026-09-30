"use client";

import { useEffect, useState, use } from 'react';
import { IncompleteConversation } from '@/types';
import { fetchApi } from '@/lib/api';
import { formatWhatsAppIdentity } from '@/lib/formatters';
import Link from 'next/link';

export default function IncompleteConversationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [conversation, setConversation] = useState<IncompleteConversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversation = async () => {
      try {
        const data = await fetchApi(`/admin/conversations/${id}`);
        setConversation(data.conversation);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadConversation();
  }, [id]);

  if (loading) return <div className="page-container">Loading...</div>;
  if (!conversation) return <div className="page-container">Conversation not found</div>;

  return (
    <div className="page-container">
      <Link href="/dashboard/conversations" className="back-link">&larr; Back to Incomplete Conversations</Link>
      <div className="detail-card">
        <h1>Incomplete Conversation</h1>
        <div className="meta-grid">
          <div><strong>WhatsApp Identity:</strong> {formatWhatsAppIdentity(conversation.externalUserId)}</div>
          <div><strong>Channel:</strong> {conversation.channel}</div>
          <div><strong>Current Question:</strong> {conversation.currentQuestionId || 'Main menu'}</div>
          <div><strong>Created:</strong> {new Date(conversation.createdAt).toLocaleString()}</div>
          <div><strong>Updated:</strong> {new Date(conversation.updatedAt).toLocaleString()}</div>
        </div>

        <h2>Collected Questionnaire Data</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(conversation.data || {})
              .filter(([key]) => key !== '_conversationMeta')
              .map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{typeof value === 'string' ? value : JSON.stringify(value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
