import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvpService } from '../../services/cvpService';
import type { Call, OwnerLocation } from '../../types/cvp';
import type { Owner, Patient } from '../../types';
import {
  Search,
  X,
  PhoneCall,
  User,
  PawPrint,
  MapPin,
  ChevronRight,
  Map,
} from 'lucide-react';

interface CvpGlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCall?: (call: Call) => void;
}

export const CvpGlobalSearchModal: React.FC<CvpGlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCall,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'calls' | 'owners' | 'patients' | 'locations'>('all');
  const [results, setResults] = useState<{
    calls: Call[];
    owners: Owner[];
    patients: Patient[];
    locations: OwnerLocation[];
  }>({ calls: [], owners: [], patients: [], locations: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults({ calls: [], owners: [], patients: [], locations: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ calls: [], owners: [], patients: [], locations: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await cvpService.searchAll(query);
        if (res) {
          setResults(res);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults =
    results.calls.length +
    results.owners.length +
    results.patients.length +
    results.locations.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 pt-12 sm:pt-20 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-teal-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            id="global-search-title"
            placeholder="Search farmer name, phone, village, cow, tag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Filter Category Chips */}
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-slate-100 overflow-x-auto bg-white scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 transition-all ${
              filterType === 'all'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All {totalResults > 0 && `(${totalResults})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('calls')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 transition-all ${
              filterType === 'calls'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Calls {results.calls.length > 0 && `(${results.calls.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('owners')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 transition-all ${
              filterType === 'owners'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Owners {results.owners.length > 0 && `(${results.owners.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('patients')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 transition-all ${
              filterType === 'patients'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Patients {results.patients.length > 0 && `(${results.patients.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('locations')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 transition-all ${
              filterType === 'locations'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Locations {results.locations.length > 0 && `(${results.locations.length})`}
          </button>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              <div className="inline-block w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p>Searching practices records...</p>
            </div>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Type a farmer name, village, tag, or phone number</p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-xs mx-auto">
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Ramesh</span>
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">HF Cross</span>
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Dystocia</span>
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Shindewadi</span>
              </div>
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div className="py-8 text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-600">No matching records found</p>
              <p className="text-xs mt-1">Try checking the spelling or phone number digits</p>
            </div>
          )}

          {/* Calls Section */}
          {!loading && (filterType === 'all' || filterType === 'calls') && results.calls.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
                <span>Calls ({results.calls.length})</span>
              </div>
              <div className="space-y-1">
                {results.calls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => {
                      onClose();
                      if (onSelectCall) {
                        onSelectCall(call);
                      } else {
                        navigate('/calls');
                      }
                    }}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/40 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {call.tempOwnerName || 'Unknown Owner'}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          call.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                          call.priority === 'URGENT' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {call.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {call.tempPatientName || call.species} • {call.locationAddress || 'Address not set'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owners Section */}
          {!loading && (filterType === 'all' || filterType === 'owners') && results.owners.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-600" />
                <span>Owners ({results.owners.length})</span>
              </div>
              <div className="space-y-1">
                {results.owners.map((owner) => (
                  <div
                    key={owner.id}
                    onClick={() => {
                      onClose();
                      navigate('/patients');
                    }}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{owner.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {owner.phone} {owner.address ? `• ${owner.address}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patients Section */}
          {!loading && (filterType === 'all' || filterType === 'patients') && results.patients.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center gap-1.5">
                <PawPrint className="w-3.5 h-3.5 text-rose-600" />
                <span>Patients ({results.patients.length})</span>
              </div>
              <div className="space-y-1">
                {results.patients.map((pat) => (
                  <div
                    key={pat.id}
                    onClick={() => {
                      onClose();
                      navigate(`/patients/${pat.id}`);
                    }}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/40 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{pat.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                          {pat.species}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {pat.breed || 'Breed unassigned'} {pat.microchipNumber ? `• Microchip: ${pat.microchipNumber}` : pat.identificationRef ? `• ID: ${pat.identificationRef}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locations Section */}
          {!loading && (filterType === 'all' || filterType === 'locations') && results.locations.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saved Locations ({results.locations.length})</span>
              </div>
              <div className="space-y-1">
                {results.locations.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => {
                      onClose();
                      if (loc.latitude && loc.longitude) {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`, '_blank');
                      }
                    }}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{loc.label}</span>
                        {loc.isDefault && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{loc.address}</p>
                    </div>
                    <Map className="w-4 h-4 text-emerald-600" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
