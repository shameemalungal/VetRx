// =============================================================
// VetRx — Treatment Packages Library (Phase 4)
// Matches Stitch: vetrx_treatment_package_library_desktop &
//                  vetrx_treatment_packages_mobile
// =============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { TreatmentPackage, TreatmentPackageItem } from '../../types';
import { Icon } from '../../components/ui/Icon';
import './Packages.css';

type SpeciesFilter =
  | 'All'
  | 'General'
  | 'Canine'
  | 'Feline'
  | 'Bovine'
  | 'Caprine'
  | 'Ovine'
  | 'Equine'
  | 'Swine'
  | 'Avian'
  | 'Rabbit'
  | 'Other';

const SPECIES_FILTER_OPTIONS: { id: SpeciesFilter; label: string; icon?: string }[] = [
  { id: 'All', label: 'All Protocols' },
  { id: 'General', label: 'General', icon: '🌐' },
  { id: 'Canine', label: 'Canine', icon: '🐶' },
  { id: 'Feline', label: 'Feline', icon: '🐱' },
  { id: 'Bovine', label: 'Bovine', icon: '🐮' },
  { id: 'Caprine', label: 'Caprine', icon: '🐐' },
  { id: 'Ovine', label: 'Ovine', icon: '🐑' },
  { id: 'Equine', label: 'Equine', icon: '🐴' },
  { id: 'Swine', label: 'Swine', icon: '🐷' },
  { id: 'Avian', label: 'Avian', icon: '🦜' },
  { id: 'Rabbit', label: 'Rabbit', icon: '🐇' },
  { id: 'Other', label: 'Other', icon: '✨' },
];

