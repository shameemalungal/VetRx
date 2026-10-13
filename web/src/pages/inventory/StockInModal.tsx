// ==============================================================================
// VetRx — StockInModal.tsx
// CVP-29: Stock receipt into Store Stock with batch, expiry, cost & ledger audit
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryCategory,
  type StockInPayload,
} from '../../services/inventoryApi';

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialItemId?: string;
}

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialItemId,
}) => {
  const [existingItems, setExistingItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId || '');
  const [isNewItem, setIsNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('MEDICINE');
  const [stockUnit, setStockUnit] = useState('Vial');

  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [purchaseRate, setPurchaseRate] = useState<number | ''>('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [sourceReference, setSourceReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialItemId) {
      setSelectedItemId(initialItemId);
      setIsNewItem(false);
    }
  }, [initialItemId]);

  const loadItems = async () => {
    try {
      setLoadingItems(true);
      const res = await inventoryApi.getItems();
      setExistingItems(res.items || []);
    } catch (err: any) {
      console.warn('Failed to load items catalogue:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__NEW__') {
      setIsNewItem(true);
      setSelectedItemId('');
    } else {
      setIsNewItem(false);
      setSelectedItemId(val);
      const found = existingItems.find((i) => i.id === val);
      if (found) {
        setCategory(found.category);
        setStockUnit(found.stockUnit || 'Unit');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Quantity received must be greater than zero.');
      return;
    }
    if (!batchNumber.trim()) {
      setError('Batch / Lot number is required.');
      return;
    }
    if (!expiryDate) {
      setError('Expiry date is required.');
      return;
    }

    if (isNewItem && !newItemName.trim()) {
      setError('Please provide an item or medicine name.');
      return;
    }
    if (!isNewItem && !selectedItemId) {
      setError('Please select an item from the inventory catalogue.');
      return;
    }

    const payload: StockInPayload = {
      itemId: isNewItem ? undefined : selectedItemId,
      name: isNewItem ? newItemName.trim() : undefined,
      category,
      stockUnit: stockUnit.trim() || 'Unit',
      batchNumber: batchNumber.trim(),
      expiryDate,
      quantity: qty,
      purchaseRate: purchaseRate !== '' ? Number(purchaseRate) : 0,
      mrp: mrp !== '' ? Number(mrp) : undefined,
      sourceReference: sourceReference.trim() || null,
      notes: notes.trim() || null,
      idempotencyKey: `stockin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    try {
      setIsSubmitting(true);
      await inventoryApi.stockIn(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record stock in receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              Stock Receipt
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              <Icon name="box" size={18} />
              Stock In to Store Stock
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <Icon name="alert-circle" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs font-medium">
          {/* Item Selector */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Select Item / Medicine *
            </label>
            <select
              value={isNewItem ? '__NEW__' : selectedItemId}
              onChange={handleItemSelect}
              disabled={loadingItems}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
            >
              <option value="">-- Choose existing item or add new --</option>
              {existingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category}) — {item.stockUnit}
                </option>
              ))}
              <option value="__NEW__">+ Create New Item Master</option>
            </select>
          </div>

          {/* New Item Details (if creating new) */}
          {isNewItem && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                New Item Details
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oxytetracycline 20% LA"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs"
                  >
                    <option value="MEDICINE">Medicine</option>
                    <option value="CONSUMABLE">Consumable</option>
                    <option value="SURGICAL_MATERIAL">Surgical</option>
                    <option value="LAB_MATERIAL">Lab Material</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Stock Unit
                  </label>
                  <input
                    type="text"
                    placeholder="Vial, Strip, Piece"
                    value={stockUnit}
                    onChange={(e) => setStockUnit(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Batch & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Batch / Lot Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. B2604A"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Quantity & Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Quantity Received *</label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                placeholder="Units"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Purchase Rate (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Cost per unit"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">MRP (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Selling MRP"
                value={mrp}
                onChange={(e) => setMrp(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Source Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">PO / Source Ref</label>
              <input
                type="text"
                placeholder="e.g. PO-8842, Direct Purchase"
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Notes / Supplier</label>
              <input
                type="text"
                placeholder="Supplier name or delivery notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-teal-700/20 cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="check" size={14} />
              <span>{isSubmitting ? 'Recording Receipt…' : 'Record Stock Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
