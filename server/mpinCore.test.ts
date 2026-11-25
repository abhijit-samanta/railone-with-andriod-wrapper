import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MpinDatabase,
  ONE_LAKH,
  generateUniqueMpins,
  isMixedCaseAlphanumericMpin,
  signAuthToken,
  verifyAuthToken,
} from './mpinCore.ts';

test('generates 100,000 (1 lakh) guaranteed-unique mixed-case alphanumeric MPINs and persists all in SQLite', () => {
  const db = new MpinDatabase(':memory:');
  try {
    const batch = db.generateBatch(ONE_LAKH);
    assert.equal(batch.generatedCount, 100_000);
    assert.equal(batch.sampleMpins.length, 10);
    for (const pin of batch.sampleMpins) {
      assert.equal(isMixedCaseAlphanumericMpin(pin), true);
    }

    const stats = db.getStats();
    assert.equal(stats.totalGenerated, 100_000);
    assert.equal(stats.activeCount, 100_000);
    assert.equal(stats.usedCount, 0);
    assert.equal(stats.blockedCount, 0);
    assert.equal(stats.expiredCount, 0);

    const page1 = db.listMpins({ page: 1, limit: 50 });
    assert.equal(page1.total, 100_000);
    assert.equal(page1.items.length, 50);
    assert.equal(page1.totalPages, 2000);
    for (const item of page1.items) {
      assert.match(item.mpin, /^(?=.*\d)(?=.*[A-Z])(?=.*[a-z])[A-Za-z0-9]{6}$/);
    }
    assert.equal(page1.items[0].status, 'Active');
    assert.equal(page1.items[0].totalLoginCount, 0);
    assert.equal(page1.items[0].failedAttempts, 0);
  } finally {
    db.close();
  }
});

test('generateUniqueMpins respects existing set, produces zero duplicates, and mixes digits + upper + lower', () => {
  const existing = new Set(['Ab12Cd', 'xY90zQ', '999999']);
  const generated = generateUniqueMpins(5000, existing);
  assert.equal(generated.length, 5000);
  const uniqueCheck = new Set(generated);
  assert.equal(uniqueCheck.size, 5000);
  for (const code of generated) {
    assert.equal(isMixedCaseAlphanumericMpin(code), true);
  }
  for (const code of existing) {
    assert.equal(uniqueCheck.has(code), false);
  }
});

