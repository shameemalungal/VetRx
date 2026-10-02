# VetRx Phase 14 — Platform Super Admin Architecture

## 1. Architectural Separation
Platform administration in VetRx is strictly separated from practice-level tenant operations:

| Attribute | Practice Member Roles | Platform Super Admin |
|---|---|---|
| **Storage Model** | `PracticeMember.role` (`Role` enum) | `User.platformRole` (`PlatformRole` enum) |
| **Scope** | Single Practice Tenant | Global VetRx Platform |
| **Clinical Access** | Full clinical records within practice | Zero clinical access by default |
| **Route Prefix** | `/api/practice/...`, `/api/clinical/...` | `/api/platform/admin/...` |
| **Middleware Guard** | `requirePracticePermission` | `requirePlatformPermission` |

---

## 2. Platform Authorization Middleware
All platform routes are protected by `requirePlatformPermission()`:
```ts
export function requirePlatformPermission(permission?: Permission | string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    await AuthorizationService.requirePlatformSuperAdmin(req.user.id);
    next();
  };
}
```

Any attempt by a standard practice member (including a `PRACTICE_OWNER`) to access platform routes returns:
```json
{
  "error": {
    "code": "PLATFORM_ACCESS_REQUIRED",
    "message": "This operation requires Platform Super Admin privileges."
  }
}
```

---

## 3. Platform Admin API Capabilities

### 1. `GET /api/platform/admin/practices`
- Returns high-level directory of all practices across the platform.
- Metrics include practice name, slug, owner ID, member count, active subscription plan, and commercial status.

### 2. `GET /api/platform/admin/practices/:id`
- Returns detailed view of a single practice for support and reconciliation.
- Includes owner profile, member rosters, active subscriptions, and settings.

### 3. `GET /api/platform/admin/users`
- Returns global user directory with verification status, platform role, and created timestamp.

### 4. `GET /api/platform/admin/audit`
- Provides platform-wide security audit trail covering login events, ownership transfers, role changes, and subscription mutations.
