// ==============================================================================
// VetRx — ChoosePracticePage.tsx
// Stitch-consistent practice selection screen for multi-practice accounts.
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VetRxLogo } from '../../components/ui/VetRxLogo';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
  LogOut,
  AlertCircle,
  Stethoscope,
  Sparkles,
} from 'lucide-react';
import './Auth.css';

export const ChoosePracticePage: React.FC = () => {
  const { practices, practice: currentPractice, switchPractice, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const params = new URLSearchParams(location.search);
  const rawRedirect = params.get('redirect');
  const targetUrl =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && rawRedirect !== '/'
      ? rawRedirect
      : '/dashboard';

  const handleSelectPractice = async (practiceId: string) => {
    setErrorMessage(null);
    setSelectingId(practiceId);
    try {
      await switchPractice(practiceId);
      navigate(targetUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to switch to practice.');
    } finally {
      setSelectingId(null);
    }
  };

  const formatRoleName = (role: string) => {
    switch (role) {
      case 'PRACTICE_OWNER':
        return 'Practice Owner';
      case 'PRACTICE_ADMIN':
        return 'Practice Admin';
      case 'VETERINARIAN':
        return 'Veterinarian';
      case 'PRACTICE_STAFF':
      case 'STAFF':
        return 'Practice Staff';
      case 'READ_ONLY':
        return 'Auditor (Read-Only)';
      default:
        return role.replace(/_/g, ' ');
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'PRACTICE_OWNER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'VETERINARIAN':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'PRACTICE_ADMIN':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <VetRxLogo size={36} />
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900 block font-heading">VetRx</span>
            <span className="text-xs text-slate-500 font-medium">Multi-Practice Hub</span>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl w-full mx-auto my-auto py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-medium mb-3">
            <Sparkles size={14} className="text-teal-600" />
            <span>Welcome back, {user?.name || 'Doctor'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
            Choose Your Practice
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
            Your account is associated with multiple clinical workspaces. Select a practice to continue.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {practices.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
            <AlertCircle size={40} className="mx-auto text-amber-500 mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No Authorized Practice Found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              You do not currently have an active membership in any practice. Please ask your administrator for an invitation.
            </p>
            <button
              onClick={() => logout()}
              className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium hover:bg-slate-800"
            >
              Sign in with another account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {practices.map((p) => {
              const isCurrent = currentPractice?.id === p.practiceId;
              const isClinic = p.practiceType === 'CLINIC';
              const isLoadingThis = selectingId === p.practiceId;

              return (
                <div
                  key={p.practiceId}
                  onClick={() => !selectingId && handleSelectPractice(p.practiceId)}
                  className={`group relative bg-white border rounded-2xl p-5 sm:p-6 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                    isCurrent
                      ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/10'
                      : 'border-slate-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Practice Details */}
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isClinic
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isClinic ? <Building2 size={24} /> : <Stethoscope size={24} />}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors font-heading">
                            {p.practiceName}
                          </h3>

                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                              <CheckCircle2 size={12} />
                              <span>Current Active</span>
                            </span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                          {/* Type */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-medium border ${
                              isClinic
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isClinic ? 'Veterinary Clinic' : 'Individual Practice'}
                          </span>

                          {/* Role */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-medium border ${getRoleBadgeStyle(
                              p.role
                            )}`}
                          >
                            <ShieldCheck size={12} />
                            <span>{formatRoleName(p.role)}</span>
                          </span>

                          {/* Subscription info if available */}
                          {p.subscription && (
                            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                              <Clock size={12} className="text-slate-400" />
                              <span>
                                {p.subscription.status === 'TRIAL'
                                  ? 'Free Trial'
                                  : p.subscription.planName || 'Active Plan'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="sm:self-center shrink-0">
                      <button
                        type="button"
                        disabled={Boolean(selectingId)}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          isCurrent
                            ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                            : 'bg-slate-100 text-slate-700 group-hover:bg-teal-600 group-hover:text-white'
                        }`}
                      >
                        {isLoadingThis ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>{isCurrent ? 'Continue' : 'Switch & Open'}</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-4">
        VetRx Clinical Prescription & Practice Management System &bull; Secure Multi-Tenant Architecture
      </footer>
    </div>
  );
};