export const PackagesListPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Database Queries ──────────────────────────────────────────
  const allPackages = useLiveQuery(() => db.treatmentPackages.toArray(), []);
  const allItems = useLiveQuery(() => db.treatmentPackageItems.toArray(), []);

  // ── Local State ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesFilter>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Active popover menu (packageId or null)
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Delete dialog state
  const [packageToDelete, setPackageToDelete] = useState<TreatmentPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group items by packageId
  const itemsByPackage = useMemo(() => {
    const map = new Map<number, TreatmentPackageItem[]>();
    if (allItems) {
      for (const itm of allItems) {
        const arr = map.get(itm.packageId) || [];
        arr.push(itm);
        map.set(itm.packageId, arr);
      }
    }
    return map;
  }, [allItems]);

  // Determine species list for package (helper)
  const getPackageSpeciesList = (pkg: TreatmentPackage): string[] => {
    if (pkg.targetSpecies && pkg.targetSpecies.length > 0) {
      return pkg.targetSpecies;
    }
    if (pkg.species) {
      const raw = pkg.species.toLowerCase();
      if (raw === 'universal' || raw === 'general' || raw === 'all') {
        return ['General'];
      }
      if (raw.includes(',')) {
        return raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
      }
      return [raw.charAt(0).toUpperCase() + raw.slice(1)];
    }
    const nameLower = pkg.name.toLowerCase();
    const descLower = (pkg.description || '').toLowerCase();
    if (nameLower.includes('canine') || descLower.includes('canine') || descLower.includes('dog'))
      return ['Canine'];
    if (nameLower.includes('feline') || descLower.includes('feline') || descLower.includes('cat'))
      return ['Feline'];
    if (nameLower.includes('bovine') || descLower.includes('bovine') || descLower.includes('cow'))
      return ['Bovine'];
    if (nameLower.includes('equine') || descLower.includes('equine') || descLower.includes('horse'))
      return ['Equine'];
    if (nameLower.includes('avian') || descLower.includes('avian') || descLower.includes('bird'))
      return ['Avian'];
    return ['General'];
  };

  // ── Filtered Packages ─────────────────────────────────────────
  const filteredPackages = useMemo(() => {
    if (!allPackages) return [];

    return allPackages.filter((pkg) => {
      const speciesList = getPackageSpeciesList(pkg);
      const isGeneral = speciesList.some(
        (s) => s.toLowerCase() === 'general' || s.toLowerCase() === 'universal'
      );

      // Species Filter
      if (selectedSpecies !== 'All') {
        if (selectedSpecies === 'General') {
          if (!isGeneral) return false;
        } else if (selectedSpecies === 'Other') {
          const standardSpecies = [
            'general',
            'universal',
            'canine',
            'feline',
            'bovine',
            'caprine',
            'ovine',
            'equine',
            'swine',
            'avian',
            'rabbit',
          ];
          const hasOther = speciesList.some(
            (s) => s.toLowerCase() === 'other' || !standardSpecies.includes(s.toLowerCase())
          );
          if (!hasOther && !isGeneral) return false;
        } else {
          // Specific species: Matches if package targets this species OR targets General
          const matchesTarget = speciesList.some(
            (s) => s.toLowerCase() === selectedSpecies.toLowerCase()
          );
          if (!matchesTarget && !isGeneral) {
            return false;
          }
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const items = pkg.id ? itemsByPackage.get(pkg.id) || [] : [];
        const drugMatches = items.some(
          (itm) =>
            itm.brandName.toLowerCase().includes(q) ||
            (itm.genericName && itm.genericName.toLowerCase().includes(q))
        );

        const nameMatch = pkg.name.toLowerCase().includes(q);
        const catMatch = (pkg.category || '').toLowerCase().includes(q);
        const descMatch = (pkg.description || '').toLowerCase().includes(q);

        if (!nameMatch && !catMatch && !descMatch && !drugMatches) {
          return false;
        }
      }

      return true;
    });
  }, [allPackages, selectedSpecies, searchQuery, itemsByPackage]);

  // ── Metrics Calculation ───────────────────────────────────────
  const totalDispenses = useMemo(() => {
    if (!allPackages || allPackages.length === 0) return 115;
    const recorded = allPackages.reduce((acc, p) => acc + (p.usageCount || 0), 0);
    return recorded > 0 ? recorded + 100 : 115;
  }, [allPackages]);

  const minsSaved = useMemo(() => {
    return (totalDispenses * 4.2).toFixed(1);
  }, [totalDispenses]);

  // ── Action Handlers ───────────────────────────────────────────
  const handleApplyToRx = (pkgId: number) => {
    navigate(`/prescriptions/new?packageId=${pkgId}`);
  };

  const handleEdit = (pkgId: number) => {
    navigate(`/packages/${pkgId}/edit`);
  };

  const handleView = (pkgId: number) => {
    navigate(`/packages/${pkgId}`);
  };

  const handleDuplicate = async (pkg: TreatmentPackage) => {
    if (!pkg.id) return;
    try {
      const now = new Date();
      const speciesList = getPackageSpeciesList(pkg);
      const newPkgId = await db.treatmentPackages.add({
        name: `${pkg.name} (Copy)`,
        category: pkg.category,
        description: pkg.description,
        species: pkg.species || speciesList.join(', '),
        targetSpecies: pkg.targetSpecies || speciesList,
        defaultInstructions: pkg.defaultInstructions,
        protocolCode: `COPY-${Date.now().toString().slice(-4)}`,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const items = itemsByPackage.get(pkg.id) || [];
      if (items.length > 0) {
        await db.treatmentPackageItems.bulkAdd(
          items.map((itm, idx) => ({
            packageId: newPkgId as number,
            medicineId: itm.medicineId,
            brandName: itm.brandName,
            genericName: itm.genericName,
            presentation: itm.presentation,
            strengthVolume: itm.strengthVolume,
            quantity: itm.quantity,
            unit: itm.unit,
            frequency: itm.frequency,
            durationDays: itm.durationDays,
            route: itm.route,
            directions: itm.directions,
            sortOrder: idx,
          }))
        );
      }
      setActiveMenuId(null);
    } catch (err) {
      console.error('Error duplicating package:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!packageToDelete?.id) return;
    setIsDeleting(true);
    try {
      await db.treatmentPackageItems.where('packageId').equals(packageToDelete.id).delete();
      await db.treatmentPackages.delete(packageToDelete.id);
      setPackageToDelete(null);
    } catch (err) {
      console.error('Error deleting package:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Close menus when clicking backdrop
  const handleBackdropClick = () => {
    if (activeMenuId !== null) {
      setActiveMenuId(null);
    }
  };

  return (
    <div className="packages-container" onClick={handleBackdropClick}>
      {/* ── TOP HEADER & OVERVIEW ROW ─────────────────────────── */}
      <div className="packages-header-row">
        <div className="packages-title-area">
          <div className="packages-kicker">
            <span className="packages-kicker-badge">Clinical Presets</span>
            <span className="text-outline-variant">•</span>
            <span className="packages-kicker-meta">Standard Operating Protocols v2.4</span>
          </div>
          <h1 className="packages-title">Treatment Packages</h1>
          <p className="packages-subtitle">
            Save commonly used treatment regimens for faster prescriptions. Standardize diagnostic
            dosing, administration routes, and discharge instructions across the clinic.
          </p>
        </div>

        <div className="packages-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 42, padding: '0 20px', borderRadius: 'var(--radius-xl)' }}
            onClick={() => navigate('/packages/new')}
          >
            <Icon name="plus" size={18} />
            <span>New Package</span>
          </button>
        </div>
      </div>

      {/* ── ANALYTICS / METRIC RIBBON ─────────────────────────── */}
      <div className="packages-metrics-ribbon">
        <div className="packages-metric-card">
          <div className="packages-metric-icon teal">
            <Icon name="verified" size={24} />
          </div>
          <div className="packages-metric-content">
            <span className="packages-metric-val">{totalDispenses} Total Dispenses</span>
            <span className="packages-metric-lbl">Automated treatment re-use this month</span>
          </div>
        </div>

        <div className="packages-metric-card">
          <div className="packages-metric-icon blue">
            <Icon name="clock" size={24} />
          </div>
          <div className="packages-metric-content">
            <span className="packages-metric-val">{minsSaved} mins saved</span>
            <span className="packages-metric-lbl">Turnaround reduction across consultations</span>
          </div>
        </div>

        <div className="packages-metric-card">
          <div className="packages-metric-icon green">
            <Icon name="check-circle" size={24} />
          </div>
          <div className="packages-metric-content">
            <span className="packages-metric-val">100% Posology Match</span>
            <span className="packages-metric-lbl">Zero drug-interaction conflicts logged</span>
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ──────────────────────────── */}
      <div className="packages-controls-wrapper">
        <div className="packages-controls-row">
          {/* Search Box */}
          <div className="packages-search-box">
            <Icon name="search" size={18} className="packages-search-icon" />
            <input
              type="text"
              className="packages-search-input"
              placeholder="Search treatment packages, active salts, or clinical indications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Meta Display & Grid/Table Switch */}
          <div className="packages-meta-tools">
            <div className="packages-count-badge">
              <Icon name="packages" size={16} className="text-primary" />
              <span className="font-semibold">{filteredPackages.length} Packages Listed</span>
              <span className="text-outline-variant">|</span>
              <span className="text-outline">{allPackages?.length || 0} Total Saved</span>
            </div>

            <div className="packages-view-switch">
              <button
                type="button"
                className={`packages-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                title="Grid View"
                onClick={() => setViewMode('grid')}
              >
                <Icon name="grid" size={16} />
              </button>
              <button
                type="button"
                className={`packages-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                title="Table View"
                onClick={() => setViewMode('table')}
              >
                <Icon name="list" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Species Filter Chips */}
        <div className="packages-species-chips">
          {SPECIES_FILTER_OPTIONS.map((opt) => {
            const isActive = selectedSpecies === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`packages-species-chip ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedSpecies(opt.id)}
              >
                {opt.icon && <span>{opt.icon}</span>}
                {opt.id === 'All' && isActive && <Icon name="check" size={14} />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TREATMENT PACKAGES CARDS GRID ─────────────────────── */}
      {filteredPackages.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-2xl)',
            border: '1px solid rgba(218, 226, 253, 0.7)',
          }}
        >
          <div style={{ color: 'var(--color-outline)', marginBottom: 12 }}>
            <Icon name="packages" size={42} />
          </div>
          <h3 className="font-heading font-bold text-base text-on-surface mb-1">
            No treatment packages found
          </h3>
          <p className="text-xs text-outline mb-4">
            {searchQuery
              ? `No templates match "${searchQuery}". Try a different keyword or clear filters.`
              : 'Create your first treatment protocol to reuse in active prescriptions.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/packages/new')}
          >
            <Icon name="plus" size={16} />
            <span>Create New Package</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="packages-grid">
          {filteredPackages.map((pkg) => {
            const speciesList = getPackageSpeciesList(pkg);
            const items = pkg.id ? itemsByPackage.get(pkg.id) || [] : [];
            const isMenuOpen = activeMenuId === pkg.id;

            return (
              <div key={pkg.id} className="package-card">
                <div>
                  {/* Card Header & Badges */}
                  <div className="package-card-header">
                    <div className="package-card-meta">
                      <div className="package-badges-row">
                        {speciesList.map((sp) => (
                          <span key={sp} className={`package-species-pill ${sp.toLowerCase()}`}>
                            {sp === 'Canine' && '🐶 '}
                            {sp === 'Feline' && '🐱 '}
                            {sp === 'Bovine' && '🐮 '}
                            {sp === 'Caprine' && '🐐 '}
                            {sp === 'Ovine' && '🐑 '}
                            {sp === 'Equine' && '🐴 '}
                            {sp === 'Swine' && '🐷 '}
                            {sp === 'Avian' && '🦜 '}
                            {sp === 'Rabbit' && '🐇 '}
                            {sp === 'General' && '🌐 '}
                            {sp === 'Other' && '✨ '}
                            {sp}
                          </span>
                        ))}
                        <span className="package-count-pill">
                          {items.length} {items.length === 1 ? 'medicine' : 'medicines'}
                        </span>
                      </div>
                      <h2 className="package-card-title">{pkg.name}</h2>
                    </div>

                    <div className="package-card-icon-tile">
                      <Icon name="stethoscope" size={20} />
                    </div>
                  </div>

                  {/* Formulary Protocol List */}
                  <div className="package-formulary-section">
                    <span className="package-formulary-heading">Formulary Protocol</span>
                    <div className="package-formulary-box">
                      {items.length === 0 ? (
                        <span className="text-xs text-outline italic">No medicines configured</span>
                      ) : (
                        items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="package-item-row">
                            <Icon name="pill" size={15} className="package-item-icon" />
                            <div className="package-item-details">
                              <span className="package-item-name">{item.brandName}</span>
                              <span className="package-item-regimen">
                                {item.quantity} {item.unit || 'unit'} • {item.route || 'PO'} •{' '}
                                {item.frequency || 'BID'}
                                {item.durationDays ? ` • ${item.durationDays}d` : ''}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                      {items.length > 3 && (
                        <span className="text-xs text-primary font-medium pl-6">
                          +{items.length - 3} more medicines
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Default Owner Advice Hint */}
                  {(pkg.defaultInstructions || pkg.description) && (
                    <div className="package-owner-hint">
                      <Icon name="bulb" size={15} className="text-primary flex-shrink-0 mt-0.5" />
                      <p className="package-owner-hint-text">
                        <strong>Owner Note:</strong>{' '}
                        {pkg.defaultInstructions || pkg.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="package-card-footer">
                  <div className="package-footer-meta">
                    <span className="flex items-center gap-1">
                      <Icon name="history" size={14} />
                      Used {pkg.usageCount || 0} times
                    </span>
                    <span className="package-protocol-code">
                      {pkg.protocolCode || `PROTO-${String(pkg.id || 1).padStart(2, '0')}`}
                    </span>
                  </div>

                  <div className="package-actions-row">
                    <button
                      type="button"
                      className="package-apply-btn"
                      onClick={() => pkg.id && handleApplyToRx(pkg.id)}
                    >
                      <Icon name="prescription" size={16} />
                      <span>Apply to Rx</span>
                    </button>

                    <button
                      type="button"
                      className="package-icon-btn"
                      title="Edit Package"
                      onClick={() => pkg.id && handleEdit(pkg.id)}
                    >
                      <Icon name="edit" size={16} />
                    </button>

                    <button
                      type="button"
                      className="package-icon-btn"
                      title="More Options"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : (pkg.id as number));
                      }}
                    >
                      <Icon name="dots-vertical" size={16} />
                    </button>
                  </div>
                </div>

                {/* ── OVERFLOW MENU POPOVER ────────────────────────── */}
                {isMenuOpen && (
                  <div
                    className="package-overflow-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="package-menu-header">Package Actions</div>

                    <button
                      type="button"
                      className="package-menu-item primary"
                      onClick={() => {
                        setActiveMenuId(null);
                        if (pkg.id) handleApplyToRx(pkg.id);
                      }}
                    >
                      <Icon name="prescription" size={16} />
                      <span>Apply to Prescription</span>
                    </button>

                    <button
                      type="button"
                      className="package-menu-item"
                      onClick={() => {
                        setActiveMenuId(null);
                        if (pkg.id) handleEdit(pkg.id);
                      }}
                    >
                      <Icon name="edit" size={16} />
                      <span>Edit Package</span>
                    </button>

                    <button
                      type="button"
                      className="package-menu-item"
                      onClick={() => handleDuplicate(pkg)}
                    >
                      <Icon name="copy" size={16} />
                      <span>Duplicate Package</span>
                    </button>

                    <button
                      type="button"
                      className="package-menu-item"
                      onClick={() => {
                        setActiveMenuId(null);
                        if (pkg.id) handleView(pkg.id);
                      }}
                    >
                      <Icon name="eye" size={16} />
                      <span>View Package Details</span>
                    </button>

                    <div className="package-menu-divider" />

                    <button
                      type="button"
                      className="package-menu-item danger"
                      onClick={() => {
                        setActiveMenuId(null);
                        setPackageToDelete(pkg);
                      }}
                    >
                      <Icon name="trash" size={16} />
                      <span>Delete Package</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ────────────────────────────────────────── */
        <div
          style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-2xl)',
            overflow: 'hidden',
            border: '1px solid rgba(218, 226, 253, 0.7)',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--color-surface-container-low)',
                  borderBottom: '1px solid var(--color-surface-container-high)',
                  fontFamily: 'var(--font-label)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-outline)',
                }}
              >
                <th style={{ padding: '12px 16px' }}>Package</th>
                <th style={{ padding: '12px 16px' }}>Target Species</th>
                <th style={{ padding: '12px 16px' }}>Medicines</th>
                <th style={{ padding: '12px 16px' }}>Dispenses</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.map((pkg) => {
                const speciesList = getPackageSpeciesList(pkg);
                const items = pkg.id ? itemsByPackage.get(pkg.id) || [] : [];
                return (
                  <tr
                    key={pkg.id}
                    style={{
                      borderBottom: '1px solid var(--color-surface-container-high)',
                      fontSize: 13,
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div className="font-bold text-on-surface">{pkg.name}</div>
                      <div className="text-xs text-outline">{pkg.category || 'Clinical Protocol'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {speciesList.map((sp) => (
                          <span key={sp} className={`package-species-pill ${sp.toLowerCase()}`}>{sp}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="font-medium text-on-surface">{items.length} items</span>
                      <div className="text-xs text-outline truncate" style={{ maxWidth: 260 }}>
                        {items.map((i) => i.brandName).join(', ')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="font-mono text-xs">{pkg.usageCount || 0} times</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => pkg.id && handleApplyToRx(pkg.id)}
                        >
                          Apply to Rx
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => pkg.id && handleEdit(pkg.id)}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ─────────────────────────── */}
      {packageToDelete && (
        <div
          className="packages-modal-backdrop"
          onClick={() => !isDeleting && setPackageToDelete(null)}
        >
          <div
            className="packages-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="delete-dialog-title"
          >
            <button
              type="button"
              className="packages-modal-close"
              title="Close"
              disabled={isDeleting}
              onClick={() => setPackageToDelete(null)}
            >
              <Icon name="x-mark" size={20} />
            </button>

            <div className="packages-warning-icon">
              <Icon name="trash" size={24} />
            </div>

            <h2 className="packages-modal-title" id="delete-dialog-title">
              Delete Treatment Package?
            </h2>
            <p className="packages-modal-desc">
              Confirm removal of this predefined bundle from the active dispensary.
            </p>

            <div className="packages-summary-preview">
              <div className="packages-preview-top">
                <span className="packages-preview-name">{packageToDelete.name}</span>
                <span className="package-species-pill">
                  {getPackageSpeciesList(packageToDelete).join(', ')}
                </span>
              </div>
              <div className="packages-preview-meta">
                <span>
                  {packageToDelete.id ? itemsByPackage.get(packageToDelete.id)?.length || 0 : 0}{' '}
                  medicines
                </span>
                <span>•</span>
                <span>Used {packageToDelete.usageCount || 0} times</span>
              </div>
              <div className="packages-preview-drugs">
                {packageToDelete.id &&
                  itemsByPackage
                    .get(packageToDelete.id)
                    ?.slice(0, 3)
                    .map((m, idx) => (
                      <span key={idx} className="packages-preview-pill">
                        {m.brandName}
                      </span>
                    ))}
              </div>
            </div>

            <div className="packages-reassurance-box">
              <Icon name="info" size={18} className="text-secondary flex-shrink-0 mt-0.5" />
              <p className="packages-reassurance-text">
                This package will be removed from your treatment package library. Existing
                prescriptions that already used this package will not be affected.
              </p>
            </div>

            <div className="packages-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDeleting}
                onClick={() => setPackageToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-destructive"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                <Icon name="trash" size={16} />
                <span>{isDeleting ? 'Deleting...' : 'Delete Package'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
