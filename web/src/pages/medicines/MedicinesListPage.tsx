// =============================================================
// VetRx — Medicines Module (Phase 5)
// Clinical Formulary management with Master Data integration
// =============================================================

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Medicine } from '../../types';
import { MedicineFormModal } from './MedicineFormModal';
import { Icon } from '../../components/ui/Icon';
import './Medicines.css';

type StatusFilter = 'all' | 'active' | 'inactive';
type ViewMode = 'grid' | 'table';

const EMPTY_ARRAY: never[] = [];

function getDosingBadge(medicine: Medicine) {
  const method = medicine.dosingMethod || 'none';
  if (method === 'weight_based') {
    return (
      <span className="medicine-dosing-badge weight_based" title={`Weight-based: ${medicine.dosePerKg || 0} ${medicine.doseUnit || 'mg'}/kg`}>
        <Icon name="calculator" size={12} />
        <span>{medicine.dosePerKg} {medicine.doseUnit || 'mg'}/kg</span>
      </span>
    );
  }
  if (method === 'weight_range') {
    return (
      <span className="medicine-dosing-badge weight_range" title={`Weight range: ${medicine.minDosePerKg}–${medicine.maxDosePerKg} ${medicine.doseUnit || 'mg'}/kg`}>
        <Icon name="calculator" size={12} />
        <span>{medicine.minDosePerKg}–{medicine.maxDosePerKg} {medicine.doseUnit || 'mg'}/kg</span>
      </span>
    );
  }
  if (method === 'weight_band') {
    const bandCount = medicine.weightBands?.length || 0;
    return (
      <span className="medicine-dosing-badge weight_band" title={`${bandCount} weight bands configured`}>
        <Icon name="calculator" size={12} />
        <span>{bandCount} Weight Bands</span>
      </span>
    );
  }
  if (method === 'fixed') {
    return (
      <span className="medicine-dosing-badge fixed" title={`Fixed dose: ${medicine.fixedDose || 1} ${medicine.doseUnit || 'tablet'}/dose`}>
        <Icon name="calculator" size={12} />
        <span>{medicine.fixedDose || 1} {medicine.doseUnit || 'tab'}/dose</span>
      </span>
    );
  }
  return null;
}

