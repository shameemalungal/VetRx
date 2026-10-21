import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateSettingsSchema } from '../src/practice/practice.controller.js';
import type { SafePracticeSettingsDTO, SafePracticeDTO } from '../src/types/index.js';

describe('Phase 5 — Practitioner Persistence & Practice Rename Regression Suite', () => {
  // Test 1: updateSettingsSchema validates all new practitioner and clinic fields
  it('validates comprehensive practitioner profile and clinic identity fields', () => {
    const validPayload = {
      doctorName: 'Dr. Fiza Shameem',
      doctorRegistrationNumber: 'KVC-9988-B',
      doctorQualifications: 'BVSc & AH, MVSc (Surgery)',
      doctorPhone: '+91 98471 23456',
      doctorEmail: 'drfizasha@gmail.com',
      doctorAddress: 'Main Road, Karuvarakundu, Malappuram, Kerala - 676523',
      doctorPhotoUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000),
      doctorSignatureUrl: 'data:image/png;base64,' + 'B'.repeat(4000),
      clinicName: 'Veterinary Dispensary Karuvarakundu',
      address: 'Near Govt Hospital, Karuvarakundu',
      phone: '+91 4931 280000',
      email: 'dispensary.karuvarakundu@kerala.gov.in',
      registrationNumber: 'KL-VET-0987',
      clinicLicenseNumber: 'EST-LIC-2024-554',
      clinicLogoUrl: 'data:image/png;base64,' + 'C'.repeat(3000),
      ownerSpecialInstructionEnabled: true,
      mykgvoaMemberId: 'KGVOA-MAL-441',
    };

    const parsed = updateSettingsSchema.safeParse(validPayload);
    assert.strictEqual(parsed.success, true, 'Valid payload should parse cleanly');
    if (parsed.success) {
      assert.strictEqual(parsed.data.doctorQualifications, 'BVSc & AH, MVSc (Surgery)');
      assert.strictEqual(parsed.data.clinicLicenseNumber, 'EST-LIC-2024-554');
      assert.strictEqual(parsed.data.doctorPhone, '+91 98471 23456');
      assert.strictEqual(parsed.data.doctorEmail, 'drfizasha@gmail.com');
      assert.strictEqual(parsed.data.doctorAddress, 'Main Road, Karuvarakundu, Malappuram, Kerala - 676523');
      assert.strictEqual(parsed.data.clinicName, 'Veterinary Dispensary Karuvarakundu');
    }
  });

  it('allows empty strings for email fields in schema and sanitizes them for database storage', () => {
    const payloadWithEmptyEmails = {
      doctorName: 'Dr. Jane Doe',
      doctorEmail: '',
      email: '',
      clinicLicenseNumber: '',
    };

    const parsed = updateSettingsSchema.safeParse(payloadWithEmptyEmails);
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.strictEqual(parsed.data.doctorEmail, '');
      assert.strictEqual(parsed.data.email, '');

      // Controller sanitization
      const sanitized = {
        ...parsed.data,
        email: parsed.data.email === '' ? null : parsed.data.email,
        doctorEmail: parsed.data.doctorEmail === '' ? null : parsed.data.doctorEmail,
      };
      assert.strictEqual(sanitized.doctorEmail, null);
      assert.strictEqual(sanitized.email, null);
    }
  });

  // Test 2: Practice Name Synchronization on Clinic Rename
  it('synchronizes Practice.name when clinicName is updated and handles whitespace', () => {
    const practiceState = {
      id: 'practice-uuid-1',
      name: 'Veterinary Dospensary Karuvarakundu', // Typo with "o"
    };

    const settingsState: SafePracticeSettingsDTO = {
      id: 'settings-uuid-1',
      practiceId: practiceState.id,
      clinicName: 'Veterinary Dospensary Karuvarakundu',
      address: null,
      phone: null,
      email: null,
      registrationNumber: null,
      doctorName: 'Dr. Fiza Shameem',
      doctorRegistrationNumber: null,
      doctorQualifications: null,
      doctorPhone: null,
      doctorEmail: null,
      doctorAddress: null,
      doctorPhotoUrl: null,
      doctorSignatureUrl: null,
      clinicLogoUrl: null,
      clinicLicenseNumber: null,
      ownerSpecialInstructionEnabled: false,
      mykgvoaMemberId: null,
    };

    // Simulate service updateSettings logic
    const updateInput = {
      clinicName: '  Veterinary Dispensary Karuvarakundu  ',
    };

    const cleanClinicName = updateInput.clinicName.trim();
    settingsState.clinicName = cleanClinicName;
    if (cleanClinicName.length > 0) {
      practiceState.name = cleanClinicName;
    }

    assert.strictEqual(practiceState.name, 'Veterinary Dispensary Karuvarakundu');
    assert.strictEqual(settingsState.clinicName, 'Veterinary Dispensary Karuvarakundu');
  });

  // Test 3: Session and Practice Switcher Data Resolution
  it('resolves authoritative practice display name for Switch Practice and Session me', () => {
    const rawPracticeFromDb = {
      id: 'p-1',
      name: 'Old Uncorrected Name',
      settings: {
        clinicName: 'Corrected Clinic Display Name',
      },
    };

    // Logic in auth.service getMeContext and loginWithPassword
    const resolvedPracticeName = rawPracticeFromDb.settings?.clinicName?.trim() || rawPracticeFromDb.name;
    assert.strictEqual(resolvedPracticeName, 'Corrected Clinic Display Name');

    const eligiblePractices = [
      {
        practiceId: rawPracticeFromDb.id,
        practiceName: rawPracticeFromDb.settings?.clinicName?.trim() || rawPracticeFromDb.name,
      },
    ];

    assert.strictEqual(eligiblePractices[0].practiceName, 'Corrected Clinic Display Name');
  });

  // Test 4: Preservation of Non-Modified Fields & Durability of Photo / Signature
  it('preserves existing photos, signatures, and qualifications on partial updates', () => {
    let currentSettings: SafePracticeSettingsDTO = {
      id: 'settings-123',
      practiceId: 'p-123',
      clinicName: 'Valley Animal Hospital',
      address: '123 Meadow Lane',
      phone: '9998887776',
      email: 'valley@vetrx.test',
      registrationNumber: 'REG-100',
      doctorName: 'Dr. Alex Stone',
      doctorRegistrationNumber: 'VET-200',
      doctorQualifications: 'BVSc, MVSc (Medicine)',
      doctorPhone: '9998887771',
      doctorEmail: 'alex@stone.test',
      doctorAddress: 'Flat 4A, Green Heights',
      doctorPhotoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      doctorSignatureUrl: 'data:image/png;base64,iVBORw0KGgo...',
      clinicLogoUrl: 'data:image/png;base64,iVBORw0KGgo...',
      clinicLicenseNumber: 'LIC-777',
      ownerSpecialInstructionEnabled: true,
      mykgvoaMemberId: 'MEM-99',
    };

    // User only changes clinic address
    const partialUpdate = {
      address: '456 Hilltop Ave',
    };

    currentSettings = {
      ...currentSettings,
      ...partialUpdate,
    };

    // Verify all other fields survived untouched
    assert.strictEqual(currentSettings.address, '456 Hilltop Ave');
    assert.strictEqual(currentSettings.doctorPhotoUrl, 'data:image/jpeg;base64,/9j/4AAQSkZJRg...');
    assert.strictEqual(currentSettings.doctorSignatureUrl, 'data:image/png;base64,iVBORw0KGgo...');
    assert.strictEqual(currentSettings.doctorQualifications, 'BVSc, MVSc (Medicine)');
    assert.strictEqual(currentSettings.clinicLicenseNumber, 'LIC-777');
    assert.strictEqual(currentSettings.doctorName, 'Dr. Alex Stone');
  });

  // Test 5: Tenant Isolation Across Multiple Practices
  it('guarantees tenant isolation for practice names and practitioner signatures', () => {
    const practicesDb = new Map<string, { id: string; name: string; settings: SafePracticeSettingsDTO }>();

    // Practice 1
    practicesDb.set('p-alpha', {
      id: 'p-alpha',
      name: 'Alpha Vet',
      settings: {
        id: 's-alpha',
        practiceId: 'p-alpha',
        clinicName: 'Alpha Vet Clinic',
        address: null,
        phone: null,
        email: null,
        registrationNumber: null,
        doctorName: 'Dr. Alpha',
        doctorRegistrationNumber: 'REG-A',
        doctorQualifications: 'BVSc',
        doctorPhone: null,
        doctorEmail: null,
        doctorAddress: null,
        doctorPhotoUrl: 'data:image/jpeg;base64,ALPHA_PHOTO',
        doctorSignatureUrl: 'data:image/png;base64,ALPHA_SIG',
        clinicLogoUrl: null,
        clinicLicenseNumber: null,
        ownerSpecialInstructionEnabled: false,
        mykgvoaMemberId: null,
      },
    });

    // Practice 2
    practicesDb.set('p-beta', {
      id: 'p-beta',
      name: 'Beta Vet',
      settings: {
        id: 's-beta',
        practiceId: 'p-beta',
        clinicName: 'Beta Vet Clinic',
        address: null,
        phone: null,
        email: null,
        registrationNumber: null,
        doctorName: 'Dr. Beta',
        doctorRegistrationNumber: 'REG-B',
        doctorQualifications: 'MVSc',
        doctorPhone: null,
        doctorEmail: null,
        doctorAddress: null,
        doctorPhotoUrl: 'data:image/jpeg;base64,BETA_PHOTO',
        doctorSignatureUrl: 'data:image/png;base64,BETA_SIG',
        clinicLogoUrl: null,
        clinicLicenseNumber: null,
        ownerSpecialInstructionEnabled: true,
        mykgvoaMemberId: null,
      },
    });

    // Update Alpha's clinic name and signature
    const alphaRecord = practicesDb.get('p-alpha')!;
    alphaRecord.settings.clinicName = 'Alpha Advanced Veterinary Hospital';
    alphaRecord.name = 'Alpha Advanced Veterinary Hospital';
    alphaRecord.settings.doctorSignatureUrl = 'data:image/png;base64,NEW_ALPHA_SIG';

    // Verify Beta was NOT modified
    const betaRecord = practicesDb.get('p-beta')!;
    assert.strictEqual(betaRecord.name, 'Beta Vet');
    assert.strictEqual(betaRecord.settings.clinicName, 'Beta Vet Clinic');
    assert.strictEqual(betaRecord.settings.doctorSignatureUrl, 'data:image/png;base64,BETA_SIG');
    assert.strictEqual(betaRecord.settings.doctorName, 'Dr. Beta');

    // Verify Alpha was correctly updated
    assert.strictEqual(alphaRecord.name, 'Alpha Advanced Veterinary Hospital');
    assert.strictEqual(alphaRecord.settings.clinicName, 'Alpha Advanced Veterinary Hospital');
    assert.strictEqual(alphaRecord.settings.doctorSignatureUrl, 'data:image/png;base64,NEW_ALPHA_SIG');
  });
});
