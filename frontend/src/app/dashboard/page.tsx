"use client";

import { useEffect, useState } from 'react';
import { Lead } from '@/types';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [flowType, setFlowType] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [leadsData, statsData] = await Promise.all([
        fetchApi(`/admin/leads?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&flowType=${encodeURIComponent(flowType)}`),
        fetchApi('/admin/stats')
      ]);
      setLeads(leadsData.leads || []);
      setTotalPages(leadsData.pagination?.totalPages || 1);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [page, search, flowType]);

  // Reset to page 1 on filter change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleFlowTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFlowType(e.target.value);
    setPage(1);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Dashboard</h1>
      </header>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Leads</h3>
            <div className="stat-value">{stats.totalLeads}</div>
          </div>
          <div className="stat-card">
            <h3>Patent</h3>
            <div className="stat-value">{stats.byFlowType?.patent || 0}</div>
          </div>
          <div className="stat-card">
            <h3>Trademark</h3>
            <div className="stat-value">{stats.byFlowType?.trademark || 0}</div>
          </div>
          <div className="stat-card">
            <h3>Design</h3>
            <div className="stat-value">{stats.byFlowType?.design || 0}</div>
          </div>
          <div className="stat-card">
            <h3>Copyright</h3>
            <div className="stat-value">{stats.byFlowType?.copyright || 0}</div>
          </div>
          <div className="stat-card">
            <h3>Not Sure</h3>
            <div className="stat-value">{stats.byFlowType?.notsure || 0}</div>
          </div>
        </div>
      )}

      <div className="filters-section">
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={handleSearchChange}
          className="search-input"
        />
        <select value={flowType} onChange={handleFlowTypeChange} className="flow-select">
          <option value="">All Types</option>
          <option value="patent">Patent</option>
          <option value="trademark">Trademark</option>
          <option value="design">Design</option>
          <option value="copyright">Copyright</option>
          <option value="notsure">Not Sure</option>
        </select>
      </div>

      {loading ? (
        <div>Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="empty-state">No leads found.</div>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Email</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td>{lead.name}</td>
                  <td>{lead.email}</td>
                  <td><span className={`badge flow-${lead.flowType}`}>{lead.flowType}</span></td>
                  <td>
                    <Link href={`/dashboard/leads/${lead.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="pagination-info">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
