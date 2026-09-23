// ==============================================================================
// VetRx — PlatformIssuesPage.tsx
// Central Support Ticketing, Issue Resolution & Audited Notes Thread
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformIssueItem } from '../../services/platformAdminApi';

export const PlatformIssuesPage: React.FC = () => {
  const [issues, setIssues] = useState<PlatformIssueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected issue for details modal / notes thread
  const [selectedIssue, setSelectedIssue] = useState<PlatformIssueItem | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Create issue modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
    practiceId: '',
  });

  const loadIssues = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.listIssues({
        status: statusFilter,
        category: categoryFilter,
        priority: priorityFilter,
      });
      setIssues(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve support issues.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadIssues();
  }, [statusFilter, categoryFilter, priorityFilter]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await platformAdminApi.createIssue({
        title: createForm.title,
        description: createForm.description,
        category: createForm.category,
        priority: createForm.priority,
        practiceId: createForm.practiceId.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        title: '',
        description: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
        practiceId: '',
      });
      await loadIssues();
    } catch (err: any) {
      alert(`Failed to create ticket: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    try {
      const updated = await platformAdminApi.updateIssue(issueId, { status: newStatus });
      setSelectedIssue(updated);
      await loadIssues();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handlePriorityChange = async (issueId: string, newPriority: string) => {
    try {
      const updated = await platformAdminApi.updateIssue(issueId, { priority: newPriority });
      setSelectedIssue(updated);
      await loadIssues();
    } catch (err: any) {
      alert(`Priority update failed: ${err.message}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newNote.trim()) return;
    try {
      setIsAddingNote(true);
      const updated = await platformAdminApi.addIssueNote(selectedIssue.id, newNote.trim());
      setSelectedIssue(updated);
      setNewNote('');
      await loadIssues();
    } catch (err: any) {
      alert(`Could not add note: ${err.message}`);
    } finally {
      setIsAddingNote(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="platform-page-header">
        <div>
          <h1 className="platform-page-title">Support &amp; Issues Management</h1>
          <div className="platform-page-subtitle">
            Track user inquiries, technical incidents, billing questions, and clinic support tickets.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Icon name="plus" size={15} />
          <span>New Support Ticket</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="platform-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          marginBottom: 20,
          padding: '12px 16px',
        }}
      >
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginRight: 8 }}>
            Status:
          </label>
          <select
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '6px 10px', display: 'inline-block', width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginRight: 8 }}>
            Priority:
          </label>
          <select
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '6px 10px', display: 'inline-block', width: 'auto' }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginRight: 8 }}>
            Category:
          </label>
          <select
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '6px 10px', display: 'inline-block', width: 'auto' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="GENERAL">General</option>
            <option value="LOGIN_AUTH">Login / Auth</option>
            <option value="CLINICAL_WORKFLOW">Clinical Workflow</option>
            <option value="BILLING">Billing &amp; Payments</option>
            <option value="PERMISSION_ACCESS">Permissions &amp; Access</option>
            <option value="DATA_BUG">Bug / Data Anomaly</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#64748b' }}>Loading support tickets...</div>
        </div>
      ) : error ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 32, color: '#dc2626' }}>
          {error}
        </div>
      ) : issues.length === 0 ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <Icon name="life-buoy" size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>No support tickets found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            No tickets match your filter criteria.
          </div>
        </div>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Title &amp; Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Practice / Reporter</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="data-mono" style={{ fontWeight: 700, color: '#4f46e5' }}>
                      #{i.ticketNumber}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{i.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{i.category}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background:
                          i.priority === 'CRITICAL'
                            ? '#fee2e2'
                            : i.priority === 'HIGH'
                            ? '#ffedd5'
                            : '#f1f5f9',
                        color:
                          i.priority === 'CRITICAL'
                            ? '#b91c1c'
                            : i.priority === 'HIGH'
                            ? '#c2410c'
                            : '#475569',
                      }}
                    >
                      {i.priority}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        i.status === 'RESOLVED' || i.status === 'CLOSED'
                          ? 'badge-active'
                          : 'badge-suspended'
                      }
                    >
                      {i.status}
                    </span>
                  </td>
                  <td>
                    {i.practiceName ? (
                      <div style={{ fontWeight: 500 }}>{i.practiceName}</div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Platform-wide</span>
                    )}
                    {i.reporterEmail && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{i.reporterEmail}</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {new Date(i.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => setSelectedIssue(i)}
                    >
                      Open Ticket ({i.internalNotes?.length || 0})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ticket Details & Notes Modal */}
      {selectedIssue && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 640 }}>
            <div className="platform-modal-header">
              <div>
                <span className="data-mono" style={{ color: '#4f46e5', fontWeight: 700 }}>
                  #{selectedIssue.ticketNumber}
                </span>{' '}
                <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>{selectedIssue.title}</span>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setSelectedIssue(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="platform-modal-body">
              {/* Quick Status / Priority controls */}
              <div style={{ display: 'flex', gap: 16, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Status:
                  </label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.8125rem', padding: '4px 8px', marginTop: 4 }}
                    value={selectedIssue.status}
                    onChange={(e) => handleStatusChange(selectedIssue.id, e.target.value)}
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Priority:
                  </label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.8125rem', padding: '4px 8px', marginTop: 4 }}
                    value={selectedIssue.priority}
                    onChange={(e) => handlePriorityChange(selectedIssue.id, e.target.value)}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div style={{ flex: 1, textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                  <div>Category: <strong>{selectedIssue.category}</strong></div>
                  <div>Reported: {new Date(selectedIssue.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Issue Description</label>
                <div style={{ background: '#ffffff', padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.875rem' }}>
                  {selectedIssue.description}
                </div>
              </div>

              {/* Internal Notes Thread */}
              <div>
                <label className="form-label">
                  Internal Notes &amp; Activity ({selectedIssue.internalNotes?.length || 0})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {(!selectedIssue.internalNotes || selectedIssue.internalNotes.length === 0) ? (
                    <div style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      No internal notes recorded.
                    </div>
                  ) : (
                    selectedIssue.internalNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          background: '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: 6,
                          borderLeft: '3px solid #6366f1',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <strong style={{ color: '#0f172a' }}>{note.authorName}</strong>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                            {new Date(note.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <div style={{ color: '#334155' }}>{note.note}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Add an internal note or update..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" disabled={isAddingNote}>
                    {isAddingNote ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </form>
            </div>

            <div className="platform-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedIssue(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Issue Modal */}
      {isCreateModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 520 }}>
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Create Support Ticket</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsCreateModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateIssue}>
              <div className="platform-modal-body">
                <div>
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Doctor unable to sign prescription on tablet"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    >
                      <option value="GENERAL">General Support</option>
                      <option value="LOGIN_AUTH">Login / Auth</option>
                      <option value="CLINICAL_WORKFLOW">Clinical Workflow</option>
                      <option value="BILLING">Billing &amp; Payments</option>
                      <option value="PERMISSION_ACCESS">Permissions &amp; Access</option>
                      <option value="DATA_BUG">Bug / Anomaly</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Priority</label>
                    <select
                      className="form-control"
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Practice ID (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Leave empty if platform-wide"
                    value={createForm.practiceId}
                    onChange={(e) => setCreateForm({ ...createForm, practiceId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Description *</label>
                  <textarea
                    required
                    className="form-control"
                    rows={4}
                    placeholder="Provide details about the issue or request..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
