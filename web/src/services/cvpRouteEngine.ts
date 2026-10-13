// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Route & Capacity Engine
// Deterministic, Explainable, Priority-Aware, Multi-Animal & Offline-Safe
// ==============================================================================

import type {
  Visit,
  RouteStop,
  RouteCalculationResult,
  PostponableCandidate,
  EmergencyProposal,
  Call,
  ProcedureDurationEstimate,
} from '../types/cvp';

export interface RouteEngineConfig {
  startLocationAddress?: string;
  startLatitude?: number;
  startLongitude?: number;
  startTime?: string; // e.g. "08:30"
  workingMinutesAvailable?: number; // default: 480 (8 hrs)
  breakMinutes?: number; // default: 45
  bufferMinutes?: number; // default: 30
  averageSpeedKmH?: number; // default: 35 km/h for mixed rural/semi-urban veterinary rounds
  defaultTransitMinutes?: number; // default: 20 mins when coordinates missing
  defaultTransitKm?: number; // default: 10 km when coordinates missing
  durationEstimates?: Map<string, ProcedureDurationEstimate> | ProcedureDurationEstimate[] | Record<string, ProcedureDurationEstimate>;
}

export class CvpRouteEngine {
  // ── 1. Calculate Haversine Distance (km) ──────────────────────────
  static calculateDistanceKm(
    lat1?: number | null,
    lon1?: number | null,
    lat2?: number | null,
    lon2?: number | null
  ): number | null {
    if (
      lat1 == null ||
      lon1 == null ||
      lat2 == null ||
      lon2 == null ||
      isNaN(lat1) ||
      isNaN(lon1) ||
      isNaN(lat2) ||
      isNaN(lon2)
    ) {
      return null;
    }

    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // 1 decimal place
  }

  // ── 2. Estimate Transit Time (minutes) ────────────────────────────
  static estimateTransitMinutes(
    distanceKm: number | null,
    averageSpeedKmH: number = 35,
    defaultMinutes: number = 20
  ): number {
    if (distanceKm == null) {
      return defaultMinutes;
    }
    // (km / speed) * 60 + 5 minutes turnaround / gate arrival
    return Math.max(5, Math.ceil((distanceKm / averageSpeedKmH) * 60) + 5);
  }

  // ── 3. Estimate Visit Duration (minutes) ──────────────────────────
  // Precedence:
  // 1. Explicit override on stop
  // 2. Doctor-entered visit estimate
  // 3. Learned Practice Estimate / Category-specific Override
  // 4. Procedure-based calculation (+10 min per additional animal at same location)
  // 5. Conservative general default (30 min)
  static estimateVisitDuration(
    visit: Visit,
    overrideMinutes?: number,
    durationEstimates?: Map<string, ProcedureDurationEstimate> | ProcedureDurationEstimate[] | Record<string, ProcedureDurationEstimate>
  ): number {
    if (overrideMinutes != null && overrideMinutes > 0) {
      return overrideMinutes;
    }
    if (visit.estimatedDurationMinutes && visit.estimatedDurationMinutes > 0) {
      return visit.estimatedDurationMinutes;
    }

    const cases = visit.cases || [];

    // Determine category
    let category = 'GENERAL';
    if (
      visit.priority === 'EMERGENCY' ||
      cases.some((c) => (c.procedureCategory || '').toUpperCase().includes('EMERGENCY'))
    ) {
      category = 'EMERGENCY';
    } else if (cases.some((c) => (c.procedureCategory || '').toUpperCase().includes('SURG'))) {
      category = 'SURGICAL';
    } else if (
      cases.some(
        (c) =>
          (c.procedureCategory || '').toUpperCase() === 'AI' ||
          (c.chiefComplaint || '').toUpperCase().includes('INSEMINATION')
      )
    ) {
      category = 'AI';
    } else if (
      cases.some(
        (c) =>
          (c.procedureCategory || '').toUpperCase() === 'PD' ||
          (c.chiefComplaint || '').toUpperCase().includes('PREGNANCY')
      )
    ) {
      category = 'PREGNANCY_DIAGNOSIS';
    } else if (
      cases.some(
        (c) =>
          (c.procedureCategory || '').toUpperCase() === 'VACCINATION' ||
          (c.chiefComplaint || '').toUpperCase().includes('VACCIN')
      )
    ) {
      category = 'VACCINATION';
    } else if (cases.some((c) => (c.procedureCategory || '').toUpperCase().includes('DEWORM'))) {
      category = 'DEWORMING';
    }

    // Check learned duration estimates map / array if provided
    let baseMinutes: number | undefined;
    let incrementalPerAnimal = 10;

    if (durationEstimates) {
      let matchedEstimate: ProcedureDurationEstimate | undefined;
      if (durationEstimates instanceof Map) {
        matchedEstimate = durationEstimates.get(category);
      } else if (Array.isArray(durationEstimates)) {
        matchedEstimate = durationEstimates.find(
          (e) => (e.procedureCategory || '').toUpperCase() === category
        );
      } else if (typeof durationEstimates === 'object') {
        matchedEstimate = (durationEstimates as Record<string, ProcedureDurationEstimate>)[category];
      }

      const effMinutes = matchedEstimate?.effectiveDurationMinutes ??
        matchedEstimate?.manualOverrideMinutes ??
        matchedEstimate?.learnedDurationMinutes ??
        matchedEstimate?.defaultDurationMinutes;

      if (matchedEstimate && effMinutes && effMinutes > 0) {
        baseMinutes = effMinutes;
        incrementalPerAnimal = matchedEstimate.incrementalPerAnimalMinutes ?? 10;
      }
    }

    if (baseMinutes == null) {
      if (category === 'EMERGENCY') {
        baseMinutes = 45;
      } else if (category === 'SURGICAL') {
        baseMinutes = 60;
      } else if (category === 'AI') {
        baseMinutes = 20;
      } else if (category === 'PREGNANCY_DIAGNOSIS' || category === 'VACCINATION' || category === 'DEWORMING') {
        baseMinutes = 15;
      } else {
        baseMinutes = 30;
      }
    }

    // Multi-animal farm: one physical location visit contains multiple cases.
    if (cases.length > 1) {
      baseMinutes += (cases.length - 1) * incrementalPerAnimal;
    }

    return baseMinutes;
  }

