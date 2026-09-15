import type { Request } from 'express';

export type UserRole = 'PRACTICE_OWNER' | 'PRACTICE_ADMIN' | 'PRACTICE_STAFF';

export interface SafeUserDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface SafePracticeDTO {
  id: string;
  name: string;
  slug: string | null;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
}

export interface SafeMembershipDTO {
  id: string;
  practiceId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
}

export interface SafePracticeSettingsDTO {
  id: string;
  practiceId: string;
  clinicName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  registrationNumber: string | null;
  doctorName: string | null;
  doctorRegistrationNumber: string | null;
  doctorPhotoUrl: string | null;
  doctorSignatureUrl: string | null;
  clinicLogoUrl: string | null;
  ownerSpecialInstructionEnabled: boolean;
  mykgvoaMemberId: string | null;
}

export interface AuthMeResponse {
  user: SafeUserDTO;
  practice: SafePracticeDTO;
  membership: SafeMembershipDTO;
  settings: SafePracticeSettingsDTO | null;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface AuthenticatedRequest extends Request {
  id?: string;
  user?: SafeUserDTO;
  practice?: SafePracticeDTO;
  membership?: SafeMembershipDTO;
}

export interface AuthenticatedIdentity {
  provider: 'google' | 'password' | 'future_mykgvoa';
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export interface IdentityProvider {
  getAuthorizationUrl(state: string): string;
  handleCallback(code: string): Promise<AuthenticatedIdentity>;
}
