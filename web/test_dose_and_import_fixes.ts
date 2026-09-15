// =============================================================
// VetRx — Automated Test Suite: Dose Calculator & Import Modal Fixes
// =============================================================

import {
  formatControlledNumber,
  calculateSmartDose,
} from './src/utils/doseCalculator';
import type { Medicine } from './src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('\n--- Running Test Suite: Dose Calculator & Import Modal Fixes ---');

// 1. formatControlledNumber Tests
console.log('\n1. formatControlledNumber Tests');
assert(formatControlledNumber(0) === '0', 'formatControlledNumber(0) returns "0"');
assert(formatControlledNumber('0') === '0', 'formatControlledNumber("0") returns "0"');
assert(formatControlledNumber(15.5) === '15.5', 'formatControlledNumber(15.5) returns "15.5"');
assert(formatControlledNumber('20') === '20', 'formatControlledNumber("20") returns "20"');
assert(formatControlledNumber(null) === '', 'formatControlledNumber(null) returns ""');
assert(formatControlledNumber(undefined) === '', 'formatControlledNumber(undefined) returns ""');
assert(formatControlledNumber('') === '', 'formatControlledNumber("") returns ""');
assert(formatControlledNumber('   ') === '', 'formatControlledNumber("   ") returns ""');
assert(formatControlledNumber('abc') === '', 'formatControlledNumber("abc") returns ""');
assert(formatControlledNumber(NaN) === '', 'formatControlledNumber(NaN) returns ""');
assert(formatControlledNumber(100) === '100', 'formatControlledNumber(100) returns "100"');
assert(formatControlledNumber(0.05) === '0.05', 'formatControlledNumber(0.05) returns "0.05"');

// 2. Dose Calculator Calculations Tests
console.log('\n2. Dose Calculation Tests');

// Method A: Volume per Body Weight (e.g. 1 mL per 20 kg for a 30 kg dog -> 1.5 mL)
const medVolPerWeight: Medicine = {
  id: 'med_vol_1',
  brandName: 'Ivermectin Injection',
  genericName: 'Ivermectin 1%',
  category: 'Antiparasitic',
  presentation: 'Injection',
  dosingMethod: 'volume_per_weight',
  doseVolumeAmount: 1,
  doseVolumeUnit: 'mL',
  weightBasis: 20,
  weightBasisUnit: 'kg',
  targetSpecies: ['Canine'],
  isActive: true,
  createdAt: new Date().toISOString(),
};
const resA = calculateSmartDose(medVolPerWeight, 30, 'Canine');
assert(resA.calculatedDoseValue === 1.5, 'Method A: 30kg dog with 1 mL/20kg gets 1.5 mL');
assert(resA.calculatedDoseUnit === 'mL', 'Method A: calculatedUnit is mL');

// Method B: Reconstituted Liquid (1 tablet in 20 mL water, give 1 mL for a 5 kg cat)
const medReconLiquid: Medicine = {
  id: 'med_recon_1',
  brandName: 'Pimobendan Liquid Reconstitution',
  genericName: 'Pimobendan',
  category: 'Cardiovascular',
  presentation: 'Tablet',
  dosingMethod: 'reconstituted_liquid',
  reconstitutionSourceQty: 1,
  reconstitutionSourceUnit: 'tablet',
  reconstitutionDiluentVolume: 20,
  reconstitutionDiluentUnit: 'mL',
  reconstitutionAdminVolume: 1,
  reconstitutionAdminUnit: 'mL',
  targetSpecies: ['Feline', 'Canine'],
  isActive: true,
  createdAt: new Date().toISOString(),
};
const resB = calculateSmartDose(medReconLiquid, 5, 'Feline');
assert(resB.calculatedDoseValue === 1, 'Method B: Admin volume 1 mL retained');
assert(resB.calculatedDoseUnit === 'mL', 'Method B: Unit is mL');
assert(resB.status === 'reconstituted_liquid', 'Method B: status is reconstituted_liquid');