  // ── 4. Generate Suggested Route Sequence ─────────────────────────
  static generateSuggestedRoute(
    visits: Visit[],
    config: RouteEngineConfig = {},
    existingStops: RouteStop[] = []
  ): RouteCalculationResult {
    const workingHours = config.workingMinutesAvailable ?? 480;
    const breakMinutes = config.breakMinutes ?? 45;
    const bufferMinutes = config.bufferMinutes ?? 30;
    const avgSpeed = config.averageSpeedKmH ?? 35;
    const defaultTransit = config.defaultTransitMinutes ?? 20;
    const defaultKm = config.defaultTransitKm ?? 10;
    const startTimeStr = config.startTime || '08:30';

    const availableWorkingMinutes = Math.max(0, workingHours - breakMinutes);

    // Active visits only (exclude cancelled and postponed)
    const activeVisits = visits.filter(
      (v) => v.status !== 'CANCELLED' && v.status !== 'POSTPONED'
    );

    if (activeVisits.length === 0) {
      return {
        stops: [],
        totalEstimatedKm: 0,
        totalEstimatedTravelMinutes: 0,
        totalEstimatedVisitMinutes: 0,
        workingMinutesAvailable: availableWorkingMinutes,
        breakMinutes,
        bufferMinutes,
        totalRequiredMinutes: 0,
        remainingMinutes: availableWorkingMinutes,
        isOverCapacity: false,
        overCapacityMinutes: 0,
        hasMissingCoordinates: false,
        postponableCandidates: [],
      };
    }

    // Build lookup for existing locked stops
    const lockedStopMap = new Map<number | string, RouteStop>();
    const lockedPositions = new Map<number, RouteStop>();

    for (const s of existingStops) {
      if (s.isLocked) {
        lockedStopMap.set(s.visitId, s);
        lockedPositions.set(s.stopOrder, s);
      }
    }

    // Separate visits into locked and unlocked
    const lockedVisits: Visit[] = [];
    const unlockedVisits: Visit[] = [];

    for (const v of activeVisits) {
      if (lockedStopMap.has(v.id!)) {
        lockedVisits.push(v);
      } else {
        unlockedVisits.push(v);
      }
    }

    // Sort unlocked visits by deterministic precedence rules:
    // 1. EMERGENCY (0)
    // 2. URGENT (1)
    // 3. Timed Procedure: AI (estrus morning window) (2)
    // 4. MUST_ATTEND_TODAY (3)
    // 5. Proximity to start / previous
    unlockedVisits.sort((a, b) => {
      // 1. Priority comparison
      const priorityWeight = (p: string) => {
        if (p === 'EMERGENCY') return 0;
        if (p === 'URGENT') return 1;
        if (p === 'COULD_NOT_ASSESS') return 2;
        return 3;
      };
      const pDiff = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pDiff !== 0) return pDiff;

      // 2. AI procedure precedence
      const isAI = (v: Visit) =>
        (v.cases || []).some(
          (c) =>
            (c.procedureCategory || '').toUpperCase() === 'AI' ||
            (c.chiefComplaint || '').toUpperCase().includes('INSEMINATION')
        );
      if (isAI(a) && !isAI(b)) return -1;
      if (!isAI(a) && isAI(b)) return 1;

      // 3. Flexibility
      const flexWeight = (f: string) => {
        if (f === 'MUST_ATTEND_TODAY') return 0;
        if (f === 'PREFERRED_TODAY') return 1;
        if (f === 'CAN_POSTPONE_TODAY') return 2;
        return 3;
      };
      const fDiff = flexWeight(a.flexibility) - flexWeight(b.flexibility);
      if (fDiff !== 0) return fDiff;

      // 4. Geographic proximity to start coordinates
      if (config.startLatitude != null && config.startLongitude != null) {
        const distA = this.calculateDistanceKm(
          config.startLatitude,
          config.startLongitude,
          a.latitude,
          a.longitude
        );
        const distB = this.calculateDistanceKm(
          config.startLatitude,
          config.startLongitude,
          b.latitude,
          b.longitude
        );
        if (distA != null && distB != null) {
          return distA - distB;
        }
      }

      return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
    });

