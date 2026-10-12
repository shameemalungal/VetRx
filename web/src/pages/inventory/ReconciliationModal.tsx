// ==============================================================================
// VetRx — ReconciliationModal.tsx
// Physical Count Reconciliation & Adjustments
// Enforces mandatory variance reasons, prevents negative balances & audits changes
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryBatch,
  type ReconcileStockPayload,
} from '../../services/inventoryApi';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultLocation?: 'STORE' | 'BAG';
  locationName?: string;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultLocation,
  locationName,
}) => {
  const initialLoc: 'STORE' | 'BAG' =
    defaultLocation || (locationName?.toLowerCase().includes('store') ? 'STORE' : 'BAG');
  const [targetLocation, setTargetLocation] = useState<'STORE' | 'BAG'>(initialLoc);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);

  // Counted quantities map: itemId -> countedQuantity
  const [countedMap, setCountedMap] = useState<Record<string, number>>({});
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [globalReason, setGlobalReason] = useState('Routine Physical Stock Reconciliation');

  useEffect(() => {
    if (isOpen) {
      loadLocationStock(targetLocation);
      setError(null);
    }
  }, [isOpen, targetLocation]);

  const loadLocationStock = async (loc: 'STORE' | 'BAG') => {
    try {
      setLoading(true);
      if (loc === 'STORE') {
        const res = await inventoryApi.getStoreStock();
        setItems(res.items || []);
        setBatches(res.batches || []);
        initializeCounts(res.items || []);
      } else {
        const res = await inventoryApi.getPracticeBagStock();
        setItems(res.items || []);
        setBatches(res.batches || []);
        initializeCounts(res.items || []);
      }
    } catch (err: any) {
      console.warn('Failed to load location stock for reconciliation:', err);
      setError('Failed to fetch stock records for reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  const initializeCounts = (itemList: InventoryItem[]) => {
    const initial: Record<string, number> = {};
    itemList.forEach((it) => {
      initial[it.id] = it.totalStock ?? it.validStock ?? it.currentStock ?? 0;
    });
    setCountedMap(initial);
  };

  const handleCountChange = (itemId: string, val: number) => {
    setCountedMap((prev) => ({
      ...prev,
      [itemId]: Math.max(0, val),
    }));
  };

  const handleReasonChange = (itemId: string, text: string) => {
    setReasonMap((prev) => ({
      ...prev,
      [itemId]: text,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Build reconciliation payload for items with variances
    const reconcileItems: ReconcileStockPayload['items'] = [];

    for (const it of items) {
      const recorded = it.totalStock ?? it.validStock ?? it.currentStock ?? 0;
      const counted = countedMap[it.id] ?? recorded;
      const variance = counted - recorded;

      if (variance !== 0) {
        const itemReason = reasonMap[it.id]?.trim() || globalReason.trim();
        if (!itemReason) {
          setError(`Please provide a reason for the adjustment on "${it.name}" (variance: ${variance}).`);
          return;
        }

        const itemBatch = batches.find(
          (b) => b.inventoryItemId === it.id || b.itemId === it.id
        );

        reconcileItems.push({
          itemId: it.id,
          batchId: itemBatch?.id,
          batchNumber: itemBatch?.batchNumber,
          recordedQuantity: recorded,
          countedQuantity: counted,
          reason: itemReason,
        });
      }
    }

    if (reconcileItems.length === 0) {
      setError('No variances detected between recorded and counted stock.');
      return;
    }

    try {
      setIsSubmitting(true);
      await inventoryApi.reconcileStock({
        locationName: targetLocation === 'BAG' ? 'Practice Bag' : 'Store Stock',
        items: reconcileItems,
        reason: globalReason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock reconciliation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              Audit &amp; Stocktake
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              <Icon name="check-circle" size={18} />
              Reconcile Physical Stock
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

        {/* Location Switcher */}
        <div className="mt-4 flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setTargetLocation('BAG')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              targetLocation === 'BAG'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon name="bag" size={14} />
            <span>Practice Bag (Field Stock)</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetLocation('STORE')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              targetLocation === 'STORE'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon name="box" size={14} />
            <span>Store Stock (Main Inventory)</span>
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <Icon name="alert-circle" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs font-medium">
          {/* General Reason */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              General Audit / Reconciliation Reason
            </label>
            <input
              type="text"
              required
              placeholder="e.g. End of day field bag reconciliation"
              value={globalReason}
              onChange={(e) => setGlobalReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
            />
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 p-2.5 border-b border-slate-200 font-bold text-slate-700 grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider">
              <div className="col-span-5">Item / Medicine</div>
              <div className="col-span-2 text-center">Recorded</div>
              <div className="col-span-3 text-center">Counted Physical</div>
              <div className="col-span-2 text-right">Variance</div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading stock records…</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No items currently registered in {targetLocation === 'BAG' ? 'Practice Bag' : 'Store Stock'}.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {items.map((it) => {
                  const recorded = it.totalStock ?? it.validStock ?? it.currentStock ?? 0;
                  const counted = countedMap[it.id] ?? recorded;
                  const variance = counted - recorded;

                  return (
                    <div key={it.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50">
                      <div className="col-span-5 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{it.name}</div>
                        <div className="text-[10px] text-slate-400">{it.stockUnit}</div>
                        {variance !== 0 && (
                          <input
                            type="text"
                            placeholder="Reason for variance..."
                            value={reasonMap[it.id] || ''}
                            onChange={(e) => handleReasonChange(it.id, e.target.value)}
                            className="mt-1 w-full p-1.5 rounded-lg border border-slate-300 text-[11px]"
                          />
                        )}
                      </div>

                      <div className="col-span-2 text-center font-semibold text-slate-600">
                        {recorded}
                      </div>

                      <div className="col-span-3 flex justify-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={counted}
                          onChange={(e) => handleCountChange(it.id, Number(e.target.value))}
                          className="w-20 p-1.5 rounded-lg border border-slate-300 bg-white text-center font-bold text-xs"
                        />
                      </div>

                      <div className="col-span-2 text-right">
                        <span
                          className={`font-black text-xs px-2 py-0.5 rounded-full inline-block ${
                            variance === 0
                              ? 'bg-slate-100 text-slate-600'
                              : variance > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {variance > 0 ? `+${variance}` : variance}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              disabled={isSubmitting || items.length === 0}
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-teal-700/20 cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="check" size={14} />
              <span>{isSubmitting ? 'Adjusting Stock…' : 'Confirm Reconciliation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
