import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneCall,
  Navigation,
  Briefcase,
  UserPlus,
  PawPrint,
  Clock,
  X,
  Compass,
  ArrowRight,
  Info,
} from 'lucide-react';

interface QuickActionLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenIntake?: () => void;
}

export const QuickActionLauncher: React.FC<QuickActionLauncherProps> = ({
  isOpen,
  onClose,
  onOpenIntake,
}) => {
  const navigate = useNavigate();
  const [phaseModalInfo, setPhaseModalInfo] = useState<{ title: string; desc: string } | null>(null);

  if (!isOpen) return null;

  const handleAction = (action: string) => {
    switch (action) {
      case 'register-call':
        onClose();
        if (onOpenIntake) {
          onOpenIntake();
        } else {
          navigate('/calls/register');
        }
        break;
      case 'plan-my-day':
        onClose();
        navigate('/calls/plan');
        break;
      case 'new-patient':
        onClose();
        navigate('/patients/new');
        break;
      case 'new-owner':
        onClose();
        navigate('/patients/new');
        break;
      case 'current-visit':
        onClose();
        navigate('/calls/field');
        break;
      case 'field-bag':
        onClose();
        navigate('/inventory/bag');
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-action-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="quick-action-title" className="text-lg font-bold text-slate-800">
                    Quick Actions
                  </h2>
                  <p className="text-xs text-slate-500">Fast field shortcuts for mobile vets</p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close Quick Actions"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* 1. Register Call */}
            <button
              type="button"
              onClick={() => handleAction('register-call')}
              className="flex flex-col items-start p-3.5 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100/40 border border-teal-200 text-left hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/30 group-hover:scale-105 transition-transform mb-2">
                <PhoneCall className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-slate-800 leading-tight">Register Call</span>
              <span className="text-[11px] text-teal-700 font-medium mt-0.5">Log farmer request</span>
            </button>

            {/* 2. Plan My Day */}
            <button
              type="button"
              onClick={() => handleAction('plan-my-day')}
              className="flex flex-col items-start p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200 text-left hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform mb-2">
                <Navigation className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-slate-800 leading-tight">Plan My Day</span>
              <span className="text-[11px] text-emerald-700 font-medium mt-0.5">Route & Capacity</span>
            </button>

            {/* 3. Current Visit */}
            <button
              type="button"
              onClick={() => handleAction('current-visit')}
              className="flex flex-col items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left hover:bg-slate-100/70 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform mb-2">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-800 leading-tight">Current Visit</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5">Active timer & GPS</span>
            </button>

            {/* 4. Today's Field Bag */}
            <button
              type="button"
              onClick={() => handleAction('field-bag')}
              className="flex flex-col items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left hover:bg-slate-100/70 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform mb-2">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-slate-800 leading-tight">Today's Field Bag</span>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5">Vehicle stock status</span>
            </button>

            {/* 5. New Owner */}
            <button
              type="button"
              onClick={() => handleAction('new-owner')}
              className="flex flex-col items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left hover:bg-slate-100/70 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform mb-2">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-slate-800 leading-tight">New Owner</span>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5">Register client</span>
            </button>

            {/* 6. New Patient */}
            <button
              type="button"
              onClick={() => handleAction('new-patient')}
              className="flex flex-col items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left hover:bg-slate-100/70 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform mb-2">
                <PawPrint className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-slate-800 leading-tight">New Patient</span>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5">Register animal</span>
            </button>
          </div>

          {/* Quick Footer Link to Calls List */}
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Viewing call queue?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/calls');
              }}
              className="font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              Open Calls List <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Informational Modal for Coming Phases */}
      {phaseModalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-teal-700 mb-2">
              <Info className="w-5 h-5" />
              <h3 className="font-bold text-slate-800 text-base">{phaseModalInfo.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {phaseModalInfo.desc}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPhaseModalInfo(null)}
                className="py-2 px-4 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