    // Assemble final ordered visits, honoring locked stop positions
    const totalSlots = activeVisits.length;
    const orderedVisits: Visit[] = new Array(totalSlots);

    // Place locked visits in their exact original slot
    for (const lv of lockedVisits) {
      const lockData = lockedStopMap.get(lv.id!)!;
      const targetSlot = Math.min(totalSlots - 1, Math.max(0, lockData.stopOrder - 1));
      if (!orderedVisits[targetSlot]) {
        orderedVisits[targetSlot] = lv;
      } else {
        // If collision, put in nearest empty slot
        for (let i = 0; i < totalSlots; i++) {
          if (!orderedVisits[i]) {
            orderedVisits[i] = lv;
            break;
          }
        }
      }
    }

    // Fill remaining empty slots with sorted unlocked visits
    let unlockedIdx = 0;
    for (let i = 0; i < totalSlots; i++) {
      if (!orderedVisits[i]) {
        orderedVisits[i] = unlockedVisits[unlockedIdx++];
      }
    }

    // Now calculate timeline, transit, ETAs, and ETDs
    const stops: RouteStop[] = [];
    let totalKm = 0;
    let totalTravelMins = 0;
    let totalVisitMins = 0;
    let hasMissingCoordinates = false;

    // Parse start time
    const [startHourStr, startMinStr] = startTimeStr.split(':');
    const startHour = parseInt(startHourStr || '8', 10);
    const startMin = parseInt(startMinStr || '30', 10);

    const baseDate = new Date();
    baseDate.setHours(startHour, startMin, 0, 0);
    let currentTime = new Date(baseDate);

    let prevLat = config.startLatitude;
    let prevLon = config.startLongitude;

    for (let i = 0; i < orderedVisits.length; i++) {
      const v = orderedVisits[i];
      if (!v) continue;

      const isLocked = lockedStopMap.has(v.id!);
      const existingStopData = lockedStopMap.get(v.id!);
      const overrideDuration = existingStopData?.durationMinutesOverride;

      const visitDuration = this.estimateVisitDuration(v, overrideDuration, config.durationEstimates);
      totalVisitMins += visitDuration;

      // Distance and transit
      const dist = this.calculateDistanceKm(prevLat, prevLon, v.latitude, v.longitude);
      let transit = 0;
      let legKm = 0;
      let isApprox = false;

      if (dist != null) {
        legKm = dist;
        transit = this.estimateTransitMinutes(dist, avgSpeed, defaultTransit);
      } else {
        legKm = defaultKm;
        transit = defaultTransit;
        isApprox = true;
        hasMissingCoordinates = true;
      }

      totalKm += legKm;
      totalTravelMins += transit;

      // Advance clock for transit
      currentTime = new Date(currentTime.getTime() + transit * 60000);
      const estimatedArrival = new Date(currentTime);

      // Advance clock for visit duration
      currentTime = new Date(currentTime.getTime() + visitDuration * 60000);
      const estimatedDeparture = new Date(currentTime);

      // Update previous position if current has coordinates
      if (v.latitude != null && v.longitude != null) {
        prevLat = v.latitude;
        prevLon = v.longitude;
      }

      // Determine explanation reason
      let reason = '';
      if (isLocked) {
        reason = `Locked at Stop #${i + 1} by Doctor`;
      } else if (v.priority === 'EMERGENCY') {
        reason = 'Critical Emergency: Attend immediately as first stop';
      } else if (v.priority === 'URGENT') {
        reason = 'Urgent clinical condition: Scheduled before routine visits';
      } else if (
        (v.cases || []).some((c) => (c.procedureCategory || '').toUpperCase() === 'AI')
      ) {
        reason = 'Time-sensitive procedure: Artificial Insemination (morning window)';
      } else if (dist != null) {
        reason = `Proximity-optimized stop (+${dist} km, ~${transit}m travel)`;
      } else {
        reason = 'Scheduled visit (address-only fallback routing)';
      }

      stops.push({
        id: `stop-${i + 1}`,
        visitId: v.id!,
        stopOrder: i + 1,
        visit: v,
        estimatedArrival,
        estimatedDeparture,
        isLocked,
        transitMinutesFromPrevious: transit,
        distanceKmFromPrevious: legKm,
        isApproximateLocation: isApprox,
        suggestedReason: reason,
        durationMinutesOverride: overrideDuration,
      });
    }