test('user MPIN verification tracks first/last login, count, device ID, Android/iOS, IP, and status', () => {
  const db = new MpinDatabase(':memory:');
  try {
    const batch = db.generateBatch(50, { nowIso: '2026-11-23T08:00:00.000Z' });
    const targetMpin = batch.sampleMpins[0];

    // 1. Invalid unknown MPIN
    const bad = db.verifyUserMpin({
      mpin: '000000',
      deviceId: 'DEV-AND-1111',
      deviceType: 'Android',
      loginIp: '203.0.113.10',
      nowIso: '2026-11-23T09:00:00.000Z',
    });
    // Only assert invalid if 000000 wasn't randomly in the 50-item batch
    if (!batch.sampleMpins.includes('000000') && db.getMpinDetail('000000').record === null) {
      assert.equal(bad.ok, false);
      assert.equal(bad.statusCode, 401);
    }

    // 2. First valid login (Android) -> Active becomes Used, firstLoginAt == lastLoginAt
    const first = db.verifyUserMpin({
      mpin: targetMpin,
      deviceId: 'DEV-AND-9988',
      deviceType: 'Android',
      loginIp: '198.51.100.42',
      nowIso: '2026-11-23T10:15:00.000Z',
    });
    assert.equal(first.ok, true);
    assert.equal(first.record?.status, 'Used');
    assert.equal(first.record?.firstLoginAt, '2026-11-23T10:15:00.000Z');
    assert.equal(first.record?.lastLoginAt, '2026-11-23T10:15:00.000Z');
    assert.equal(first.record?.totalLoginCount, 1);
    assert.equal(first.record?.deviceId, 'DEV-AND-9988');
    assert.equal(first.record?.deviceType, 'Android');
    assert.equal(first.record?.loginIp, '198.51.100.42');
    assert.equal(first.record?.failedAttempts, 0);

    // 3. Second valid login (iOS) -> preserves firstLoginAt, updates lastLoginAt and count=2
    const second = db.verifyUserMpin({
      mpin: targetMpin,
      deviceId: 'DEV-IOS-7766',
      deviceType: 'iOS',
      loginIp: '198.51.100.88',
      nowIso: '2026-11-23T12:30:00.000Z',
    });
    assert.equal(second.ok, true);
    assert.equal(second.record?.status, 'Used');
    assert.equal(second.record?.firstLoginAt, '2026-11-23T10:15:00.000Z');
    assert.equal(second.record?.lastLoginAt, '2026-11-23T12:30:00.000Z');
    assert.equal(second.record?.totalLoginCount, 2);
    assert.equal(second.record?.deviceType, 'iOS');
    assert.equal(second.record?.loginIp, '198.51.100.88');

    // 4. Admin blocks MPIN -> further login increments failedAttempts and denies access
    const blocked = db.updateMpinControl(targetMpin, 'block');
    assert.equal(blocked?.status, 'Blocked');

    const denied = db.verifyUserMpin({
      mpin: targetMpin,
      deviceId: 'DEV-IOS-7766',
      deviceType: 'iOS',
      loginIp: '198.51.100.88',
      nowIso: '2026-11-23T13:00:00.000Z',
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.record?.failedAttempts, 1);
    assert.equal(db.checkActiveMpinStatus(targetMpin).allowed, false);

    // 5. Expiry check transitions to Expired and rejects login
    const secondMpin = batch.sampleMpins[1];
    db.updateMpinControl(secondMpin, 'expire');
    const expiredRes = db.verifyUserMpin({
      mpin: secondMpin,
      deviceId: 'DEV-AND-1001',
      deviceType: 'Android',
      loginIp: '192.0.2.5',
    });
    assert.equal(expiredRes.ok, false);
    assert.equal(expiredRes.record?.status, 'Expired');
    assert.equal(expiredRes.record?.failedAttempts, 1);
  } finally {
    db.close();
  }
});

test('single-device lock rejects mismatched device and auto-blocks after 5 failed attempts', () => {
  const db = new MpinDatabase(':memory:');
  try {
    db.setEnforceDeviceLock(true);
    const batch = db.generateBatch(5);
    const pin = batch.sampleMpins[0];

    const first = db.verifyUserMpin({
      mpin: pin,
      deviceId: 'DEV-AND-PRIMARY',
      deviceType: 'Android',
      loginIp: '10.1.1.1',
    });
    assert.equal(first.ok, true);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const mismatch = db.verifyUserMpin({
        mpin: pin,
        deviceId: 'DEV-IOS-OTHER',
        deviceType: 'iOS',
        loginIp: '10.1.1.2',
      });
      assert.equal(mismatch.ok, false);
      assert.equal(mismatch.record?.failedAttempts, attempt);
      if (attempt < 5) {
        assert.equal(mismatch.record?.status, 'Used');
      } else {
        assert.equal(mismatch.record?.status, 'Blocked');
      }
    }
  } finally {
    db.close();
  }
});

