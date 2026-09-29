"use client";

import { useEffect, useState, use } from 'react';
import { Lead } from '@/types';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLead = async () => {
      try {
        const data = await fetchApi(`/admin/leads/${id}`);
        setLead(data.lead);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadLead();
  }, [id]);

  if (loading) return <div className="page-container">Loading...</div>;
  if (!lead) return <div className="page-container">Lead not found</div>;

  return (
    <div className="page-container">
      <Link href="/dashboard" className="back-link">&larr; Back to Leads</Link>
      <div className="detail-card">
        <h1>{lead.name}</h1>
        <div className="meta-grid">
          <div><strong>Organization:</strong> {lead.organization}</div>
          <div><strong>Email:</strong> {lead.email}</div>
          <div><strong>Mobile:</strong> {lead.mobile}</div>
          <div><strong>City:</strong> {lead.city}</div>
          <div><strong>Type:</strong> <span className={`badge flow-${lead.flowType}`}>{lead.flowType}</span></div>
          <div><strong>Created:</strong> {new Date(lead.createdAt).toLocaleString()}</div>
        </div>

        <h2>Questionnaire Answers</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Answer</th>
            </tr>
          </thead>
          <tbody>
            {lead.decodedAnswers?.map((ans, i) => (
              <tr key={i}>
                <td>{ans.questionLabel}</td>
                <td>{ans.displayValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
