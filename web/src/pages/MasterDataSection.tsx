// =============================================================
// VetRx — Settings: Master Data Section
// =============================================================

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import {
  MASTER_DATA_CATEGORIES,
  addMasterDataItem,
  updateMasterDataItem,
  toggleMasterDataItemActive,
  reorderMasterDataItems,
  isMasterDataInUse,
  deleteMasterDataItem,
} from '../db/masterData';
import type { MasterDataCategory, MasterDataItem } from '../types';
import { Icon } from '../components/ui/Icon';
import './MasterDataSection.css';

export const MasterDataSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<MasterDataCategory>('species');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formIsGovPrescribed, setFormIsGovPrescribed] = useState(false);
  const [formGovOrderNumber, setFormGovOrderNumber] = useState('G.O.(Rt) No.589/2023/AHD');
  const [formGovOrderDate, setFormGovOrderDate] = useState('13-12-2023');
  const [formRateControlled, setFormRateControlled] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState('');

  // Delete/In-use warning modal
  const [deleteWarning, setDeleteWarning] = useState<{
    item: MasterDataItem;
    reason: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<MasterDataItem | null>(null);

  // Live Query all master data items
  const allItems = useLiveQuery(() => db.masterDataItems.toArray(), []) || [];

  // Group counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<MasterDataCategory, { total: number; active: number }> = {
      species: { total: 0, active: 0 },
      medicine_unit: { total: 0, active: 0 },
      route: { total: 0, active: 0 },
      frequency: { total: 0, active: 0 },
      duration_unit: { total: 0, active: 0 },
      sex: { total: 0, active: 0 },
      invoice_item: { total: 0, active: 0 },
    };

    allItems.forEach((item) => {
      if (counts[item.category]) {
        counts[item.category].total += 1;
        if (item.isActive) counts[item.category].active += 1;
      }
    });

    return counts;
  }, [allItems]);

  // Current category info
  const currentCategoryInfo = useMemo(() => {
    return (
      MASTER_DATA_CATEGORIES.find((c) => c.id === selectedCategory) ||
      MASTER_DATA_CATEGORIES[0]
    );
  }, [selectedCategory]);

  // Filtered & sorted items for active category
  const categoryItems = useMemo(() => {
    return allItems
      .filter((item) => item.category === selectedCategory)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allItems, selectedCategory]);

  const displayedItems = useMemo(() => {
    return categoryItems.filter((item) => {
      if (statusFilter === 'active' && !item.isActive) return false;
      if (statusFilter === 'inactive' && item.isActive) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = item.code.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        return matchesName || matchesCode || matchesDesc;
      }
      return true;
    });
  }, [categoryItems, statusFilter, searchQuery]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormCode('');
    setFormPrice('');
    setFormUnit(selectedCategory === 'invoice_item' ? 'Per visit' : '');
    setFormIsGovPrescribed(false);
    setFormGovOrderNumber('G.O.(Rt) No.589/2023/AHD');
    setFormGovOrderDate('13-12-2023');
    setFormRateControlled(false);
    setFormIsActive(true);
    setFormDescription('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (item: MasterDataItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
    setFormPrice(
      item.defaultPricePaisa !== undefined
        ? (item.defaultPricePaisa / 100).toFixed(2)
        : ''
    );
    setFormUnit(item.unit || (selectedCategory === 'invoice_item' ? 'Per visit' : ''));
    setFormIsGovPrescribed(!!item.isGovPrescribed);
    setFormGovOrderNumber(item.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD');
    setFormGovOrderDate(item.govOrderDate || '13-12-2023');
    setFormRateControlled(item.rateControlled !== undefined ? item.rateControlled : !!item.isGovPrescribed);
    setFormIsActive(item.isActive);
    setFormDescription(item.description || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Name change auto-generates code if adding
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingItem) {
      const generatedCode = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setFormCode(generatedCode);
    }
  };

  // Save Add / Edit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Option name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Option code / key is required.');
      return;
    }

    let defaultPricePaisa: number | undefined;
    if (selectedCategory === 'invoice_item') {
      const numPrice = parseFloat(formPrice);
      if (isNaN(numPrice) || numPrice < 0) {
        setFormError('Please enter a valid default price.');
        return;
      }
      defaultPricePaisa = Math.round(numPrice * 100);
    }

    try {
      if (editingItem && editingItem.id) {
        await updateMasterDataItem(editingItem.id, {
          name: formName.trim(),
          code: formCode.trim().toLowerCase(),
          isActive: formIsActive,
          defaultPricePaisa,
          unit: selectedCategory === 'invoice_item' ? formUnit.trim() || undefined : undefined,
          isGovPrescribed: selectedCategory === 'invoice_item' ? formIsGovPrescribed : undefined,
          govOrderNumber: selectedCategory === 'invoice_item' && formIsGovPrescribed ? formGovOrderNumber.trim() : undefined,
          govOrderDate: selectedCategory === 'invoice_item' && formIsGovPrescribed ? formGovOrderDate.trim() : undefined,
          rateControlled: selectedCategory === 'invoice_item' ? formRateControlled : undefined,
          description: formDescription.trim() || undefined,
        });
      } else {
        const nextSortOrder =
          categoryItems.length > 0
            ? Math.max(...categoryItems.map((i) => i.sortOrder)) + 1
            : 1;

        await addMasterDataItem({
          category: selectedCategory,
          name: formName.trim(),
          code: formCode.trim().toLowerCase(),
          isActive: formIsActive,
          sortOrder: nextSortOrder,
          defaultPricePaisa,
          unit: selectedCategory === 'invoice_item' ? formUnit.trim() || undefined : undefined,
          isGovPrescribed: selectedCategory === 'invoice_item' ? formIsGovPrescribed : undefined,
          govOrderNumber: selectedCategory === 'invoice_item' && formIsGovPrescribed ? formGovOrderNumber.trim() : undefined,
          govOrderDate: selectedCategory === 'invoice_item' && formIsGovPrescribed ? formGovOrderDate.trim() : undefined,
          rateControlled: selectedCategory === 'invoice_item' ? formRateControlled : undefined,
          description: formDescription.trim() || undefined,
        });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save master data option.');
    }
  };

  // Reordering
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const newOrder = [...categoryItems];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedIds = newOrder.map((i) => i.id!).filter(Boolean);
    await reorderMasterDataItems(orderedIds);
  };

  // Attempt Delete (with safety check)
  const handleDeleteAttempt = async (item: MasterDataItem) => {
    const check = await isMasterDataInUse(item);
    if (check.inUse) {
      setDeleteWarning({
        item,
        reason: check.reason || 'This value is currently referenced by clinical records.',
      });
      return;
    }
    setConfirmDeleteId(item);
  };

  // Confirm delete (when safe)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || !confirmDeleteId.id) return;
    try {
      await deleteMasterDataItem(confirmDeleteId.id);
      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Deactivate instead of delete
  const handleDeactivateInstead = async () => {
    if (!deleteWarning || !deleteWarning.item.id) return;
    await toggleMasterDataItemActive(deleteWarning.item.id, false);
    setDeleteWarning(null);
  };

  return (
    <div className="master-data-container">
      {/* Category Pills Navigation */}
      <div className="master-data-nav" role="tablist" aria-label="Master Data Categories">
        {MASTER_DATA_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id]?.total || 0;
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isSelected}
              className={`master-data-nav-btn ${isSelected ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSearchQuery('');
                setStatusFilter('all');
              }}
            >
              <span>{cat.label}</span>
              <span className="master-data-count-chip">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Main Card Surface */}
      <section className="card settings-section">
        <div className="card-body">
          {/* Header */}
          <div className="master-data-card-header">
            <div className="master-data-header-left">
              <div className="master-data-icon-box">
                <Icon name={currentCategoryInfo.icon as any} size={22} />
              </div>
              <div>
                <h2 className="master-data-header-title">{currentCategoryInfo.label}</h2>
                <p className="master-data-header-desc">{currentCategoryInfo.description}</p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAdd}
              id="btn-add-master-option"
            >
              <Icon name="plus" size={16} />
              <span>Add Option</span>
            </button>
          </div>

          {/* Controls: Search & Status Filter */}
          <div className="master-data-controls">
            <div className="master-data-search">
              <span className="master-data-search-icon">
                <Icon name="search" size={16} />
              </span>
              <input
                type="text"
                placeholder={`Search ${currentCategoryInfo.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="master-data-filter-tabs">
              <button
                type="button"
                className={`master-data-filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({categoryItems.length})
              </button>
              <button
                type="button"
                className={`master-data-filter-tab ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
              >
                Active ({categoryItems.filter((i) => i.isActive).length})
              </button>
              <button
                type="button"
                className={`master-data-filter-tab ${statusFilter === 'inactive' ? 'active' : ''}`}
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive ({categoryItems.filter((i) => !i.isActive).length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="master-data-table-wrap">
            <table className="master-data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Order</th>
                  <th style={{ width: '130px' }}>Code / Key</th>
                  <th>Option Label</th>
                  {selectedCategory === 'invoice_item' && (
                    <>
                      <th style={{ width: '110px' }}>Unit</th>
                      <th style={{ width: '110px' }}>Default Price</th>
                      <th style={{ width: '120px' }}>Rate Type</th>
                    </>
                  )}
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedCategory === 'invoice_item' ? 8 : 5}
                      style={{ textAlign: 'center', padding: '32px', color: 'var(--color-outline)' }}
                    >
                      No options found for this filter.
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => {
                    const originalIndex = categoryItems.findIndex((i) => i.id === item.id);
                    return (
                      <tr key={item.id} className={!item.isActive ? 'inactive' : ''}>
                        {/* Order Reordering */}
                        <td>
                          <div className="master-data-reorder-btns">
                            <button
                              type="button"
                              className="master-data-reorder-btn"
                              title="Move up"
                              disabled={originalIndex <= 0}
                              onClick={() => handleMove(originalIndex, 'up')}
                            >
                              <Icon name="chevron-up" size={14} />
                            </button>
                            <button
                              type="button"
                              className="master-data-reorder-btn"
                              title="Move down"
                              disabled={originalIndex >= categoryItems.length - 1}
                              onClick={() => handleMove(originalIndex, 'down')}
                            >
                              <Icon name="chevron-down" size={14} />
                            </button>
                          </div>
                        </td>

                        {/* Code */}
                        <td>
                          <span className="master-data-code-badge">{item.code}</span>
                        </td>

                        {/* Name */}
                        <td>
                          <strong style={{ display: 'block', color: 'var(--color-on-surface)' }}>
                            {item.name}
                          </strong>
                          {item.description && (
                            <span style={{ fontSize: '11px', color: 'var(--color-outline)', display: 'block' }}>
                              {item.description}
                            </span>
                          )}
                          {item.isGovPrescribed && (
                            <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                              {item.govOrderNumber} ({item.govOrderDate})
                            </span>
                          )}
                        </td>

                        {/* Unit & Default Price & Rate Type (Invoice items only) */}
                        {selectedCategory === 'invoice_item' && (
                          <>
                            <td>
                              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                                {item.unit || '—'}
                              </span>
                            </td>
                            <td>
                              <span className="master-data-price-cell">
                                ₹{((item.defaultPricePaisa || 0) / 100).toFixed(2)}
                              </span>
                            </td>
                            <td>
                              {item.isGovPrescribed ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(0, 104, 95, 0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                                  <Icon name="lock" size={12} /> G.O. Fixed
                                </span>
                              ) : item.rateControlled ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-high)', padding: '2px 7px', borderRadius: '4px' }}>
                                  <Icon name="lock" size={12} /> Locked
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>Standard</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* Status Badge */}
                        <td>
                          <span
                            className={`master-data-status-pill ${
                              item.isActive ? 'active' : 'inactive'
                            }`}
                          >
                            <span className="master-data-status-dot" />
                            <span>{item.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="master-data-actions-cell">
                            {/* Toggle Active Switch */}
                            <button
                              type="button"
                              className="master-data-toggle-btn"
                              title={item.isActive ? 'Deactivate' : 'Activate'}
                              onClick={() =>
                                item.id && toggleMasterDataItemActive(item.id, !item.isActive)
                              }
                            >
                              {item.isActive ? 'Deactivate' : 'Activate'}
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              className="master-data-reorder-btn"
                              title="Edit option"
                              onClick={() => handleOpenEdit(item)}
                            >
                              <Icon name="edit" size={15} />
                            </button>

                            {/* Delete (with safety prompt) */}
                            <button
                              type="button"
                              className="master-data-reorder-btn"
                              title="Delete option"
                              style={{ color: 'var(--color-error)' }}
                              onClick={() => handleDeleteAttempt(item)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="master-data-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="master-data-modal" onClick={(e) => e.stopPropagation()}>
            <div className="master-data-modal-header">
              <h3>{editingItem ? `Edit ${currentCategoryInfo.label} Option` : `Add New ${currentCategoryInfo.label}`}</h3>
              <button
                type="button"
                className="master-data-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="master-data-modal-body">
                {formError && (
                  <div className="master-data-alert">
                    <Icon name="alert-circle" size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Option Name */}
                <div className="form-group">
                  <label className="form-label" htmlFor="md-name">
                    Option Name / Label <span className="text-error">*</span>
                  </label>
                  <input
                    id="md-name"
                    type="text"
                    className="form-input"
                    placeholder={`e.g. ${
                      selectedCategory === 'species'
                        ? 'Rabbit'
                        : selectedCategory === 'invoice_item'
                        ? 'Dental Scaling'
                        : 'Custom Option'
                    }`}
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Code / Identifier */}
                <div className="form-group">
                  <label className="form-label" htmlFor="md-code">
                    Stable Code / Key <span className="text-error">*</span>
                  </label>
                  <input
                    id="md-code"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. rabbit"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px' }}>
                    Used as stable internal reference key.
                  </span>
                </div>

                {/* Default Price and Unit for Invoice Items */}
                {selectedCategory === 'invoice_item' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="md-price">
                          Default Price (₹ INR) <span className="text-error">*</span>
                        </label>
                        <input
                          id="md-price"
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input font-mono"
                          placeholder="e.g. 250.00"
                          value={formPrice}
                          onChange={(e) => setFormPrice(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="md-unit">
                          Billing Unit <span className="form-label-optional">(optional)</span>
                        </label>
                        <input
                          id="md-unit"
                          type="text"
                          className="form-input"
                          placeholder="e.g. Per certificate / Per report"
                          value={formUnit}
                          onChange={(e) => setFormUnit(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Government Prescribed Rate Controls */}
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        background: formIsGovPrescribed
                          ? 'rgba(0, 104, 95, 0.05)'
                          : 'var(--color-surface-container-low)',
                        border: `1px solid ${
                          formIsGovPrescribed
                            ? 'rgba(0, 104, 95, 0.25)'
                            : 'var(--color-border)'
                        }`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--color-on-surface)' }}>
                            Government-Prescribed Rate Item
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                            Statutory government rate fixed by official Government Order (G.O.)
                          </span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formIsGovPrescribed}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormIsGovPrescribed(checked);
                              if (checked) {
                                setFormRateControlled(true);
                              }
                            }}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>G.O. Fixed</span>
                        </label>
                      </div>

                      {formIsGovPrescribed && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '11px' }}>
                                Government Order (G.O.) No.
                              </label>
                              <input
                                type="text"
                                className="form-input font-mono"
                                style={{ fontSize: '12px', height: '32px' }}
                                value={formGovOrderNumber}
                                onChange={(e) => setFormGovOrderNumber(e.target.value)}
                                placeholder="G.O.(Rt) No.589/2023/AHD"
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '11px' }}>
                                G.O. Date
                              </label>
                              <input
                                type="text"
                                className="form-input font-mono"
                                style={{ fontSize: '12px', height: '32px' }}
                                value={formGovOrderDate}
                                onChange={(e) => setFormGovOrderDate(e.target.value)}
                                placeholder="13-12-2023"
                              />
                            </div>
                          </div>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-on-surface)' }}>
                            <input
                              type="checkbox"
                              checked={formRateControlled}
                              onChange={(e) => setFormRateControlled(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                            />
                            <span>
                              <strong>Rate Controlled:</strong> Prevent manual rate alteration during invoice generation
                            </span>
                          </label>

                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(0, 104, 95, 0.08)',
                              borderLeft: '3px solid var(--color-primary)',
                              fontSize: '11px',
                              color: 'var(--color-primary)',
                              fontStyle: 'italic',
                            }}
                          >
                            <strong>Printed Note Preview:</strong> &quot;As per the rate fixed by {formGovOrderNumber.trim() || 'G.O.(Rt) No.589/2023/AHD'} dated {formGovOrderDate.trim() || '13-12-2023'}.&quot;
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Description */}
                <div className="form-group">
                  <label className="form-label" htmlFor="md-desc">
                    Description / Clinical Notes <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    id="md-desc"
                    type="text"
                    className="form-input"
                    placeholder="Brief notes or scope"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Active Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px', color: 'var(--color-on-surface)' }}>
                      Active Status
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                      Active values are offered in dropdowns when creating new records.
                    </span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Active</span>
                  </label>
                </div>
              </div>

              <div className="master-data-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" id="btn-save-master-option">
                  {editingItem ? 'Save Changes' : 'Create Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Blocked (In Use) Warning Dialog */}
      {deleteWarning && (
        <div className="master-data-modal-backdrop" onClick={() => setDeleteWarning(null)}>
          <div className="master-data-modal" onClick={(e) => e.stopPropagation()}>
            <div className="master-data-modal-header" style={{ borderBottomColor: 'rgba(186, 26, 26, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)' }}>
                <Icon name="alert-triangle" size={20} />
                <h3 style={{ color: 'var(--color-error)' }}>Cannot Delete Option</h3>
              </div>
              <button
                type="button"
                className="master-data-modal-close"
                onClick={() => setDeleteWarning(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="master-data-modal-body">
              <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                <strong>&quot;{deleteWarning.item.name}&quot;</strong> is currently referenced by historical records:{' '}
                <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>{deleteWarning.reason}</span>
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', lineHeight: '1.5', margin: 0 }}>
                To preserve data integrity of historical prescriptions and records, this value cannot be permanently deleted.
                You can mark it as <strong>Inactive</strong> so that new records will not offer it, while historical records continue displaying properly.
              </p>
            </div>

            <div className="master-data-modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteWarning(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleDeactivateInstead}
              >
                Deactivate Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="master-data-modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
          <div className="master-data-modal" onClick={(e) => e.stopPropagation()}>
            <div className="master-data-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)' }}>
                <Icon name="trash" size={20} />
                <h3>Delete Option</h3>
              </div>
              <button
                type="button"
                className="master-data-modal-close"
                onClick={() => setConfirmDeleteId(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="master-data-modal-body">
              <p style={{ fontSize: '13px', margin: 0 }}>
                Are you sure you want to delete <strong>&quot;{confirmDeleteId.name}&quot;</strong>? This option is not referenced by any existing records.
              </p>
            </div>

            <div className="master-data-modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