    const totalRequiredMinutes = totalTravelMins + totalVisitMins + bufferMinutes;
    const remainingMinutes = Math.max(0, availableWorkingMinutes - totalRequiredMinutes);
    const isOverCapacity = totalRequiredMinutes > availableWorkingMinutes;
    const overCapacityMinutes = isOverCapacity
      ? totalRequiredMinutes - availableWorkingMinutes
      : 0;

    // Detect postponable candidates (only non-emergency and non-urgent visits)
    const postponableCandidates: PostponableCandidate[] = [];
    if (isOverCapacity) {
      for (const s of stops) {
        const v = s.visit!;
        if (v.priority === 'EMERGENCY' || v.priority === 'URGENT') {
          continue; // Never recommend postponement of emergency or urgent visits!
        }

        const procCategory = v.cases?.[0]?.procedureCategory || 'Routine Checkup';

        let candReason = '';
        if (v.flexibility === 'CAN_POSTPONE_TODAY') {
          candReason = `Marked flexible by owner; suitable for postponement (${procCategory})`;
        } else if (v.flexibility === 'PREFERRED_TODAY') {
          candReason = `Routine preference; non-urgent procedure (${procCategory})`;
        } else {
          candReason = `Planned routine visit; non-urgent candidate (${procCategory})`;
        }

        const savedMins =
          (s.transitMinutesFromPrevious || defaultTransit) +
          this.estimateVisitDuration(v, s.durationMinutesOverride, config.durationEstimates);

        postponableCandidates.push({
          visit: v,
          reason: candReason,
          savedMinutes: savedMins,
          procedureCategory: procCategory,
        });
      }
    }