test('first-run Admin MPIN claim, scrypt verification, env override, and HMAC tokens', () => {
  const db = new MpinDatabase(':memory:');
  try {
    assert.equal(db.getAdminAuthMode(''), 'setup-required');

    const claim1 = db.claimFirstRunAdminMpin('Ad9Km2', '');
    assert.equal(claim1.ok, true);
    assert.equal(db.getAdminAuthMode(''), 'claimed');

    // Second claim attempt is locked
    const claim2 = db.claimFirstRunAdminMpin('Zx12Yq', '');
    assert.equal(claim2.ok, false);

    assert.equal(db.verifyAdminPasscode('Ad9Km2', ''), true);
    assert.equal(db.verifyAdminPasscode('ad9km2', ''), false);
    assert.equal(db.verifyAdminPasscode('000000', ''), false);

    // Environment ADMIN_MPIN overrides claimed credential
    assert.equal(db.getAdminAuthMode('Rl7Xp4'), 'env');
    assert.equal(db.verifyAdminPasscode('Rl7Xp4', 'Rl7Xp4'), true);
    assert.equal(db.verifyAdminPasscode('Ad9Km2', 'Rl7Xp4'), false);

    // Token signing & verification
    const secret = 'test-signing-secret-32-bytes-minimum';
    const token = signAuthToken({ sub: 'admin', role: 'admin' }, secret, 60);
    const verified = verifyAuthToken(token, secret, 'admin');
    assert.equal(verified?.sub, 'admin');
    assert.equal(verifyAuthToken(token, secret, 'user'), null);
    assert.equal(verifyAuthToken(token, 'wrong-secret', 'admin'), null);
  } finally {
    db.close();
  }
});

test('clearMpins removes used/blocked/expired or all MPINs cleanly and supports fresh generation', () => {
  const db = new MpinDatabase(':memory:');
  try {
    const batch = db.generateBatch(5);
    const [usedPin, blockedPin, expiredPin, activePin1, activePin2] = batch.sampleMpins;

    db.verifyUserMpin({
      mpin: usedPin,
      deviceId: 'DEV-AND-01',
      deviceType: 'Android',
      loginIp: '10.0.0.1',
    });
    db.updateMpinControl(blockedPin, 'block');
    db.updateMpinControl(expiredPin, 'expire');

    let stats = db.getStats();
    assert.equal(stats.totalGenerated, 5);
    assert.equal(stats.activeCount, 2);
    assert.equal(stats.usedCount, 1);
    assert.equal(stats.blockedCount, 1);
    assert.equal(stats.expiredCount, 1);

    // Clear Used, Blocked & Expired only -> preserves the 2 Active MPINs
    const partial = db.clearMpins('used-blocked-expired');
    assert.equal(partial.deletedMpins, 3);
    assert.equal(partial.deletedLogs, 1);
    stats = db.getStats();
    assert.equal(stats.totalGenerated, 2);
    assert.equal(stats.activeCount, 2);
    assert.equal(stats.usedCount, 0);
    assert.equal(stats.blockedCount, 0);
    assert.equal(stats.expiredCount, 0);
    assert.equal(db.checkActiveMpinStatus(activePin1).allowed, true);
    assert.equal(db.checkActiveMpinStatus(activePin2).allowed, true);

    // Clear all remaining registered MPINs
    const full = db.clearMpins('all');
    assert.equal(full.deletedMpins, 2);
    stats = db.getStats();
    assert.equal(stats.totalGenerated, 0);
    assert.equal(stats.activeCount, 0);

    // Fresh generation afterward succeeds with mixed-case alphanumeric MPINs
    const fresh = db.generateBatch(10);
    assert.equal(fresh.generatedCount, 10);
    assert.equal(db.getStats().totalGenerated, 10);
    assert.equal(isMixedCaseAlphanumericMpin(fresh.sampleMpins[0]), true);
  } finally {
    db.close();
  }
});

