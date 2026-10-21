import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettingsStore } from '../../store/settingsStore';
import { Icon } from '../ui/Icon';
import './PracticeSwitcher.css';

export const PracticeSwitcher: React.FC = () => {
  const { practice, practices, switchPractice } = useAuth();
  const org = useSettingsStore((s) => s.organisation);
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectPractice = async (targetPracticeId: string) => {
    if (targetPracticeId === practice?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitchingId(targetPracticeId);
      await switchPractice(targetPracticeId);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch practice:', err);
    } finally {
      setSwitchingId(null);
    }
  };

  const currentSummary = practices.find((p) => p.practiceId === practice?.id);
  const displayName =
    (org?.isActive !== false && org?.name?.trim()) ||
    currentSummary?.practiceName ||
    practice?.name ||
    'Select Practice';
  const displayType = currentSummary?.practiceType === 'CLINIC' || (org?.isActive !== false && org?.name?.trim()) ? 'Clinic' : 'Practice';

  return (
    <div className="practice-switcher-container" ref={containerRef}>
      <button
        type="button"
        className={`practice-switcher-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={displayName}
      >
        <span className="practice-switcher-icon-wrap">
          <Icon name="hospital" size={15} />
        </span>
        <div className="practice-switcher-label">
          <span className="practice-switcher-name truncate" title={displayName}>{displayName}</span>
          <span className="practice-switcher-type-tag">{displayType}</span>
        </div>
        <Icon
          name="chevron-down"
          size={14}
          className={`practice-switcher-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="practice-switcher-dropdown" role="menu">
          <div className="practice-switcher-header">
            <div className="practice-switcher-header-title">
              <Icon name="swap-horiz" size={14} />
              <span>Switch Practice Workspace</span>
            </div>
            <span className="practice-switcher-count">
              {practices.length} {practices.length === 1 ? 'Workspace' : 'Workspaces'}
            </span>
          </div>

          <div className="practice-switcher-list">
            {practices.length === 0 ? (
              <div className="practice-switcher-empty">
                <span>No other practices linked to your account</span>
              </div>
            ) : (
              practices.map((p) => {
                const isCurrent = p.practiceId === practice?.id;
                const isSwitching = switchingId === p.practiceId;
                const isClinic = p.practiceType === 'CLINIC';
                const itemName = (isCurrent && org?.isActive !== false && org?.name?.trim()) || p.practiceName;

                return (
                  <button
                    key={p.practiceId}
                    type="button"
                    className={`practice-switcher-item ${isCurrent ? 'selected' : ''}`}
                    onClick={() => handleSelectPractice(p.practiceId)}
                    disabled={isSwitching}
                    role="menuitem"
                  >
                    <div className="practice-item-icon">
                      <Icon name={isClinic ? 'hospital' : 'paw'} size={16} />
                    </div>

                    <div className="practice-item-details">
                      <div className="practice-item-row-top">
                        <span className="practice-item-name truncate">{itemName}</span>
                        {isCurrent && (
                          <span className="practice-item-active-pill">
                            <Icon name="check" size={12} />
                            Active
                          </span>
                        )}
                        {isSwitching && (
                          <span className="practice-item-switching-pill">Switching...</span>
                        )}
                      </div>

                      <div className="practice-item-row-badges">
                        <span className={`practice-pill ${isClinic ? 'clinic' : 'individual'}`}>
                          {isClinic ? 'Clinic' : 'Individual'}
                        </span>

                        <span className="practice-pill role">
                          {p.role.replace('PRACTICE_', '').toLowerCase()}
                        </span>

                        {p.subscription && (
                          <span className={`practice-pill sub-${p.subscription.status.toLowerCase()}`}>
                            {p.subscription.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="practice-switcher-footer">
            <button
              type="button"
              className="practice-switcher-manage-btn"
              onClick={() => {
                setIsOpen(false);
                navigate('/choose-practice');
              }}
            >
              <Icon name="grid" size={13} />
              <span>View all practices screen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