    return {
      stops,
      totalEstimatedKm: Math.round(totalKm * 10) / 10,
      totalEstimatedTravelMinutes: totalTravelMins,
      totalEstimatedVisitMinutes: totalVisitMins,
      workingMinutesAvailable: availableWorkingMinutes,
      breakMinutes,
      bufferMinutes,
      totalRequiredMinutes,
      remainingMinutes,
      isOverCapacity,
      overCapacityMinutes,
      hasMissingCoordinates,
      postponableCandidates,
    };
  }

  // ── 5. Recalculate Timeline for Adjusted Stops ───────────────────
  // Called when doctor manually reorders, locks/unlocks, or overrides durations
  static recalculateTimeline(
    stops: RouteStop[],
    config: RouteEngineConfig = {}
  ): RouteCalculationResult {
    const workingHours = config.workingMinutesAvailable ?? 480;
    const breakMinutes = config.breakMinutes ?? 45;
    const bufferMinutes = config.bufferMinutes ?? 30;
    const avgSpeed = config.averageSpeedKmH ?? 35;
    const defaultTransit = config.defaultTransitMinutes ?? 20;
    const defaultKm = config.defaultTransitKm ?? 10;
    const startTimeStr = config.startTime || '08:30';

    const availableWorkingMinutes = Math.max(0, workingHours - breakMinutes);

    const [startHourStr, startMinStr] = startTimeStr.split(':');
    const startHour = parseInt(startHourStr || '8', 10);
    const startMin = parseInt(startMinStr || '30', 10);

    const baseDate = new Date();
    baseDate.setHours(startHour, startMin, 0, 0);
    let currentTime = new Date(baseDate);

    let prevLat = config.startLatitude;
    let prevLon = config.startLongitude;

    let totalKm = 0;
    let totalTravelMins = 0;
    let totalVisitMins = 0;
    let hasMissingCoordinates = false;

    const updatedStops: RouteStop[] = [];

    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const v = s.visit;
      if (!v) continue;

      const duration = this.estimateVisitDuration(v, s.durationMinutesOverride, config.durationEstimates);
      totalVisitMins += duration;

      const dist = this.calculateDistanceKm(prevLat, prevLon, v.latitude, v.longitude);
      let transit = 0;
      let legKm = 0;
      let isApprox = false;

      if (dist != null) {
        legKm = dist;
        transit = this.estimateTransitMinutes(dist, avgSpeed, defaultTransit);
      } else {
        legKm = defaultKm;
        transit = defaultTransit;
        isApprox = true;
        hasMissingCoordinates = true;
      }

      totalKm += legKm;
      totalTravelMins += transit;

      currentTime = new Date(currentTime.getTime() + transit * 60000);
      const estimatedArrival = new Date(currentTime);

      currentTime = new Date(currentTime.getTime() + duration * 60000);
      const estimatedDeparture = new Date(currentTime);

      if (v.latitude != null && v.longitude != null) {
        prevLat = v.latitude;
        prevLon = v.longitude;
      }

      updatedStops.push({
        ...s,
        stopOrder: i + 1,
        estimatedArrival,
        estimatedDeparture,
        transitMinutesFromPrevious: transit,
        distanceKmFromPrevious: legKm,
        isApproximateLocation: isApprox,
      });
    }

    const totalRequiredMinutes = totalTravelMins + totalVisitMins + bufferMinutes;
    const remainingMinutes = Math.max(0, availableWorkingMinutes - totalRequiredMinutes);
    const isOverCapacity = totalRequiredMinutes > availableWorkingMinutes;
    const overCapacityMinutes = isOverCapacity
      ? totalRequiredMinutes - availableWorkingMinutes
      : 0;

    const postponableCandidates: PostponableCandidate[] = [];
    if (isOverCapacity) {
      for (const s of updatedStops) {
        const v = s.visit!;
        if (v.priority === 'EMERGENCY' || v.priority === 'URGENT') continue;

        const isExplicitlyPostponable =
          v.flexibility === 'CAN_POSTPONE_TODAY' || v.flexibility === 'PREFERRED_TODAY';
        const procCategory = v.cases?.[0]?.procedureCategory || 'Routine Checkup';

        const savedMins =
          (s.transitMinutesFromPrevious || defaultTransit) +
          this.estimateVisitDuration(v, s.durationMinutesOverride);

        postponableCandidates.push({
          visit: v,
          reason: isExplicitlyPostponable
            ? `Flexible planned procedure (${procCategory})`
            : `Planned routine visit (${procCategory})`,
          savedMinutes: savedMins,
          procedureCategory: procCategory,
        });
      }
    }

    return {
      stops: updatedStops,
      totalEstimatedKm: Math.round(totalKm * 10) / 10,
      totalEstimatedTravelMinutes: totalTravelMins,
      totalEstimatedVisitMinutes: totalVisitMins,
      workingMinutesAvailable: availableWorkingMinutes,
      breakMinutes,
      bufferMinutes,
      totalRequiredMinutes,
      remainingMinutes,
      isOverCapacity,
      overCapacityMinutes,
      hasMissingCoordinates,
      postponableCandidates,
    };
  }

  // ── 6. Emergency Route Recalculator (CVP-49) ──────────────────────
  // When a new emergency is registered while a daily plan is confirmed/active,
  // evaluate revised route proposal without automatically mutating confirmed plan.
  static evaluateEmergencyInsertion(
    emergencyCall: Call,
    currentStops: RouteStop[],
    config: RouteEngineConfig = {}
  ): EmergencyProposal {
    // Construct a synthetic Visit for the emergency call
    const emergencyVisit: Visit = {
      id: `emergency-visit-${emergencyCall.id || Date.now()}`,
      callId: emergencyCall.id,
      ownerId: emergencyCall.ownerId || 'temp-owner',
      ownerName: emergencyCall.ownerName || emergencyCall.tempOwnerName || 'Emergency Caller',
      ownerPhone: emergencyCall.callerPhone,
      address: emergencyCall.locationAddress || 'Emergency Location',
      latitude: emergencyCall.latitude,
      longitude: emergencyCall.longitude,
      status: 'PLANNED',
      priority: 'EMERGENCY',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 45,
      createdAt: new Date(),
      cases: [
        {
          chiefComplaint: emergencyCall.symptoms,
          procedureCategory: 'EMERGENCY_TREATMENT',
          species: emergencyCall.species || 'Bovine',
        },
      ],
    };

    // Emergency is inserted at earliest priority: Stop #1 (or after any locked emergency stop)
    let insertIndex = 0;
    for (let i = 0; i < currentStops.length; i++) {
      const s = currentStops[i];
      if (s.isLocked && s.visit?.priority === 'EMERGENCY') {
        insertIndex = i + 1;
      }
    }

    const proposedNewStops: RouteStop[] = [
      ...currentStops.slice(0, insertIndex),
      {
        id: `stop-emergency-${emergencyCall.id}`,
        visitId: emergencyVisit.id!,
        stopOrder: insertIndex + 1,
        visit: emergencyVisit,
        isLocked: false,
        suggestedReason: 'New Emergency Call: Inserted ahead of routine stops',
      },
      ...currentStops.slice(insertIndex),
    ];

    // Re-index stopOrder
    proposedNewStops.forEach((s, idx) => {
      s.stopOrder = idx + 1;
    });

    // Calculate timelines for both
    const currentMetrics = this.recalculateTimeline(currentStops, config);
    const proposedMetrics = this.recalculateTimeline(proposedNewStops, config);

    const affectedStopsCount = currentStops.length - insertIndex;
    const travelDelta =
      proposedMetrics.totalEstimatedTravelMinutes - currentMetrics.totalEstimatedTravelMinutes;
    const visitDelta =
      proposedMetrics.totalEstimatedVisitMinutes - currentMetrics.totalEstimatedVisitMinutes;

    return {
      emergencyCall,
      emergencyVisit,
      currentStops: currentMetrics.stops,
      proposedStops: proposedMetrics.stops,
      insertedAtOrder: insertIndex + 1,
      affectedStopsCount,
      travelMinutesDelta: Math.max(0, travelDelta),
      visitMinutesDelta: visitDelta,
      newRequiredMinutes: proposedMetrics.totalRequiredMinutes,
      newOverCapacity: proposedMetrics.isOverCapacity,
      newOverCapacityMinutes: proposedMetrics.overCapacityMinutes,
      suggestedPostponements: proposedMetrics.postponableCandidates,
      explanation: `Emergency inserted at Stop #${insertIndex + 1}. Shifts ${affectedStopsCount} subsequent stops by ~${visitDelta + travelDelta} minutes. ${
        proposedMetrics.isOverCapacity
          ? `Plan exceeds daily capacity by ${proposedMetrics.overCapacityMinutes} mins. Review postponable candidates below.`
          : 'Fits within remaining daily capacity.'
      }`,
    };
  }

  // ── 7. WhatsApp Handoff Message Formatter (CVP-18) ─────────────────
  static generateWhatsAppMessage(params: {
    ownerName?: string;
    patientName?: string;
    locationAddress?: string;
    newScheduledDate: string | Date;
    reason?: string;
    doctorName?: string;
    practiceName?: string;
  }): { text: string; encodedUrl: string } {
    const owner = params.ownerName || 'Valued Client';
    const patient = params.patientName ? `for ${params.patientName}` : '';
    const loc = params.locationAddress ? ` at ${params.locationAddress}` : '';
    const doctor = params.doctorName || 'Dr. Anand Sharma';
    const practice = params.practiceName || 'VetRx Practice';

    let dateDisplay = '';
    if (typeof params.newScheduledDate === 'string') {
      dateDisplay = params.newScheduledDate.split('T')[0];
    } else {
      dateDisplay = params.newScheduledDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }

    const text =
      `Dear ${owner},\n\n` +
      `This is ${doctor} (${practice}). Regarding our veterinary visit ${patient}${loc}, ` +
      `due to critical field emergencies and route capacity, our visit is rescheduled to:\n\n` +
      `📅 *${dateDisplay}*\n\n` +
      `Reason: ${params.reason || 'Rescheduled for optimal care'}\n\n` +
      `If your animal's condition worsens or requires urgent emergency attention, please call back immediately.\n\n` +
      `Thank you for your understanding.`;

    const encoded = encodeURIComponent(text);

    return {
      text,
      encodedUrl: `https://wa.me/?text=${encoded}`,
    };
  }
}
