// ==============================================================================
// VetRx — Unit Conversion & Fractional Stock Management Service
// Authoritative engine for base units, pack size conversions, and container tracking
// ==============================================================================

export interface PackSizeParsed {
  containerCapacity: number; // e.g. 100
  containerUnit: string;     // e.g. "mL" or "tablet"
  packageType: string;       // e.g. "bottle", "vial", "strip", "box"
  raw: string;
}

export interface ContainerBreakdown {
  totalBaseQuantity: number;
  baseUnit: string;
  containerCapacity: number;
  packageType: string;
  packageEquivalents: number; // e.g. 3.75 (never rounded to 3 or 4)
  unopenedContainers: number; // e.g. 3
  openedContainers: number;   // e.g. 1 (if residual > 0)
  residualQuantityInOpened: number; // e.g. 75
  displayText: string;        // e.g. "375 mL remaining (3.75 × 100 mL bottles)"
}

export interface UnitConversionResult {
  baseQuantity: number;
  baseUnit: string;
  conversionFactor: number; // how many base units per requested unit
  isDivisible: boolean;
  packSizeInfo?: PackSizeParsed;
}

export class UnitConversionService {
  /**
   * Known base unit normalizations
   */
  private static readonly UNIT_ALIASES: Record<string, string> = {
    ml: 'mL',
    'm.l.': 'mL',
    milliliter: 'mL',
    millilitre: 'mL',
    milliliters: 'mL',
    millilitres: 'mL',
    l: 'L',
    liter: 'L',
    litre: 'L',
    liters: 'L',
    litres: 'L',
    mg: 'mg',
    milligram: 'mg',
    milligrams: 'mg',
    g: 'g',
    gm: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    tab: 'tablet',
    tabs: 'tablet',
    tablet: 'tablet',
    tablets: 'tablet',
    cap: 'capsule',
    caps: 'capsule',
    capsule: 'capsule',
    capsules: 'capsule',
    bolus: 'bolus',
    boluses: 'bolus',
    vial: 'vial',
    vials: 'vial',
    amp: 'ampoule',
    ampoule: 'ampoule',
    ampoules: 'ampoule',
    bottle: 'bottle',
    bottles: 'bottle',
    strip: 'strip',
    strips: 'strip',
    box: 'box',
    boxes: 'box',
    unit: 'Unit',
    units: 'Unit',
    dose: 'dose',
    doses: 'dose',
  };

  /**
   * Normalizes unit strings (case, plurals, abbreviations)
   */
  public static normalizeUnit(rawUnit?: string | null): string {
    if (!rawUnit || !rawUnit.trim()) return 'Unit';
    const clean = rawUnit.trim().toLowerCase();
    return this.UNIT_ALIASES[clean] || rawUnit.trim();
  }

  /**
   * Parses product pack size configuration strings.
   * Examples:
   *   "100 ml" -> { containerCapacity: 100, containerUnit: "mL", packageType: "bottle" }
   *   "100 mL bottle" -> { containerCapacity: 100, containerUnit: "mL", packageType: "bottle" }
   *   "10 x 10 tablets" -> { containerCapacity: 100, containerUnit: "tablet", packageType: "box" }
   *   "10 tablets/strip" -> { containerCapacity: 10, containerUnit: "tablet", packageType: "strip" }
   *   "500 mL vial" -> { containerCapacity: 500, containerUnit: "mL", packageType: "vial" }
   *   "50 ml" -> { containerCapacity: 50, containerUnit: "mL", packageType: "bottle" }
   */
  public static parsePackSize(packSizeStr?: string | null, stockUnit?: string | null): PackSizeParsed | null {
    if (!packSizeStr || !packSizeStr.trim()) {
      return null;
    }

    const s = packSizeStr.trim();

    // 1. "10 x 10 tablets" or "10 x 10"
    const multiMatch = s.match(/^(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
    if (multiMatch) {
      const count1 = parseFloat(multiMatch[1]);
      const count2 = parseFloat(multiMatch[2]);
      const total = Math.round(count1 * count2 * 1000) / 1000;
      const rem = multiMatch[3]?.trim();
      const unit = rem ? this.normalizeUnit(rem) : this.normalizeUnit(stockUnit) || 'tablet';
      return {
        containerCapacity: total,
        containerUnit: unit,
        packageType: 'box',
        raw: s,
      };
    }

    // 2. "100 ml bottle", "500 mL", "100ml", "10 tablets/strip"
    const singleMatch = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)(?:\s*(?:per|\/|\*)\s*([a-zA-Z]+))?(?:\s+([a-zA-Z]+))?/);
    if (singleMatch) {
      const qty = parseFloat(singleMatch[1]);
      const unitPart = this.normalizeUnit(singleMatch[2]);
      let pkgType = 'package';

      if (unitPart === 'mL' || unitPart === 'L') {
        pkgType = 'bottle';
      } else if (unitPart === 'tablet' || unitPart === 'capsule') {
        pkgType = 'strip';
      }

      if (singleMatch[3]) {
        pkgType = singleMatch[3].toLowerCase();
      } else if (singleMatch[4]) {
        pkgType = singleMatch[4].toLowerCase();
      }

      return {
        containerCapacity: qty,
        containerUnit: unitPart,
        packageType: pkgType,
        raw: s,
      };
    }

    // 3. Fallback: just number
    const numMatch = s.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      const qty = parseFloat(numMatch[1]);
      return {
        containerCapacity: qty,
        containerUnit: this.normalizeUnit(stockUnit) || 'Unit',
        packageType: 'package',
        raw: s,
      };
    }

