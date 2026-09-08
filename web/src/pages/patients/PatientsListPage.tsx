// =============================================================
// VetRx — Patients List Page
// Presentation layer reproducing the approved Stitch Patient directory UI
// Fully reactive with live Dexie queries.
// =============================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../../components/ui/Icon';
import type { Patient, Owner, Species } from '../../types';
import './Patients.css';

const SPECIES_OPTIONS: Species[] = ['Canine', 'Feline', 'Avian', 'Bovine', 'Equine', 'Other'];

export const PatientsListPage: React.FC = () => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<'All' | Species>('All');
  const [viewMode, setViewMode] = useState<'animals' | 'owners'>('animals');

  // ── Live Query Data ───────────────────────────────────────────
  const patients = useLiveQuery(() => db.patients.toArray(), []);
  const owners = useLiveQuery(() => db.owners.toArray(), []);

  // Map owners by ID
  const ownerMap = useMemo(() => {
    const map = new Map<number, Owner>();
    owners?.forEach((o) => {
      if (o.id) map.set(o.id, o);
    });
    return map;
  }, [owners]);

  // Combine patient with owner
  const enrichedPatients = useMemo(() => {
    if (!patients) return [];
    return patients.map((p) => ({
      ...p,
      owner: p.ownerId ? ownerMap.get(p.ownerId) : undefined,
    }));
  }, [patients, ownerMap]);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    let list = enrichedPatients;

    // Species filter
    if (selectedSpecies !== 'All') {
      list = list.filter((p) => p.species === selectedSpecies);
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const patientName = p.name.toLowerCase();
        const species = p.species.toLowerCase();
        const breed = (p.breed || '').toLowerCase();
        const microchip = (p.microchipNumber || '').toLowerCase();
        const idRef = (p.identificationRef || '').toLowerCase();
        const ownerName = (p.owner?.name || '').toLowerCase();
        const ownerPhone = (p.owner?.phone || '').toLowerCase();

        // Also check common aliases e.g. "dog" for canine, "cat" for feline
        const isDog = species === 'canine' && q.includes('dog');
        const isCat = species === 'feline' && q.includes('cat');

        return (
          patientName.includes(q) ||
          species.includes(q) ||
          breed.includes(q) ||
          microchip.includes(q) ||
          idRef.includes(q) ||
          ownerName.includes(q) ||
          ownerPhone.includes(q) ||
          isDog ||
          isCat
        );
      });
    }

    return list;
  }, [enrichedPatients, selectedSpecies, searchQuery]);

  // Group by owner for "Browse by Owner" view
  const groupedByOwner = useMemo(() => {
    if (!owners) return [];
    return owners
      .map((owner) => {
        const animals = enrichedPatients.filter((p) => p.ownerId === owner.id);
        return {
          owner,
          animals,
        };
      })
      .filter((group) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        const ownerMatch =
          group.owner.name.toLowerCase().includes(q) ||
          group.owner.phone.toLowerCase().includes(q);
        const animalMatch = group.animals.some(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.species.toLowerCase().includes(q) ||
            (a.breed || '').toLowerCase().includes(q)
        );
        return ownerMatch || animalMatch;
      });
  }, [owners, enrichedPatients, searchQuery]);

  // Species counts
  const speciesCounts = useMemo(() => {
    const counts: Record<string, number> = { All: enrichedPatients.length };
    enrichedPatients.forEach((p) => {
      counts[p.species] = (counts[p.species] || 0) + 1;
    });
    return counts;
  }, [enrichedPatients]);

  const getAvatarClass = (species: Species) => {
    if (species === 'Canine') return 'avatar-canine';
    if (species === 'Feline') return 'avatar-feline';
    return 'avatar-other';
  };

  const formatAge = (p: Patient) => {
    if (p.ageNote) return p.ageNote;
    if (p.dateOfBirth) {
      const now = new Date();
      const dob = new Date(p.dateOfBirth);
      const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (months < 12) return `${Math.max(1, months)} mos`;
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      return remMonths > 0 ? `${years}y ${remMonths}m` : `${years} yrs`;
    }
    return null;
  };

  return (
    <div className="patients-page">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="patients-header">
        <div className="patients-title-group">
          <h1 className="patients-title">Patients</h1>
          <span className="patients-subtitle">
            Clinical directory of registered animals and clients
          </span>
        </div>
        <div className="patients-header-actions">
          <Link to="/patients/new" className="btn btn-primary" id="btn-new-patient">
            <Icon name="plus" size={18} />
            <span>New Patient</span>
          </Link>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ────────────────────────────── */}
      <div className="patients-toolbar">
        <div className="patients-search-row">
          <div className="patients-search-box">
            <Icon name="search" size={20} className="patients-search-icon" />
            <input
              ref={searchInputRef}
              type="search"
              className="patients-search-input"
              placeholder="Search owner, animal or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="patient-search-input"
            />
            {searchQuery ? (
              <button
                type="button"
                className="patients-clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <Icon name="x-mark" size={16} />
              </button>
            ) : (
              <kbd className="patients-search-shortcut">Press /</kbd>
            )}
          </div>
        </div>

        <div className="patients-filter-row">
          {/* Quick Species Filter Chips */}
          <div className="patients-species-chips">
            <button
              type="button"
              className={`filter-chip ${selectedSpecies === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedSpecies('All')}
            >
              <span>All</span>
              <span className="filter-chip-count">({speciesCounts['All'] || 0})</span>
            </button>
            {SPECIES_OPTIONS.map((sp) => {
              const count = speciesCounts[sp] || 0;
              if (count === 0 && selectedSpecies !== sp) return null;
              return (
                <button
                  key={sp}
                  type="button"
                  className={`filter-chip ${selectedSpecies === sp ? 'active' : ''}`}
                  onClick={() => setSelectedSpecies(sp)}
                >
                  <Icon name="paw" size={14} />
                  <span>{sp}</span>
                  <span className="filter-chip-count">({count})</span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'animals' ? 'active' : ''}`}
              onClick={() => setViewMode('animals')}
            >
              <Icon name="paw" size={14} />
              <span>Animals</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'owners' ? 'active' : ''}`}
              onClick={() => setViewMode('owners')}
            >
              <Icon name="user" size={14} />
              <span>By Owner</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Animals Grid View ──────────────────────────────────── */}
      {viewMode === 'animals' && (
        <>
          {filteredPatients.length === 0 ? (
            <div className="empty-state card">
              <Icon name="paw" size={48} />
              <div className="section-title">
                {searchQuery ? 'No patients found' : 'No patients registered yet'}
              </div>
              <div className="section-sub">
                {searchQuery
                  ? `No matching records found for "${searchQuery}". Try searching by patient name, owner name, or phone number.`
                  : 'Get started by creating your first patient and owner record.'}
              </div>
              {searchQuery ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSpecies('All');
                  }}
                >
                  Clear search
                </button>
              ) : (
                <Link to="/patients/new" className="btn btn-primary btn-sm">
                  <Icon name="plus" size={16} />
                  <span>New Patient</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="patients-grid" id="patients-card-grid">
              {filteredPatients.map((patient) => {
                const age = formatAge(patient);
                const identification = patient.identificationRef || (patient.id ? `#CAN-${8800 + patient.id}` : undefined);

                return (
                  <article key={patient.id} className="patient-card">
                    <div className="patient-card-top">
                      <div className={`patient-avatar ${getAvatarClass(patient.species)}`}>
                        <Icon name="paw" size={24} />
                      </div>
                      <div className="patient-main-info">
                        <div className="patient-headline">
                          <Link to={`/patients/${patient.id}`} className="patient-name-link truncate">
                            {patient.name}
                          </Link>
                          {identification && (
                            <span className="patient-id-badge truncate">{identification}</span>
                          )}
                        </div>

                        <div className="patient-species-line truncate">
                          {patient.species} {patient.breed ? `• ${patient.breed}` : ''}
                        </div>

                        <div className="patient-meta-pills">
                          {patient.sex && <span className="meta-pill">{patient.sex}</span>}
                          {age && (
                            <>
                              <span className="text-outline-variant">•</span>
                              <span className="meta-pill">{age}</span>
                            </>
                          )}
                          {patient.weightKg !== undefined && patient.weightKg !== null && (
                            <>
                              <span className="text-outline-variant">•</span>
                              <span className="meta-pill meta-pill-weight">{patient.weightKg.toFixed(1)} kg</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Owner Box */}
                    <div className="patient-card-owner-box">
                      <div className="owner-info-left truncate">
                        <Icon name="user" size={14} className="text-outline" />
                        <span className="truncate">
                          Owner: <strong className="owner-name-txt">{patient.owner?.name || 'Walk-in Client'}</strong>
                        </span>
                      </div>
                      {patient.owner?.phone && (
                        <span className="owner-phone-txt font-mono">{patient.owner.phone}</span>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="patient-card-actions">
                      <Link to={`/patients/${patient.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                        <span>View Details</span>
                        <Icon name="arrow-right" size={14} />
                      </Link>
                      <Link to={`/patients/${patient.id}/edit`} className="btn btn-secondary btn-sm" title="Edit Patient">
                        <Icon name="edit" size={14} />
                        <span>Edit</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Browse by Owner View ───────────────────────────────── */}
      {viewMode === 'owners' && (
        <div className="owners-section-list">
          {groupedByOwner.length === 0 ? (
            <div className="empty-state card">
              <Icon name="user" size={48} />
              <div className="section-title">No clients found</div>
              <div className="section-sub">Try searching with a different name or phone number.</div>
            </div>
          ) : (
            groupedByOwner.map(({ owner, animals }) => (
              <section key={owner.id} className="owner-group-card">
                <div className="owner-group-header">
                  <div className="owner-profile-preview">
                    <div className="owner-avatar-circle">
                      {owner.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="owner-contact-details">
                      <div className="owner-title-name">{owner.name}</div>
                      <div className="owner-contact-subline">
                        <span className="flex items-center gap-1">
                          <Icon name="phone" size={13} className="text-outline" />
                          <strong className="data-mono">{owner.phone}</strong>
                        </span>
                        {owner.email && (
                          <span className="flex items-center gap-1">
                            <Icon name="mail" size={13} className="text-outline" />
                            <span>{owner.email}</span>
                          </span>
                        )}
                        {owner.address && (
                          <span className="flex items-center gap-1">
                            <Icon name="map-pin" size={13} className="text-outline" />
                            <span>{owner.address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-sm">
                    <span className="badge badge-primary">
                      {animals.length} {animals.length === 1 ? 'Animal' : 'Animals'}
                    </span>
                    <Link
                      to={`/patients/new?ownerId=${owner.id}`}
                      className="btn btn-secondary btn-sm"
                      title={`Add another animal for ${owner.name}`}
                    >
                      <Icon name="plus" size={14} />
                      <span>Add Animal</span>
                    </Link>
                  </div>
                </div>

                {/* Animals of this Owner */}
                {animals.length === 0 ? (
                  <div className="p-space-sm text-outline font-body-sm">
                    No animals currently registered for this client.
                  </div>
                ) : (
                  <div className="owner-animals-grid">
                    {animals.map((animal) => (
                      <div key={animal.id} className="owner-animal-item">
                        <div className="flex items-center gap-space-sm min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getAvatarClass(animal.species)}`}>
                            <Icon name="paw" size={16} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-heading font-bold text-on-surface truncate">
                              {animal.name}
                            </span>
                            <span className="text-xs text-on-surface-variant truncate">
                              {animal.species} {animal.breed ? `• ${animal.breed}` : ''}
                            </span>
                          </div>
                        </div>
                        <Link to={`/patients/${animal.id}`} className="btn btn-ghost btn-sm" title="View Animal">
                          <Icon name="arrow-right" size={16} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
};
