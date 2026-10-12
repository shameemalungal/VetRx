// ==============================================================================
// VetRx Call & Visit Planner — CallCard Component
// Displays field call with priority accents, mobile actions (tel, WA, postpone)
// ==============================================================================

import React from 'react';
import type { Call } from '../../types';

interface CallCardProps {
  call: Call;
  onPostpone?: (call: Call) => void;
  onSelect?: (call: Call) => void;
}

export const CallCard: React.FC<CallCardProps> = ({ call, onPostpone, onSelect }) => {
  const priorityClass = `priority-${call.priority.toLowerCase()}`;

  const formatTimeAgo = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const diffMins = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const cleanPhone = (phone?: string) => (phone ? phone.replace(/[^0-9+]/g, '') : '');

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = cleanPhone(call.callerPhone);
    if (!phone) return;
    const msg = encodeURIComponent(
      `Hello ${call.ownerName || 'Sir/Madam'}, this is Dr. from VetRx regarding your call for ${call.species || 'animal'}.`
    );
    window.open(`https://wa.me/${phone.replace('+', '')}?text=${msg}`, '_blank');
  };

  const handlePhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = cleanPhone(call.callerPhone);
    if (phone) window.open(`tel:${phone}`, '_self');
  };

  const handleOpenMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (call.latitude && call.longitude) {
      window.open(`https://maps.google.com/?q=${call.latitude},${call.longitude}`, '_blank');
    } else if (call.locationAddress) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(call.locationAddress)}`, '_blank');
    }
  };

  return (
    <div
      className={`cvp-call-card ${priorityClass}`}
      onClick={() => onSelect && onSelect(call)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect && onSelect(call);
        }
      }}
    >
      <div className="cvp-card-top">
        <div className="cvp-badges-row">
          <span className={`cvp-priority-tag ${call.priority.toLowerCase()}`}>
            {call.priority.replace(/_/g, ' ')}
          </span>
          {call.species && (
            <span className="cvp-species-tag">
              {call.species} {call.animalCount && call.animalCount > 1 ? `(${call.animalCount})` : ''}
            </span>
          )}
        </div>
        <span className="cvp-time-stamp">{formatTimeAgo(call.createdAt)}</span>
      </div>

      <h3 className="cvp-owner-name">
        {call.ownerName || call.tempOwnerName || 'Unknown Caller'}
      </h3>

      {call.locationAddress && (
        <div className="cvp-location-row" onClick={handleOpenMap} title="Open in Maps">
          <span>📍 {call.locationAddress}</span>
        </div>
      )}

      <div className="cvp-symptoms-box">
        {call.tentativeAssessment && (
          <div className="cvp-assessment-label">
            Assessment: {call.tentativeAssessment}
          </div>
        )}
        <div>{call.symptoms}</div>
      </div>

      {call.plannedProcedure && (
        <div className="cvp-procedure-chip">
          <span>💉 {call.plannedProcedure}</span>
        </div>
      )}

      {/* Action Strip */}
      <div className="cvp-card-actions">
        {call.callerPhone && (
          <button
            type="button"
            className="btn-card-action phone"
            onClick={handlePhone}
            title="Call Farmer"
          >
            📞 Call
          </button>
        )}
        {call.callerPhone && (
          <button
            type="button"
            className="btn-card-action whatsapp"
            onClick={handleWhatsApp}
            title="WhatsApp Message"
          >
            💬 WhatsApp
          </button>
        )}
        {onPostpone && (
          <button
            type="button"
            className="btn-card-action postpone"
            onClick={(e) => {
              e.stopPropagation();
              onPostpone(call);
            }}
            title="Postpone Visit"
          >
            ⏳ Postpone
          </button>
        )}
      </div>
    </div>
  );
};
