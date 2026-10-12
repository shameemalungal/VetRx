import React, { useState } from 'react';
import { MapPin, Navigation, Check, AlertCircle } from 'lucide-react';
import type { OwnerLocation } from '../../types/cvp';

interface LocationPickerProps {
  savedLocations: OwnerLocation[];
  address: string;
  latitude?: number;
  longitude?: number;
  locationId?: number | string;
  onChange: (updates: {
    locationAddress: string;
    latitude?: number;
    longitude?: number;
    locationId?: number | string;
  }) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  savedLocations,
  address,
  latitude,
  longitude,
  locationId,
  onChange,
}) => {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const handleFetchGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLoading(false);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);
        setGpsAccuracy(acc);

        // Update coordinates, keeping existing address or adding GPS tag
        onChange({
          locationAddress: address || `GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
          latitude: lat,
          longitude: lng,
          locationId: undefined,
        });
      },
      (error) => {
        setGpsLoading(false);
        let msg = 'Could not acquire GPS position.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. You can enter the farm address manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'GPS signal unavailable. Please type address manually.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS acquisition timed out. Please enter address manually.';
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  const handleSelectSaved = (loc: OwnerLocation) => {
    onChange({
      locationAddress: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationId: loc.id,
    });
  };

  return (
    <div className="space-y-4">
      {/* CVP-47: Saved Owner Locations Selection */}
      {savedLocations.length > 0 && (
        <div>
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-700" />
              <span>Saved Farm Locations (CVP-47)</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {savedLocations.length} on file
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedLocations.map((loc) => {
              const isSelected = locationId === loc.id || address === loc.address;
              return (
                <div
                  key={loc.id || loc.label}
                  onClick={() => handleSelectSaved(loc)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/60 shadow-sm ring-1 ring-teal-500/30'
                      : 'border-slate-200 bg-white hover:border-teal-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {loc.label || 'Farm'}
                      </span>
                      {loc.isDefault && (
                        <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {loc.address}
                    </p>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-teal-700 text-white' : 'border border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CVP-10: GPS Acquisition Strip */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              latitude && longitude
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-teal-100 text-teal-800'
            }`}
          >
            <Navigation className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <span>Current GPS Location</span>
              {latitude && longitude && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Acquired
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {latitude && longitude
                ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)} ${
                    gpsAccuracy ? `(±${gpsAccuracy}m)` : ''
                  }`
                : 'Capture device GPS coordinates for route navigation'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFetchGps}
          disabled={gpsLoading}
          className="px-3.5 py-2 bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-slate-800 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <Navigation className="w-3.5 h-3.5 text-teal-700" />
          <span>{gpsLoading ? 'Acquiring GPS...' : latitude ? 'Re-acquire GPS' : 'Capture GPS'}</span>
        </button>
      </div>

      {gpsError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Manual Address Input */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          Visit Location / Farm Address
        </label>
        <textarea
          rows={2}
          value={address}
          onChange={(e) =>
            onChange({
              locationAddress: e.target.value,
              latitude,
              longitude,
              locationId: undefined, // Cleared if manually edited
            })
          }
          placeholder="e.g. Near Milk Cooperative Chilling Center, Survey 88, Nelamangala Road"
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all font-medium resize-none"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Landmarks, village name, and gate details help the veterinarian locate the herd quickly.
        </p>
      </div>
    </div>
  );
};