export function MedicinesListPage() {
  const allMedicines = useLiveQuery(() => db.medicines.toArray(), []) ?? EMPTY_ARRAY;
  const prescriptionItems = useLiveQuery(() => db.prescriptionItems.toArray(), []) ?? EMPTY_ARRAY;
  const packageItems = useLiveQuery(() => db.treatmentPackageItems.toArray(), []) ?? EMPTY_ARRAY;

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  // Safety confirmation dialog state for Delete/Deactivate
  const [confirmDialog, setConfirmDialog] = useState<{
    medicine: Medicine;
    usageCount: number;
    action: 'deactivate' | 'delete';
  } | null>(null);

  // Computed Metrics
  const totalCount = allMedicines.length;
  const activeCount = allMedicines.filter((m) => m.isActive !== false).length;
  const inactiveCount = allMedicines.filter((m) => m.isActive === false).length;

  // Extract unique categories for filter chips
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    allMedicines.forEach((m) => {
      if (m.category && m.category.trim()) {
        cats.add(m.category.trim());
      }
    });
    return ['All', ...Array.from(cats).sort()];
  }, [allMedicines]);

  // Filtered Medicines
  const filteredMedicines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allMedicines.filter((m) => {
      // Status filter
      const isActive = m.isActive !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      // Category filter
      if (selectedCategory !== 'All') {
        const cat = m.category || 'Other';
        if (cat !== selectedCategory) return false;
      }

      // Search query
      if (!query) return true;
      const brand = (m.brandName || '').toLowerCase();
      const generic = (m.genericName || '').toLowerCase();
      const presentation = (m.presentation || '').toLowerCase();
      const strength = (m.strengthVolume || '').toLowerCase();
      const category = (m.category || '').toLowerCase();
      const notes = (m.notes || '').toLowerCase();

      return (
        brand.includes(query) ||
        generic.includes(query) ||
        presentation.includes(query) ||
        strength.includes(query) ||
        category.includes(query) ||
        notes.includes(query)
      );
    });
  }, [allMedicines, statusFilter, selectedCategory, searchQuery]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingMedicine(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setModalOpen(true);
  };

  const handleToggleActive = async (medicine: Medicine) => {
    if (!medicine.id) return;
    const nextActive = medicine.isActive === false; // toggle
    try {
      await db.medicines.update(medicine.id, {
        isActive: nextActive,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to toggle medicine status:', err);
    }
  };

  // Safe delete check: verify references
  const handlePromptDeleteOrDeactivate = (medicine: Medicine) => {
    if (!medicine.id) return;
    const rxRefCount = prescriptionItems.filter((i) => i.medicineId === medicine.id).length;
    const pkgRefCount = packageItems.filter((i) => i.medicineId === medicine.id).length;
    const totalRef = rxRefCount + pkgRefCount;

    if (totalRef > 0) {
      // Cannot hard-delete referenced medicine — offer deactivation
      setConfirmDialog({
        medicine,
        usageCount: totalRef,
        action: 'deactivate',
      });
    } else {
      // Unreferenced — can delete safely
      setConfirmDialog({
        medicine,
        usageCount: 0,
        action: 'delete',
      });
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog || !confirmDialog.medicine.id) return;
    const { medicine, action } = confirmDialog;
    const medId = medicine.id;
    if (typeof medId !== 'number') return;
    try {
      if (action === 'delete') {
        await db.medicines.delete(medId);
      } else {
        await db.medicines.update(medId, {
          isActive: false,
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      console.error(`Failed to ${action} medicine:`, err);
    } finally {
      setConfirmDialog(null);
    }
  };

  return (
    <div className="medicines-page">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="medicines-header">
        <div>
          <div className="medicines-kicker">
            <Icon name="pill" size={14} />
            <span>CLINICAL FORMULARY</span>
          </div>
          <h1 className="medicines-title">Medicines &amp; Formulary</h1>
          <p className="medicines-subtitle">
            Manage practice medicines, generic compositions, presentations and dispensing defaults.
          </p>
        </div>

        <div className="medicines-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAdd}
            id="add-medicine-btn"
          >
            <Icon name="plus" size={16} />
            <span>New Medicine</span>
          </button>
        </div>
      </div>

      {/* ── Analytics Ribbon Cards ──────────────────────────────── */}
      <div className="medicines-stats-grid">
        <div className="medicines-stat-card">
          <div className="medicines-stat-icon primary">
            <Icon name="pill" size={22} />
          </div>
          <div>
            <div className="medicines-stat-label">Total Formulary</div>
            <div className="medicines-stat-val">{totalCount}</div>
          </div>
        </div>

        <div className="medicines-stat-card">
          <div className="medicines-stat-icon tertiary">
            <Icon name="check-circle" size={22} />
          </div>
          <div>
            <div className="medicines-stat-label">Active Formulations</div>
            <div className="medicines-stat-val">{activeCount}</div>
          </div>
        </div>

        <div className="medicines-stat-card">
          <div className="medicines-stat-icon secondary">
            <Icon name="category" size={22} />
          </div>
          <div>
            <div className="medicines-stat-label">Therapeutic Classes</div>
            <div className="medicines-stat-val">
              {categoriesList.length > 1 ? categoriesList.length - 1 : 0}
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls Bar: Search, Status Tabs, View Mode ─────────── */}
      <div className="medicines-controls-bar">
        <div className="medicines-search-row">
          {/* Search Input */}
          <div className="medicines-search-input-wrap">
            <Icon name="search" size={16} className="medicines-search-icon" />
            <input
              type="text"
              className="medicines-search-input"
              placeholder="Search by brand name, generic composition, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="medicines-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="medicines-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>

          {/* View Toggles & Status Filter */}
          <div className="medicines-view-toggles">
            {/* Status Filter */}
            <div className="medicines-status-filter" role="tablist" aria-label="Status filter">
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'all'}
                className={`medicines-status-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'active'}
                className={`medicines-status-btn ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'inactive'}
                className={`medicines-status-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive ({inactiveCount})
              </button>
            </div>

            {/* View Mode Toggle: Grid / List */}
            <div className="medicines-view-mode-btns" aria-label="View mode">
              <button
                type="button"
                className={`medicines-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid"
                aria-label="Grid view"
              >
                <Icon name="grid" size={16} />
              </button>
              <button
                type="button"
                className={`medicines-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="List"
                aria-label="List view"
              >
                <Icon name="list" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        {categoriesList.length > 1 && (
          <div className="medicines-category-chips" role="tablist" aria-label="Category filter">
            {categoriesList.map((cat) => {
              const count =
                cat === 'All'
                  ? totalCount
                  : allMedicines.filter((m) => (m.category || 'Other') === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat}
                  className={`medicines-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{cat}</span>
                  <span className="medicines-cat-count">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Medicines Content: Grid or Table ─────────────────────── */}
      {filteredMedicines.length === 0 ? (
        /* Empty State */
        <div className="medicines-empty-card">
          <div className="medicines-empty-icon">
            <Icon name="pill" size={28} />
          </div>
          <h3 className="medicines-empty-title">No Medicines Found</h3>
          <p className="medicines-empty-desc">
            {searchQuery || selectedCategory !== 'All' || statusFilter !== 'all'
              ? 'No medicines match your current search query or filter criteria. Try resetting filters or searching with a different term.'
              : 'Your practice formulary is currently empty. Add your first medicine formulation to begin prescribing.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
            {(searchQuery || selectedCategory !== 'All' || statusFilter !== 'all') && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setStatusFilter('all');
                }}
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAdd}
            >
              <Icon name="plus" size={16} />
              <span>New Medicine</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="medicines-grid">
          {filteredMedicines.map((medicine) => {
            const isActive = medicine.isActive !== false;
            return (
              <div
                key={medicine.id}
                className={`medicine-card ${!isActive ? 'inactive' : ''}`}
              >
                <div>
                  {/* Card Top: Icon, Brand, Generic, Status */}
                  <div className="medicine-card-top">
                    <div className="medicine-card-icon-title">
                      <div className="medicine-icon-badge">
                        <Icon name="pill" size={18} />
                      </div>
                      <div>
                        <h3 className="medicine-brand-name">{medicine.brandName}</h3>
                        {medicine.genericName && (
                          <div className="medicine-generic-name">
                            <span>{medicine.genericName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`medicine-status-pill ${isActive ? 'active' : 'inactive'}`}
                    >
                      <span className="medicine-status-dot" />
                      <span>{isActive ? 'Active' : 'Inactive'}</span>
                    </span>
                  </div>

                  {/* Specs Box: Presentation, Strength, Unit, Category */}
                  <div className="medicine-specs-box" style={{ marginTop: 'var(--space-sm)' }}>
                    <div className="medicine-spec-pills">
                      <span className="medicine-spec-badge">
                        <span className="spec-label">Form:</span> {medicine.presentation}
                      </span>
                      {medicine.strengthVolume && (
                        <span className="medicine-spec-badge">
                          <span className="spec-label">Strength:</span> {medicine.strengthVolume}
                        </span>
                      )}
                      {medicine.defaultUnit && (
                        <span className="medicine-spec-badge">
                          <span className="spec-label">Unit:</span> {medicine.defaultUnit}
                        </span>
                      )}
                      {medicine.category && (
                        <span className="medicine-category-badge">{medicine.category}</span>
                      )}
                      {getDosingBadge(medicine)}
                    </div>

                    {medicine.notes && (
                      <p className="medicine-notes-text" title={medicine.notes}>
                        {medicine.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions: Edit | Deactivate | Delete */}
                <div className="medicine-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(medicine)}
                    title="Edit formulation"
                  >
                    <Icon name="edit" size={13} />
                    <span>Edit</span>
                  </button>

                  <div className="medicine-card-action-group">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggleActive(medicine)}
                      title={isActive ? 'Deactivate medicine' : 'Activate medicine'}
                      style={{
                        color: isActive ? 'var(--color-outline)' : 'var(--color-primary)',
                      }}
                    >
                      <Icon name={isActive ? 'block' : 'check-circle'} size={13} />
                      <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handlePromptDeleteOrDeactivate(medicine)}
                      title="Delete"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Icon name="trash" size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="medicines-table-surface">
          <div className="medicines-table-wrap">
            <table className="medicines-table">
              <thead>
                <tr>
                  <th>Medicine Name &amp; Generic</th>
                  <th>Form &amp; Strength</th>
                  <th>Therapeutic Category</th>
                  <th>Dosing Rule</th>
                  <th>Default Unit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.map((medicine) => {
                  const isActive = medicine.isActive !== false;
                  return (
                    <tr
                      key={medicine.id}
                      className={!isActive ? 'inactive' : ''}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>
                          {medicine.brandName}
                        </div>
                        {medicine.genericName && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--color-on-surface-variant)',
                              marginTop: 2,
                            }}
                          >
                            {medicine.genericName}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="medicine-spec-badge" style={{ marginRight: 4 }}>
                          <span className="spec-label">Form:</span> {medicine.presentation}
                        </span>
                        {medicine.strengthVolume && (
                          <span className="medicine-spec-badge">
                            <span className="spec-label">Strength:</span> {medicine.strengthVolume}
                          </span>
                        )}
                      </td>
                      <td>
                        {medicine.category ? (
                          <span className="medicine-category-badge">{medicine.category}</span>
                        ) : (
                          <span style={{ color: 'var(--color-outline)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        {getDosingBadge(medicine) || (
                          <span style={{ color: 'var(--color-outline)', fontSize: 12 }}>Manual</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12 }}>
                          {medicine.defaultUnit || '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`medicine-status-pill ${isActive ? 'active' : 'inactive'}`}
                        >
                          <span className="medicine-status-dot" />
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(medicine)}
                            title="Edit"
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleToggleActive(medicine)}
                            title={isActive ? 'Deactivate' : 'Activate'}
                            style={{ color: isActive ? 'var(--color-outline)' : 'var(--color-primary)' }}
                          >
                            <Icon name={isActive ? 'block' : 'check-circle'} size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handlePromptDeleteOrDeactivate(medicine)}
                            title="Delete"
                            style={{ color: 'var(--color-error)' }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Medicine Modal ────────────────────────────── */}
      <MedicineFormModal
        isOpen={modalOpen}
        medicine={editingMedicine}
        onClose={() => {
          setModalOpen(false);
          setEditingMedicine(null);
        }}
        onSaved={(_medId) => {
          setModalOpen(false);
          setEditingMedicine(null);
        }}
      />

      {/* ── Safety Confirmation Dialog (Deactivate vs Delete) ───── */}
      {confirmDialog && (
        <div
          className="medicine-modal-backdrop"
          onClick={() => setConfirmDialog(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="medicine-modal-dialog"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="medicine-modal-header">
              <h3 className="medicine-modal-title">
                {confirmDialog.action === 'deactivate'
                  ? 'Deactivate Medicine Formulation'
                  : 'Delete Medicine Formulation'}
              </h3>
              <button
                type="button"
                className="medicine-modal-close"
                onClick={() => setConfirmDialog(null)}
                aria-label="Close dialog"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="medicine-modal-body">
              {confirmDialog.action === 'deactivate' ? (
                <>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-on-surface)' }}>
                    <strong>{confirmDialog.medicine.brandName}</strong> is referenced in{' '}
                    <strong>{confirmDialog.usageCount}</strong> historical prescription(s) or package(s).
                  </p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-on-surface-variant)' }}>
                    To preserve complete medical and audit history, this medicine cannot be hard deleted. It will be marked <strong>Inactive</strong> instead, preventing it from appearing in new prescription selections.
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-on-surface)' }}>
                  Are you sure you want to delete <strong>{confirmDialog.medicine.brandName}</strong>? This medicine has no historical prescriptions or packages and can be safely removed.
                </p>
              )}
            </div>

            <div className="medicine-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={
                  confirmDialog.action === 'delete'
                    ? { background: 'var(--color-error)', borderColor: 'var(--color-error)' }
                    : undefined
                }
                onClick={handleConfirmAction}
              >
                {confirmDialog.action === 'deactivate'
                  ? 'Confirm Deactivation'
                  : 'Delete Formulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