    return null;
  }

  /**
   * Converts a given quantity and unit into the item's configured base unit.
   * Prevents unsafe conversions across incompatible dimensions.
   */
  public static convertToBaseUnit(
    requestedQuantity: number,
    requestedUnit: string | null | undefined,
    item: {
      stockUnit: string;
      packSize?: string | null;
      presentation?: string | null;
    }
  ): UnitConversionResult {
    const baseUnit = this.normalizeUnit(item.stockUnit);
    const reqUnit = requestedUnit ? this.normalizeUnit(requestedUnit) : baseUnit;
    const packParsed = this.parsePackSize(item.packSize, item.stockUnit);

    const safeReqQty = Number(requestedQuantity);
    if (isNaN(safeReqQty) || safeReqQty <= 0) {
      throw new Error(`Invalid requested quantity: ${requestedQuantity}`);
    }

    // Case 1: Units match exactly
    if (reqUnit.toLowerCase() === baseUnit.toLowerCase()) {
      return {
        baseQuantity: safeReqQty,
        baseUnit,
        conversionFactor: 1,
        isDivisible: true,
        packSizeInfo: packParsed || undefined,
      };
    }

    // Case 2: Liquid conversion (L to mL)
    if (baseUnit === 'mL' && reqUnit === 'L') {
      return {
        baseQuantity: safeReqQty * 1000,
        baseUnit: 'mL',
        conversionFactor: 1000,
        isDivisible: true,
        packSizeInfo: packParsed || undefined,
      };
    }
    if (baseUnit === 'L' && reqUnit === 'mL') {
      return {
        baseQuantity: safeReqQty / 1000,
        baseUnit: 'L',
        conversionFactor: 0.001,
        isDivisible: true,
        packSizeInfo: packParsed || undefined,
      };
    }

    // Case 3: Weight conversion (g to mg, kg to g)
    if (baseUnit === 'mg' && reqUnit === 'g') {
      return {
        baseQuantity: safeReqQty * 1000,
        baseUnit: 'mg',
        conversionFactor: 1000,
        isDivisible: true,
        packSizeInfo: packParsed || undefined,
      };
    }
    if (baseUnit === 'g' && reqUnit === 'mg') {
      return {
        baseQuantity: safeReqQty / 1000,
        baseUnit: 'g',
        conversionFactor: 0.001,
        isDivisible: true,
        packSizeInfo: packParsed || undefined,
      };
    }

    // Case 4: Package-level dispensing (e.g. 2 bottles of a 100 mL liquid product)
    if (packParsed && packParsed.containerCapacity > 0) {
      const isPkgMatch =
        reqUnit.toLowerCase() === packParsed.packageType.toLowerCase() ||
        (packParsed.packageType === 'bottle' && (reqUnit === 'bottle' || reqUnit === 'vial')) ||
        (packParsed.packageType === 'strip' && (reqUnit === 'strip' || reqUnit === 'box'));

      if (isPkgMatch && packParsed.containerUnit.toLowerCase() === baseUnit.toLowerCase()) {
        const factor = packParsed.containerCapacity;
        return {
          baseQuantity: safeReqQty * factor,
          baseUnit,
          conversionFactor: factor,
          isDivisible: true,
          packSizeInfo: packParsed,
        };
      }
    }

    // If no valid conversion configured, do NOT guess or infer!
    throw new Error(
      `Incompatible or unconfigured unit conversion: cannot convert ${reqUnit} to item base unit ${baseUnit}. ` +
      `Item pack size is '${item.packSize || 'none'}'. Please configure explicit unit conversion.`
    );
  }

  /**
   * Computes container equivalent and opened-container breakdown.
   * e.g. 375 mL of a 100 mL/bottle product ->
   *   packageEquivalents: 3.75
   *   unopenedContainers: 3
   *   openedContainers: 1
   *   residualQuantityInOpened: 75
   *   displayText: "375 mL remaining (3.75 × 100 mL bottles)"
   */
  public static calculateContainerBreakdown(
    totalBaseQuantity: number,
    stockUnit: string,
    packSizeStr?: string | null
  ): ContainerBreakdown {
    const baseUnit = this.normalizeUnit(stockUnit);
    const parsed = this.parsePackSize(packSizeStr, stockUnit);
    const safeTotal = Math.max(0, Number(totalBaseQuantity) || 0);

    if (!parsed || parsed.containerCapacity <= 0) {
      return {
        totalBaseQuantity: safeTotal,
        baseUnit,
        containerCapacity: 1,
        packageType: 'unit',
        packageEquivalents: safeTotal,
        unopenedContainers: Math.floor(safeTotal),
        openedContainers: safeTotal % 1 > 0 ? 1 : 0,
        residualQuantityInOpened: Number((safeTotal % 1).toFixed(4)),
        displayText: `${safeTotal} ${baseUnit}`,
      };
    }

    const cap = parsed.containerCapacity;
    // Keep exact float precision without unwanted rounding
    const rawEquivalents = safeTotal / cap;
    const packageEquivalents = Math.round(rawEquivalents * 10000) / 10000;
    const unopenedContainers = Math.floor(safeTotal / cap);
    const residual = Math.round((safeTotal % cap) * 10000) / 10000;
    const openedContainers = residual > 0 ? 1 : 0;

    const pkgLabel = parsed.packageType.toLowerCase() === 'bottle' ? 'bottles' : `${parsed.packageType}s`;
    let displayText = `${safeTotal} ${baseUnit}`;

    if (packageEquivalents !== safeTotal) {
      displayText = `${safeTotal} ${baseUnit} remaining (${packageEquivalents} × ${cap} ${baseUnit} ${pkgLabel})`;
    }

    return {
      totalBaseQuantity: safeTotal,
      baseUnit,
      containerCapacity: cap,
      packageType: parsed.packageType,
      packageEquivalents,
      unopenedContainers,
      openedContainers,
      residualQuantityInOpened: residual,
      displayText,
    };
  }
}