test('MPIN links permanently with user name & mobile and rejects any other user', () => {
  const db = new MpinDatabase(':memory:');
  try {
    const batch = db.generateBatch(5);
    const pin = batch.sampleMpins[0];

    // User 1 claims the MPIN
    const user1 = db.verifyUserMpin({
      mpin: pin,
      userName: 'Priya Sharma',
      userMobile: '9812345678',
      userKey: 'user_9812345678',
      deviceId: 'DEV-AND-U1',
      deviceType: 'Android',
      loginIp: '10.0.1.1',
    });
    assert.equal(user1.ok, true);
    assert.equal(user1.record?.status, 'Used');
    assert.equal(user1.record?.boundUserName, 'Priya Sharma');
    assert.equal(user1.record?.boundUserMobile, '9812345678');

    // Another user (different phone & name) tries to use the same MPIN -> rejected (403)
    const user2 = db.verifyUserMpin({
      mpin: pin,
      userName: 'Rahul Das',
      userMobile: '9988776655',
      userKey: 'user_9988776655',
      deviceId: 'DEV-AND-U2',
      deviceType: 'Android',
      loginIp: '10.0.1.2',
    });
    assert.equal(user2.ok, false);
    assert.equal(user2.statusCode, 403);
    assert.match(user2.error ?? '', /linked to another user/i);
    assert.equal(user2.record?.boundUserName, 'Priya Sharma');
    assert.equal(user2.record?.status, 'Used');

    // Different user name using same mobile also rejected
    const imposter = db.verifyUserMpin({
      mpin: pin,
      userName: 'Another Name',
      userMobile: '9812345678',
      userKey: 'user_9812345678',
      deviceId: 'DEV-AND-U3',
      deviceType: 'Android',
      loginIp: '10.0.1.3',
    });
    assert.equal(imposter.ok, false);
    assert.equal(imposter.statusCode, 403);

    // Original user logs back in with same name & mobile -> succeeds
    const user1Again = db.verifyUserMpin({
      mpin: pin,
      userName: 'Priya Sharma',
      userMobile: '9812345678',
      userKey: 'user_9812345678',
      deviceId: 'DEV-AND-U1',
      deviceType: 'Android',
      loginIp: '10.0.1.1',
    });
    assert.equal(user1Again.ok, true);
    assert.equal(user1Again.record?.totalLoginCount, 2);

    // Returning user logs back in with ONLY their MPIN (fresh browser / pending_user) -> succeeds & returns bound identity
    const user1MpinOnly = db.verifyUserMpin({
      mpin: pin,
      userName: '',
      userMobile: '',
      userKey: 'pending_user',
      deviceId: 'DEV-AND-U1',
      deviceType: 'Android',
      loginIp: '10.0.1.1',
    });
    assert.equal(user1MpinOnly.ok, true);
    assert.equal(user1MpinOnly.record?.boundUserName, 'Priya Sharma');
    assert.equal(user1MpinOnly.record?.boundUserMobile, '9812345678');
    assert.equal(user1MpinOnly.record?.totalLoginCount, 3);
  } finally {
    db.close();
  }
});

test('listMpins supports serial-number-wise ascending pagination, #serial lookup, range filtering, and CSV Serial No.', () => {
  const db = new MpinDatabase(':memory:');
  try {
    db.generateBatch(25);

    const p1 = db.listMpins({ sortBy: 'id', sortDir: 'asc', page: 1, limit: 10 });
    assert.equal(p1.total, 25);
    assert.equal(p1.totalPages, 3);
    assert.deepEqual(
      p1.items.map((r) => r.id),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );

    const p3 = db.listMpins({ sortBy: 'id', sortDir: 'asc', page: 3, limit: 10 });
    assert.deepEqual(
      p3.items.map((r) => r.id),
      [21, 22, 23, 24, 25]
    );

    const exactSerial = db.listMpins({ q: '#17', sortBy: 'id', sortDir: 'asc' });
    assert.equal(exactSerial.total, 1);
    assert.equal(exactSerial.items[0].id, 17);

    const ranged = db.listMpins({
      serialFrom: 12,
      serialTo: 15,
      sortBy: 'id',
      sortDir: 'asc',
    });
    assert.deepEqual(
      ranged.items.map((r) => r.id),
      [12, 13, 14, 15]
    );

    const csv = db.exportCsv();
    const firstLines = csv.split('\n').slice(0, 3);
    assert.equal(firstLines[0].startsWith('Serial No.,MPIN,'), true);
    assert.equal(firstLines[1].startsWith('1,'), true);
    assert.equal(firstLines[2].startsWith('2,'), true);
  } finally {
    db.close();
  }
});

