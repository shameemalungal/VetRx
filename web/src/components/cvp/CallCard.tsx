// ==============================================================================
// VetRx Call & Visit Planner — CallCard Component
// Displays field call with priority accents, mobile actions (tel, WA, postpone)
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import type { Call } from '../../types';
import { MoreVertical, Edit3, Trash2 } from 'lucide-react';

interface CallCardProps {
  call: Call;
  onPostpone?: (call: Call) => void;
  onSelect?: (call: Call) => void;
  onReviewCase?: (call: Call) => void;
  onEdit?: (call: Call) => void;
  onDelete?: (call: Call) => void;
}

export const CallCard: React.FC<CallCardProps> = ({
  call,
  onPostpone,
  onSelect,
  onReviewCase,
  onEdit,
  onDelete,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const priorityClass = `priority-${call.priority.toLowerCase()}`;

  // Close dropdown menu on click outside or Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

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

  const todayStr = new Date().toISOString().split('T')[0];
  const isPostponed = call.status === 'SCHEDULED' && Boolean(call.preferredDate && String(call.preferredDate) > todayStr);
  const isUpcoming = call.status === 'LOGGED' && Boolean(call.preferredDate && String(call.preferredDate) > todayStr);

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
      <div className="cvp-card-top flex items-center justify-between">
        <div className="cvp-badges-row flex-1 min-w-0">
          <span className={`cvp-priority-tag ${call.priority.toLowerCase()}`}>
            {call.priority.replace(/_/g, ' ')}
          </span>
          {isPostponed && (
            <span className="cvp-status-tag postponed">
              ⏳ Postponed
            </span>
          )}
          {isUpcoming && (
            <span className="cvp-status-tag upcoming">
              📅 Upcoming
            </span>
          )}
          {call.status === 'SCHEDULED' && !isPostponed && (
            <span className="cvp-status-tag scheduled">
              📅 Scheduled
            </span>
          )}
          {call.status === 'CANCELLED' && (
            <span className="cvp-status-tag cancelled">
              ✕ Cancelled
            </span>
          )}
          {call.species && (
            <span className="cvp-species-tag">
              {call.species} {call.animalCount && call.animalCount > 1 ? `(${call.animalCount})` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="cvp-time-stamp">{formatTimeAgo(call.createdAt)}</span>
          {/* Accessible Actions Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
              aria-label="Call options"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                role="menu"
                aria-orientation="vertical"
              >
                {onEdit && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-900 flex items-center gap-2 transition-colors"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onEdit(call);
                    }}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Edit Call</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDelete(call);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>Delete Call</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
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
        <button
          type="button"
          className="btn-card-action review-case"
          onClick={(e) => {
            e.stopPropagation();
            if (onReviewCase) onReviewCase(call);
            else if (onSelect) onSelect(call);
          }}
          title="Review Case & Next Actions"
        >
          📋 Review Case
        </button>
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
