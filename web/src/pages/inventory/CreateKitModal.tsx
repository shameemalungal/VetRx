// ==============================================================================
// VetRx — CreateKitModal.tsx (Phase 7: Field Kit & Vehicle Provisioning)
// Allows creating named field kits, mobile vehicles, and assigned bags.
// ==============================================================================

import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { inventoryApi, type StockLocation } from '../../services/inventoryApi';

interface CreateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newLocation: StockLocation) => void;
}

export const CreateKitModal: React.FC<CreateKitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'BAG' | 'VEHICLE' | 'FIELD_KIT'>('BAG');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [assignedUserName, setAssignedUserName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name for the kit or vehicle.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const created = await inventoryApi.createLocation({
        name: name.trim(),
        type,
        vehicleNumber: vehicleNumber.trim() || undefined,
        assignedUserName: assignedUserName.trim() || undefined,
        description: description.trim() || undefined,
      });
      setName('');
      setVehicleNumber('');
      setAssignedUserName('');
      setDescription('');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create field kit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-kit-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon name="Briefcase" className="h-5 w-5" />
            </div>
            <div>
              <h3 id="create-kit-title" className="text-base font-bold text-slate-800">
                New Field Kit or Vehicle
              </h3>
              <p className="text-xs text-slate-500">Add an independent mobile inventory stock location</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            disabled={isSubmitting}
          >
            <Icon name="X" className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2 border border-red-200">
            <Icon name="AlertCircle" className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Kit Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Location Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('BAG')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1 transition-all ${
                  type === 'BAG'
                    ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="Briefcase" className="w-4 h-4" />
                <span>Field Bag</span>
              </button>
              <button
                type="button"
                onClick={() => setType('VEHICLE')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1 transition-all ${
                  type === 'VEHICLE'
                    ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="Truck" className="w-4 h-4" />
                <span>Vehicle / Van</span>
              </button>
              <button
                type="button"
                onClick={() => setType('FIELD_KIT')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1 transition-all ${
                  type === 'FIELD_KIT'
                    ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="Package" className="w-4 h-4" />
                <span>Mobile Box</span>
              </button>
            </div>
          </div>

          {/* Kit Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kit / Vehicle Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'VEHICLE' ? 'e.g. Bolero Mobile Clinic' : 'e.g. Dr. Sharma Emergency Bag'}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            />
          </div>

          {/* Vehicle Number (if VEHICLE) */}
          {type === 'VEHICLE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vehicle Registration No.
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. KL-10-AB-1234"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
              />
            </div>
          )}

          {/* Assigned Member */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assigned Veterinarian / Member (Optional)
            </label>
            <input
              type="text"
              value={assignedUserName}
              onChange={(e) => setAssignedUserName(e.target.value)}
              placeholder="e.g. Dr. Shameem Alungal"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Assigned to North Zone dairy calls"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {isSubmitting && <Icon name="RotateCw" className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Location</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