test('saveUserSnapshot, getUserAccount, and resumeVerifiedUserSession persist user data across sessions securely', () => {
  const db = new MpinDatabase(':memory:');
  try {
    const batch = db.generateBatch(3);
    const pin = batch.sampleMpins[0];

    const login = db.verifyUserMpin({
      mpin: pin,
      userName: 'Ananya Roy',
      userMobile: '9876501234',
      userKey: 'user_9876501234',
      deviceId: 'DEV-AND-AR1',
      deviceType: 'Android',
      loginIp: '10.2.2.2',
    });
    assert.equal(login.ok, true);

    db.saveUserSnapshot({
      userKey: 'user_9876501234',
      userName: 'Ananya Roy',
      userMobile: '9876501234',
      mpin: pin,
      snapshot: {
        profile: { name: 'Ananya Roy', mobile: '9876501234', rWalletBalance: 4250 },
        bookings: [{ id: 'bk-1', title: 'HWH - SDAH' }],
      },
    });

    const loaded = db.getUserAccount('user_9876501234');
    assert.equal(loaded?.userName, 'Ananya Roy');
    assert.equal(loaded?.userMobile, '9876501234');
    assert.equal(loaded?.mpin, pin);
    assert.equal((loaded?.snapshot?.profile as { rWalletBalance?: number })?.rWalletBalance, 4250);

    // Resume succeeds without incrementing totalLoginCount
    const resumed = db.resumeVerifiedUserSession({
      mpin: pin,
      userKey: 'user_9876501234',
      userName: 'Ananya Roy',
      userMobile: '9876501234',
    });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.record?.totalLoginCount, 1);

    // Resume rejects mismatched user
    const wrongUser = db.resumeVerifiedUserSession({
      mpin: pin,
      userKey: 'user_9999999999',
      userName: 'Other User',
      userMobile: '9999999999',
    });
    assert.equal(wrongUser.ok, false);
    assert.equal(wrongUser.statusCode, 403);
  } finally {
    db.close();
  }
});

test('importCloudMpins restores Firestore MPINs and bound user login claims without overwriting local bindings', () => {
  const db = new MpinDatabase(':memory:');
  try {
    const first = db.importCloudMpins([
      {
        mpin: 'Ab3Xy9',
        batchId: 'CLOUD-B1',
        status: 'Used',
        boundUserName: 'Abhijit Samanta',
        boundUserMobile: '9876543210',
        boundUserKey: 'user_9876543210',
        totalLoginCount: 2,
        deviceId: 'RO-AND-AABBCCDD',
        deviceType: 'Android',
      },
      {
        mpin: 'Cd4Mn2',
        batchId: 'CLOUD-B1',
        status: 'Active',
      },
    ]);
    assert.equal(first.importedCount, 2);

    const restored = db.getMpinDetail('Ab3Xy9').record;
    assert.equal(restored?.status, 'Used');
    assert.equal(restored?.boundUserName, 'Abhijit Samanta');
    assert.equal(restored?.boundUserMobile, '9876543210');
    assert.equal(restored?.totalLoginCount, 2);

    // Returning user can log back in using restored MPIN alone
    const relogin = db.verifyUserMpin({
      mpin: 'Ab3Xy9',
      deviceId: 'RO-AND-AABBCCDD',
      deviceType: 'Android',
      loginIp: '127.0.0.1',
    });
    assert.equal(relogin.ok, true);
    assert.equal(relogin.record?.boundUserName, 'Abhijit Samanta');
    assert.equal(relogin.record?.totalLoginCount, 3);
  } finally {
    db.close();
  }
});

