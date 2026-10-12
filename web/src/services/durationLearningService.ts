// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Visit Duration Learning Engine (Phase 8)
// Robust, Explainable, Tenant-Isolated Statistical Duration Estimator
// ==============================================================================

import { db } from '../db/schema';
import type {
  Visit,
  ProcedureDurationEstimate,
  DurationEstimateSource,
} from '../types/cvp';

export const STANDARD_PROCEDURE_DEFAULTS: Record<string, number> = {
  EMERGENCY: 45,
  SURGICAL: 60,
  SURGERY: 60,
  AI: 20,
  ARTIFICIAL_INSEMINATION: 20,
  PREGNANCY_DIAGNOSIS: 15,
  PD: 15,
  VACCINATION: 15,
  DEWORMING: 15,
  POST_OPERATIVE_REVIEW: 20,
  POST_OP_REVIEW: 20,
  POST_TREATMENT_REVIEW: 20,
  RECHECK: 20,
  GENERAL: 30,
};

export const DEFAULT_PROCEDURE_DURATIONS = STANDARD_PROCEDURE_DEFAULTS;

export const MIN_OBSERVATION_THRESHOLD = 3;
export const MIN_PLAUSIBLE_MINUTES = 5;
export const MAX_PLAUSIBLE_MINUTES = 300; // 5 hours

export interface DurationObservation {
  visitId: string | number;
  practiceId: string;
  procedureCategory: string;
  animalCount: number;
  actualDurationMinutes: number;
  completedAt: Date | string;
}

export class DurationLearningService {
  /**
   * Normalize procedure category string to standard clinical buckets.
   */
  static normalizeCategory(rawCategory?: string): string {
    if (!rawCategory || !rawCategory.trim()) return 'GENERAL';
    const cat = rawCategory.trim().toUpperCase();

    if (cat.includes('EMERGENCY')) return 'EMERGENCY';
    if (cat.includes('SURG') || cat.includes('OPERAT')) return 'SURGICAL';
    if (cat === 'AI' || cat.includes('INSEMINAT')) return 'AI';
    if (cat === 'PD' || cat.includes('PREGNAN')) return 'PREGNANCY_DIAGNOSIS';
    if (cat.includes('VACCIN')) return 'VACCINATION';
    if (cat.includes('DEWORM')) return 'DEWORMING';
    if (cat.includes('POST_OP') || cat.includes('POST-OP')) return 'POST_OPERATIVE_REVIEW';
    if (cat.includes('POST_TREATMENT') || cat.includes('RECHECK')) return 'POST_TREATMENT_REVIEW';

    return 'GENERAL';
  }

  /**
   * Get default duration in minutes for a given procedure category.
   */
  static getDefaultDuration(category: string): number {
    const normalized = this.normalizeCategory(category);
    return STANDARD_PROCEDURE_DEFAULTS[normalized] ?? 30;
  }

