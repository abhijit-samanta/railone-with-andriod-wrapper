# RailOne Firestore Security Specification

## Phase 0: Data Invariants
1. **Default Deny:** Any path not explicitly matched is denied for all reads and writes.
2. **Verified Identity Required:** No unauthenticated or unverified (`email_verified == false`) requests may read or write any document.
3. **One User, One MPIN Ownership:** Only an Admin may create, list, or delete `mpinCodes` and `mpinClaims`. Once a user claims an `Active` MPIN, `mpinCodes/{mpin}.ownerUid` becomes immutable and bound strictly to `request.auth.uid`, and `mpinClaims/{mpin}` is atomically written in the same batch (`existsAfter` / `getAfter`).
4. **PII Isolation:** `mpinCodes/{mpin}` stores zero PII (no name, mobile, email). User PII and device metadata reside exclusively in `mpinClaims/{mpin}` and `users/{userId}/accounts/{accountKey}`, readable only by the owning UID or an Admin.
5. **User Snapshot Isolation:** `users/{userId}/accounts/{accountKey}` requires the parent `users/{userId}` document to exist (Master Gate), verifies `ownerUid == request.auth.uid`, enforces strict key allowlists (`hasAll`/`hasOnly` + `affectedKeys().hasOnly()`), and uses native Maps/Lists with bounded array sizes.
6. **Temporal Integrity:** All `createdAt`, `generatedAt`, `firstLoginAt`, `lastLoginAt`, `attemptedAt`, and `updatedAt` timestamps must match `request.time`.

## The "Dirty Dozen" Rejection Payloads
1. **Unauthenticated read:** `get /mpinCodes/Ab12Cd` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified email write:** `set /users/uid1` with `auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Non-admin list MPINs:** `list /mpinCodes` as standard user -> `PERMISSION_DENIED`.
4. **Non-owner read claimed MPIN:** `get /mpinCodes/Ab12Cd` where `ownerUid == "uidA"` requested by `"uidB"` -> `PERMISSION_DENIED`.
5. **Cross-user MPIN hijack:** `update /mpinCodes/Ab12Cd` changing `ownerUid` from `"uidA"` to `"uidB"` -> `PERMISSION_DENIED`.
6. **Shadow field injection:** `create /users/uid1/accounts/acc1` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
7. **Orphan claim without code batch:** `create /mpinClaims/Ab12Cd` without updating `/mpinCodes/Ab12Cd.ownerUid` in the same batch -> `PERMISSION_DENIED`.
8. **Spoofed timestamp:** `update /users/uid1/accounts/acc1` setting `updatedAt` to a client clock timestamp != `request.time` -> `PERMISSION_DENIED`.
9. **Mutable createdAt:** `update /users/uid1/accounts/acc1` altering `createdAt` -> `PERMISSION_DENIED`.
10. **ID Poisoning:** `create /users/uid1/accounts/bad..id/../../x` or >128 char ID -> `PERMISSION_DENIED`.
11. **Non-admin adminConfig write:** `update /adminConfig/global` as non-admin user -> `PERMISSION_DENIED`.
12. **List user accounts cross-UID:** `list /users/uidA/accounts` requested by `"uidB"` -> `PERMISSION_DENIED`.
