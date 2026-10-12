// ==============================================================================
// VetRx — ReturnStockModal.tsx
// Return Unused Stock: Practice Bag -> Store Stock
// Decrements Bag, increments Store atomically, records double ledger entries
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryBatch,
  type ReturnStockPayload,
} from '../../services/inventoryApi';

interface ReturnStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialItemId?: string;
  preselectedItemId?: string;
  sourceLocationId?: string;
}

export const ReturnStockModal: React.FC<ReturnStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialItemId,
  preselectedItemId,
  sourceLocationId,
}) => {
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bagItems, setBagItems] = useState<InventoryItem[]>([]);
  const [bagBatches, setBagBatches] = useState<InventoryBatch[]>([]);

  const effectiveInitialId = preselectedItemId || initialItemId || '';
  const [selectedItemId, setSelectedItemId] = useState<string>(effectiveInitialId);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('Unused field stock returned after visit');

  useEffect(() => {
    if (isOpen) {
      loadBagStock();
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialItemId) {
      setSelectedItemId(initialItemId);
    }
  }, [initialItemId]);

  const loadBagStock = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getPracticeBagStock({ locationId: sourceLocationId });
      setBagItems(res.items || []);
      setBagBatches(res.batches || []);
    } catch (err: any) {
      console.warn('Failed to load practice bag stock:', err);
      setError('Failed to fetch practice bag stock.');
    } finally {
      setLoading(false);
    }
  };

  const itemBatches = bagBatches.filter(
    (b) => b.inventoryItemId === selectedItemId || b.itemId === selectedItemId
  );

  const activeBatch = itemBatches.find((b) => b.batchNumber === selectedBatchNumber) || itemBatches[0];
  const maxAvailable = activeBatch ? (activeBatch.currentQuantity ?? activeBatch.quantity ?? 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItemId) {
      setError('Please select an item to return to store.');
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Quantity to return must be greater than zero.');
      return;
    }

    if (qty > maxAvailable) {
      setError(`Cannot return ${qty} units. Only ${maxAvailable} available in Practice Bag.`);
      return;
    }

    const payload: ReturnStockPayload = {
      fromLocationId: sourceLocationId,
      itemId: selectedItemId,
      batchNumber: activeBatch ? activeBatch.batchNumber : undefined,
      quantity: qty,
      reason: reason.trim() || 'Returned unused stock from Field Kit to Store',
      idempotencyKey: `ret_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    try {
      setIsSubmitting(true);
      await inventoryApi.returnStock(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to return stock to store.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Return Stock
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              <Icon name="arrow-back" size={18} />
              Practice Bag → Store Stock
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
              Select Item in Bag to Return *
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setSelectedBatchNumber('');
              }}
              disabled={loading}
              required
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
            >
              <option value="">-- Choose item from bag --</option>
              {bagItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.stockUnit}) — In Bag: {item.totalStock ?? item.validStock ?? 0}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Selector if multiple batches */}
          {itemBatches.length > 0 && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Select Batch *</label>
              <select
                value={selectedBatchNumber || (activeBatch ? activeBatch.batchNumber : '')}
                onChange={(e) => setSelectedBatchNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                {itemBatches.map((b) => (
                  <option key={b.id} value={b.batchNumber}>
                    Batch {b.batchNumber} (Exp: {b.expiryDate.split('T')[0]}) — Available: {b.currentQuantity ?? b.quantity}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Available in Bag Pill */}
          {selectedItemId && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
              <span className="text-amber-900 font-bold">Available in Practice Bag:</span>
              <span className="text-amber-950 font-black text-sm">
                {maxAvailable} units
              </span>
            </div>
          )}

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Quantity to Return *</label>
              {maxAvailable > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(maxAvailable)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  Return All ({maxAvailable})
                </button>
              )}
            </div>
            <input
              type="number"
              min="0.1"
              max={maxAvailable}
              step="any"
              required
              placeholder="e.g. 2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Return Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Return unused vials after completed visit round"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
            />
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
              disabled={isSubmitting || maxAvailable <= 0}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-amber-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="arrow-back" size={14} />
              <span>{isSubmitting ? 'Returning Stock…' : 'Return to Store'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
