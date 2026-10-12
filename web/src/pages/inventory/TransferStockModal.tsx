// ==============================================================================
// VetRx — TransferStockModal.tsx
// Auditable Stock Transfer: Store Stock -> Practice Bag
// Prevents negative balances, records atomic double ledger transactions
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryBatch,
  type TransferStockPayload,
} from '../../services/inventoryApi';

interface TransferStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialItemId?: string;
  preselectedItemId?: string;
  targetLocationId?: string;
}

export const TransferStockModal: React.FC<TransferStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialItemId,
  preselectedItemId,
  targetLocationId,
}) => {
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storeItems, setStoreItems] = useState<InventoryItem[]>([]);
  const [storeBatches, setStoreBatches] = useState<InventoryBatch[]>([]);

  const effectiveInitialId = preselectedItemId || initialItemId || '';
  const [selectedItemId, setSelectedItemId] = useState<string>(effectiveInitialId);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('Prepare Practice Bag for farm visits');

  useEffect(() => {
    if (isOpen) {
      loadStoreStock();
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialItemId) {
      setSelectedItemId(initialItemId);
    }
  }, [initialItemId]);

  const loadStoreStock = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getStoreStock();
      setStoreItems(res.items || []);
      setStoreBatches(res.batches || []);
    } catch (err: any) {
      console.warn('Failed to load store stock:', err);
      setError('Failed to fetch available store stock.');
    } finally {
      setLoading(false);
    }
  };

  // Available batches for selected item
  const itemBatches = storeBatches.filter(
    (b) => b.inventoryItemId === selectedItemId || b.itemId === selectedItemId
  );

  const activeBatch = itemBatches.find((b) => b.batchNumber === selectedBatchNumber) || itemBatches[0];
  const maxAvailable = activeBatch ? (activeBatch.currentQuantity ?? activeBatch.quantity ?? 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItemId) {
      setError('Please select an item to transfer.');
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Quantity to transfer must be greater than zero.');
      return;
    }

    if (qty > maxAvailable) {
      setError(`Cannot transfer ${qty} units. Only ${maxAvailable} available in Store Stock.`);
      return;
    }

    const payload: TransferStockPayload = {
      toLocationId: targetLocationId,
      itemId: selectedItemId,
      batchNumber: activeBatch ? activeBatch.batchNumber : undefined,
      quantity: qty,
      reason: reason.trim() || 'Transfer from Store Stock to Field Kit',
      idempotencyKey: `trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    try {
      setIsSubmitting(true);
      await inventoryApi.transferStock(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete stock transfer.');
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              Stock Transfer
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              <Icon name="swap-horiz" size={18} />
              Store Stock → Practice Bag
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
              Select Item to Transfer *
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
              <option value="">-- Choose item from store --</option>
              {storeItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.stockUnit}) — Stock: {item.totalStock ?? item.validStock ?? 0}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Selector if multiple batches exist */}
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

          {/* Available Balance Pill */}
          {selectedItemId && (
            <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between text-xs">
              <span className="text-teal-900 font-bold">Available in Store Stock:</span>
              <span className="text-teal-950 font-black text-sm">
                {maxAvailable} units
              </span>
            </div>
          )}

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Quantity to Transfer *</label>
              {maxAvailable > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(maxAvailable)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  Max ({maxAvailable})
                </button>
              )}
            </div>
            <input
              type="number"
              min="0.1"
              max={maxAvailable}
              step="any"
              required
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Transfer Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Field bag replenishment for morning calls"
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
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-teal-700/20 cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="swap-horiz" size={14} />
              <span>{isSubmitting ? 'Transferring…' : 'Transfer to Bag'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
