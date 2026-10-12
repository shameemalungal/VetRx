import React from 'react';
import { User, Phone, MapPin, PawPrint, Check } from 'lucide-react';
import type { OwnerLocation } from '../../types/cvp';

interface OwnerMatchCardProps {
  owner: {
    id?: number;
    name: string;
    phone: string;
    address?: string;
  };
  patients: Array<{
    id?: number;
    name: string;
    species: string;
    breed?: string;
  }>;
  locations?: OwnerLocation[];
  isSelected?: boolean;
  onSelect: () => void;
}

export const OwnerMatchCard: React.FC<OwnerMatchCardProps> = ({
  owner,
  patients,
  locations,
  isSelected = false,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative ${
        isSelected
          ? 'border-teal-600 bg-teal-50/50 shadow-md ring-2 ring-teal-500/30'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 leading-tight">
              {owner.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{owner.phone}</span>
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            isSelected
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-800'
          }`}
        >
          {isSelected ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Selected</span>
            </>
          ) : (
            <span>Select Owner</span>
          )}
        </button>
      </div>

      {/* Address */}
      {owner.address && (
        <div className="flex items-start gap-1.5 mt-2.5 text-xs text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span className="line-clamp-1">{owner.address}</span>
        </div>
      )}

      {/* Associated Animals */}
      {patients.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <PawPrint className="w-3 h-3 text-teal-600" />
            <span>Registered Animals ({patients.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {patients.map((p) => (
              <span
                key={p.id || p.name}
                className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium"
              >
                {p.name} <span className="text-slate-400">({p.species})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Saved Locations count */}
      {locations && locations.length > 1 && (
        <div className="mt-2 text-[11px] font-semibold text-teal-700">
          📍 {locations.length} saved farm locations on file
        </div>
      )}
    </div>
  );
};