  /**
   * Compute median of an array of numbers.
   * Robust against outliers compared to arithmetic mean.
   */
  static computeMedian(numbers: number[]): number {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
      return sorted[mid];
    }
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  /**
   * Compute trimmed median or mean excluding top and bottom 10% when N >= 6.
   */
  static computeTrimmedEstimate(numbers: number[]): number {
    if (!numbers || numbers.length === 0) return 0;
    if (numbers.length < 6) {
      return this.computeMedian(numbers);
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const trimCount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    return this.computeMedian(trimmed);
  }

  /**
   * Extract reliable, valid duration observations from completed visits.
   * Filters out:
   * 1. Non-completed visits.
   * 2. Cancelled or postponed visits.
   * 3. Implausible durations (< 5 mins or > 300 mins).
   * 4. Multi-tenant isolation: strictly for given practiceId.
   */
  static extractValidObservations(visits: Visit[], practiceId?: string): DurationObservation[] {
    const observations: DurationObservation[] = [];

    for (const v of visits) {
      if (practiceId && v.practiceId && v.practiceId !== practiceId) {
        continue;
      }
      if (v.status !== 'COMPLETED') {
        continue;
      }

      // Determine actual duration
      let duration = v.actualDurationMinutes;
      if ((!duration || duration <= 0) && v.visitStartedAt && v.visitCompletedAt) {
        const start = new Date(v.visitStartedAt).getTime();
        const end = new Date(v.visitCompletedAt).getTime();
        if (end > start) {
          duration = Math.round((end - start) / 60000);
        }
      }

      if (!duration || duration < MIN_PLAUSIBLE_MINUTES || duration > MAX_PLAUSIBLE_MINUTES) {
        // Discard invalid / implausible
        continue;
      }

      // Determine animal count
      const casesCount = (v.cases && v.cases.length > 0) ? v.cases.length : 1;

      // Extract procedures
      const primaryCategory = v.cases?.[0]?.procedureCategory ||
        v.procedures?.[0]?.procedureCategory ||
        (v.priority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL');

      const normalized = this.normalizeCategory(primaryCategory);

      observations.push({
        visitId: v.id!,
        practiceId: v.practiceId || practiceId || 'default-practice',
        procedureCategory: normalized,
        animalCount: casesCount,
        actualDurationMinutes: duration,
        completedAt: v.visitCompletedAt || v.updatedAt || new Date(),
      });
    }

    return observations;
  }

  /**
   * Calculate procedure duration estimates from local or provided visits.
   */
  static async calculateEstimatesForPractice(
    practiceId: string,
    providedVisits?: Visit[]
  ): Promise<ProcedureDurationEstimate[]> {
    const visits = providedVisits ?? ((await db.visits.toArray()) as Visit[]);
    const observations = this.extractValidObservations(visits, practiceId);

    // Group observations by procedure category
    const grouped = new Map<string, DurationObservation[]>();
    for (const obs of observations) {
      const list = grouped.get(obs.procedureCategory) || [];
      list.push(obs);
      grouped.set(obs.procedureCategory, list);
    }

    // Fetch existing stored estimates to preserve manual overrides
    const storedEstimates = (await db.procedureDurationEstimates.toArray()) as ProcedureDurationEstimate[];
    const storedMap = new Map<string, ProcedureDurationEstimate>(
      storedEstimates
        .filter((e) => !e.practiceId || e.practiceId === practiceId)
        .map((e) => [this.normalizeCategory(e.procedureCategory), e])
    );

    const categories = [
      'GENERAL',
      'EMERGENCY',
      'SURGICAL',
      'AI',
      'PREGNANCY_DIAGNOSIS',
      'VACCINATION',
      'DEWORMING',
      'POST_OPERATIVE_REVIEW',
      'POST_TREATMENT_REVIEW',
    ];

    const results: ProcedureDurationEstimate[] = [];

    for (const cat of categories) {
      const defaultDuration = this.getDefaultDuration(cat);
      const existing = storedMap.get(cat);
      const obsList = grouped.get(cat) || [];
      const sampleCount = obsList.length;

      // Single animal normalized durations
      // For visits with multiple animals, baseline single-animal = duration - (count - 1) * 10
      const singleAnimalDurations = obsList.map((obs) => {
        if (obs.animalCount > 1) {
          const adjusted = obs.actualDurationMinutes - (obs.animalCount - 1) * 10;
          return Math.max(MIN_PLAUSIBLE_MINUTES, adjusted);
        }
        return obs.actualDurationMinutes;
      });

      let learnedMinutes: number | undefined;
      let source: DurationEstimateSource = 'DEFAULT';
      let effectiveDuration = defaultDuration;

      if (sampleCount >= MIN_OBSERVATION_THRESHOLD) {
        learnedMinutes = this.computeTrimmedEstimate(singleAnimalDurations);
        source = 'PRACTICE_LEARNED';
        effectiveDuration = learnedMinutes;
      }

      // Check if veterinarian manually overrode this
      if (existing?.manualOverrideMinutes != null && existing.manualOverrideMinutes > 0) {
        source = 'MANUAL_OVERRIDE';
        effectiveDuration = existing.manualOverrideMinutes;
      }

      const estimate: ProcedureDurationEstimate = {
        id: existing?.id,
        practiceId,
        procedureCategory: cat,
        defaultDurationMinutes: defaultDuration,
        learnedDurationMinutes: learnedMinutes,
        manualOverrideMinutes: existing?.manualOverrideMinutes,
        sampleCount,
        source,
        effectiveDurationMinutes: effectiveDuration,
        incrementalPerAnimalMinutes: 10,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      };

      results.push(estimate);

      // Upsert into Dexie
      try {
        if (existing?.id) {
          await db.procedureDurationEstimates.update(existing.id as any, estimate as any);
        } else {
          const newId = await db.procedureDurationEstimates.add(estimate as any);
          estimate.id = newId;
        }
      } catch (err) {
        // Safe offline / storage fallback
      }
    }

    return results;
  }

  /**
   * Set a veterinarian manual override for a procedure duration.
   */
  static async setManualOverride(
    practiceId: string,
    procedureCategory: string,
    overrideMinutes: number | null
  ): Promise<ProcedureDurationEstimate> {
    const cat = this.normalizeCategory(procedureCategory);
    const existing = (await db.procedureDurationEstimates.toArray()) as ProcedureDurationEstimate[];
    const match = existing.find(
      (e) => e.practiceId === practiceId && this.normalizeCategory(e.procedureCategory) === cat
    );

    const defaultDuration = this.getDefaultDuration(cat);
    let estimate: ProcedureDurationEstimate;

    if (match) {
      const hasOverride = overrideMinutes != null && overrideMinutes > 0;
      const learned = match.learnedDurationMinutes;
      const sampleCount = match.sampleCount || 0;

      let source: DurationEstimateSource = 'DEFAULT';
      let effective = defaultDuration;

      if (hasOverride) {
        source = 'MANUAL_OVERRIDE';
        effective = overrideMinutes;
      } else if (sampleCount >= MIN_OBSERVATION_THRESHOLD && learned != null) {
        source = 'PRACTICE_LEARNED';
        effective = learned;
      }

      estimate = {
        ...match,
        manualOverrideMinutes: hasOverride ? overrideMinutes : undefined,
        source,
        effectiveDurationMinutes: effective,
        updatedAt: new Date(),
      };

      await db.procedureDurationEstimates.update(match.id as any, estimate as any);
    } else {
      const hasOverride = overrideMinutes != null && overrideMinutes > 0;
      estimate = {
        practiceId,
        procedureCategory: cat,
        defaultDurationMinutes: defaultDuration,
        manualOverrideMinutes: hasOverride ? overrideMinutes : undefined,
        sampleCount: 0,
        source: hasOverride ? 'MANUAL_OVERRIDE' : 'DEFAULT',
        effectiveDurationMinutes: hasOverride ? overrideMinutes : defaultDuration,
        incrementalPerAnimalMinutes: 10,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      };

      const newId = await db.procedureDurationEstimates.add(estimate as any);
      estimate.id = newId;
    }

    return estimate;
  }

  /**
   * Get effective duration directly from a ProcedureDurationEstimate record.
   */
  static getEffectiveDurationFromEstimate(
    estimate: ProcedureDurationEstimate,
    animalCount: number = 1
  ): number {
    const base = estimate.manualOverrideMinutes ?? estimate.learnedDurationMinutes ?? estimate.defaultDurationMinutes;
    const incremental = estimate.incrementalPerAnimalMinutes ?? 10;
    const extra = animalCount > 1 ? (animalCount - 1) * incremental : 0;
    return base + extra;
  }

  /**
   * Get effective duration estimate for a visit, respecting learned data and overrides.
   */
  static async getEffectiveVisitDuration(
    visit: Visit,
    practiceId?: string,
    cachedEstimates?: Map<string, ProcedureDurationEstimate>
  ): Promise<{
    durationMinutes: number;
    source: DurationEstimateSource;
    sampleCount: number;
    baseProcedureDuration: number;
    multiAnimalIncremental: number;
  }> {
    // 1. Visit-level explicit override on stop or visit
    if (visit.estimatedDurationMinutes && visit.estimatedDurationMinutes > 0) {
      // If visit has explicit override, return it
      return {
        durationMinutes: visit.estimatedDurationMinutes,
        source: 'MANUAL_OVERRIDE',
        sampleCount: 0,
        baseProcedureDuration: visit.estimatedDurationMinutes,
        multiAnimalIncremental: 0,
      };
    }

    // Determine primary procedure category
    const rawCat = visit.cases?.[0]?.procedureCategory ||
      visit.procedures?.[0]?.procedureCategory ||
      (visit.priority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL');
    const normalizedCat = this.normalizeCategory(rawCat);

    // Look up estimate
    let estimate: ProcedureDurationEstimate | undefined;
    if (cachedEstimates && cachedEstimates.has(normalizedCat)) {
      estimate = cachedEstimates.get(normalizedCat);
    } else {
      const pId = practiceId || visit.practiceId;
      if (pId) {
        const stored = (await db.procedureDurationEstimates.toArray()) as ProcedureDurationEstimate[];
        estimate = stored.find(
          (e) => (!e.practiceId || e.practiceId === pId) && this.normalizeCategory(e.procedureCategory) === normalizedCat
        );
      }
    }

    const baseDuration = estimate?.effectiveDurationMinutes ?? this.getDefaultDuration(normalizedCat);
    const source: DurationEstimateSource = estimate?.source ?? 'DEFAULT';
    const sampleCount = estimate?.sampleCount ?? 0;

    // Multi-animal farm scaling:
    // +10 mins per additional animal case beyond the first at the same physical location
    const animalCount = (visit.cases && visit.cases.length > 0) ? visit.cases.length : 1;
    const incrementalPerAnimal = estimate?.incrementalPerAnimalMinutes ?? 10;
    const multiAnimalIncremental = animalCount > 1 ? (animalCount - 1) * incrementalPerAnimal : 0;
    const totalDuration = baseDuration + multiAnimalIncremental;

    return {
      durationMinutes: totalDuration,
      source,
      sampleCount,
      baseProcedureDuration: baseDuration,
      multiAnimalIncremental,
    };
  }
}

export const durationLearningService = DurationLearningService;
