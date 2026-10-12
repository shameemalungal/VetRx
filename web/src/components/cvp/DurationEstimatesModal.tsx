// ==============================================================================
// VetRx Call & Visit Planner — DurationEstimatesModal Component (Phase 8)
// Inspect default vs learned procedure durations, sample counts, and doctor overrides
// ==============================================================================

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { durationLearningService } from '../../services/durationLearningService';
import type { ProcedureDurationEstimate } from '../../types/cvp';
import {
  Clock,
  Sparkles,
  Edit2,
  Check,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';

interface DurationEstimatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string;
}

export const DurationEstimatesModal: React.FC<DurationEstimatesModalProps> = ({
  isOpen,
  onClose,
  practiceId,
}) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live query estimates
  const estimates = useLiveQuery(
    async () => {
      let stored = (await db.procedureDurationEstimates.toArray()) as ProcedureDurationEstimate[];
      stored = stored.filter((e) => !e.practiceId || e.practiceId === practiceId);
      if (stored.length === 0) {
        // Auto-seed/calculate initial estimates
        stored = await durationLearningService.calculateEstimatesForPractice(practiceId);
      }
      return stored;
    },
    [practiceId]
  ) || [];

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await durationLearningService.calculateEstimatesForPractice(practiceId);
    } catch (err) {
      console.warn('Failed to refresh estimates:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartEdit = (est: ProcedureDurationEstimate) => {
    setEditingCategory(est.procedureCategory);
    setOverrideValue(String(est.manualOverrideMinutes || est.effectiveDurationMinutes || ''));
  };

  const handleSaveOverride = async (category: string) => {
    const mins = Number(overrideValue);
    await durationLearningService.setManualOverride(
      practiceId,
      category,
      !isNaN(mins) && mins > 0 ? mins : null
    );
    setEditingCategory(null);
  };

  const handleClearOverride = async (category: string) => {
    await durationLearningService.setManualOverride(practiceId, category, null);
    setEditingCategory(null);
  };

  const friendlyCategory = (cat: string) => {
    const map: Record<string, string> = {
      GENERAL: 'General Medical Examination',
      EMERGENCY: 'Emergency & Critical Care',
      SURGICAL: 'Surgical Procedures',
      AI: 'Artificial Insemination (AI)',
      PREGNANCY_DIAGNOSIS: 'Pregnancy Diagnosis (PD)',
      VACCINATION: 'Vaccination Protocols',
      DEWORMING: 'Deworming & Parasite Control',
      POST_OPERATIVE_REVIEW: 'Post-Operative Recovery Check',
      POST_TREATMENT_REVIEW: 'Post-Treatment Health Review',
    };
    return map[cat] || cat;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duration-estimates-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-blue-200">
                Route Engine Intelligence (Phase 8)
              </div>
              <h2 id="duration-estimates-title" className="text-lg font-black tracking-tight">
                Procedure Visit Duration Learning
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
              title="Recalculate from completed visits"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Explanatory Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            The route capacity engine automatically learns procedure durations from your practice&apos;s completed visits using a robust statistical median (min. 3 completed visits, excluding outliers). You can manually override any estimate.
          </p>
        </div>

        {/* Content Table / List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {estimates.map((est) => {
            const isEditing = editingCategory === est.procedureCategory;

            return (
              <div
                key={est.procedureCategory}
                className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-900 text-sm">
                      {friendlyCategory(est.procedureCategory)}
                    </span>

                    {/* Source Badges */}
                    {est.source === 'MANUAL_OVERRIDE' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Doctor Override
                      </span>
                    )}
                    {est.source === 'PRACTICE_LEARNED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        Practice Learned (N={est.sampleCount})
                      </span>
                    )}
                    {est.source === 'DEFAULT' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Default Baseline (N={est.sampleCount}/3)
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-x-3">
                    <span>Default: <strong className="text-slate-700">{est.defaultDurationMinutes} min</strong></span>
                    {est.learnedDurationMinutes != null && (
                      <span>Learned Median: <strong className="text-emerald-700">{est.learnedDurationMinutes} min</strong></span>
                    )}
                    <span>+10 min/extra animal</span>
                  </div>
                </div>

                {/* Right side: Duration & Override controls */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(e.target.value)}
                        className="w-16 text-xs p-1.5 border border-purple-300 rounded-lg text-center font-bold"
                        placeholder="Mins"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOverride(est.procedureCategory)}
                        className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        title="Save override"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="p-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-base font-black text-slate-900 leading-none">
                          {est.effectiveDurationMinutes}
                          <span className="text-xs font-normal text-slate-500 ml-1">min</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Effective Estimate</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(est)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                        title="Override estimate"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {est.manualOverrideMinutes != null && (
                        <button
                          type="button"
                          onClick={() => handleClearOverride(est.procedureCategory)}
                          className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold"
                          title="Reset to learned/default"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Tenant Isolated to Practice: {practiceId}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