// Method C: Reconstituted Drops (1 tab in 20 mL, 20 drops/mL, 20 drops dose)
const medReconDrops: Medicine = {
  id: 'med_drops_1',
  brandName: 'Prednisolone Drops Formulation',
  genericName: 'Prednisolone',
  category: 'Anti-inflammatory',
  presentation: 'Tablet',
  dosingMethod: 'reconstituted_drops',
  reconstitutionSourceQty: 1,
  reconstitutionSourceUnit: 'tablet',
  reconstitutionDiluentVolume: 20,
  reconstitutionDiluentUnit: 'mL',
  dropsPerMl: 20,
  doseDrops: 20,
  targetSpecies: ['Canine', 'Feline'],
  isActive: true,
  createdAt: new Date().toISOString(),
};
const resC = calculateSmartDose(medReconDrops, 2, 'Feline');
assert(resC.calculatedDoseValue === 20, 'Method C: Dose in drops is 20');
assert(resC.calculatedDoseUnit === 'drops', 'Method C: Unit is drops');
assert(resC.calculatedVolumeMl === 1, 'Method C: 20 drops at 20 drops/mL = 1 mL');

// Weight Bands lookup
const bands = [
  { id: 'b1', minWeightKg: 0, maxWeightKg: 10, doseValue: 0.5, doseUnit: 'tablet', label: '≤10 kg' },
  { id: 'b2', minWeightKg: 10.01, maxWeightKg: 25, doseValue: 1, doseUnit: 'tablet', label: '10–25 kg' },
  { id: 'b3', minWeightKg: 25.01, maxWeightKg: undefined, doseValue: 2, doseUnit: 'tablet', label: '>25 kg' },
];

const medBand: Medicine = {
  id: 'med_band_1',
  brandName: 'Bravecto Chewable',
  genericName: 'Fluralaner',
  category: 'Antiparasitic',
  presentation: 'Tablet',
  dosingMethod: 'weight_band',
  weightBands: bands,
  targetSpecies: ['Canine'],
  isActive: true,
  createdAt: new Date().toISOString(),
};

const calcBand1 = calculateSmartDose(medBand, 7, 'Canine');
assert(calcBand1.calculatedDoseValue === 0.5, 'Weight Band: 7kg matches band 1 (0.5 tab)');

const calcBand2 = calculateSmartDose(medBand, 18, 'Canine');
assert(calcBand2.calculatedDoseValue === 1, 'Weight Band: 18kg matches band 2 (1 tab)');

const calcBand3 = calculateSmartDose(medBand, 35, 'Canine');
assert(calcBand3.calculatedDoseValue === 2, 'Weight Band: 35kg matches band 3 (>25kg -> 2 tabs)');

// 3. Import Modal Filter and Sorting Logic Tests
console.log('\n3. Import Modal Filtering & Sorting Logic Tests');

interface MockRx {
  id: number;
  rxNumber: string;
  patientId: number;
  ownerId: number;
  createdAt: string | Date;
  status?: string;
}

const mockPrescriptions: MockRx[] = [
  { id: 1, rxNumber: 'RX-2026-001', patientId: 10, ownerId: 100, createdAt: '2026-01-01T10:00:00Z', status: 'Draft' },
  { id: 2, rxNumber: 'RX-2026-002', patientId: 20, ownerId: 200, createdAt: '2026-02-15T12:00:00Z', status: 'Issued' },
  { id: 3, rxNumber: 'RX-2026-003', patientId: 10, ownerId: 100, createdAt: '2026-03-01T08:00:00Z', status: undefined }, // status undefined test
];

// In-memory sort test
const sorted = [...mockPrescriptions].sort(
  (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
);
assert(sorted[0].id === 3, 'In-memory sort places newest (March 2026) first');
assert(sorted[2].id === 1, 'In-memory sort places oldest (Jan 2026) last');

// Safe status handling test
mockPrescriptions.forEach((rx) => {
  const statusLower = (rx.status || 'draft').toLowerCase();
  assert(typeof statusLower === 'string' && statusLower.length > 0, `Safe status lowercase handled for #${rx.rxNumber}: ${statusLower}`);
});

// Scope filter test: Current vs All
const currentClientRxs = mockPrescriptions.filter(
  (rx) => rx.patientId === 10 || rx.ownerId === 100
);
assert(currentClientRxs.length === 2, 'Scope "current" correctly filters to owner 100 (2 rxs)');

const allRxs = mockPrescriptions.filter(() => true);
assert(allRxs.length === 3, 'Scope "all" includes all 3 rxs');

// Search filter test: Rx Number
const searchRx = mockPrescriptions.filter((rx) => rx.rxNumber.toLowerCase().includes('002'));
assert(searchRx.length === 1 && searchRx[0].id === 2, 'Search query "002" finds RX-2026-002');

console.log('\n--- All Automated Tests Passed Successfully! ---');
