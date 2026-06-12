/**
 * Firestore security-rules tests for OkDates.
 *
 * These are the safety net for the lighter-hardening rules:
 *   • admin credentials (adminKeyHash / adminPassword) are write-once at create
 *     and immutable afterward,
 *   • plaintext adminKey may never be written,
 *   • participant ownerUid (when present) must match the caller.
 *
 * Run via the Firestore emulator:
 *   npm run test:rules
 * (which is: firebase emulators:exec --only firestore "node firestore-rules-tests/run.js")
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

const PROJECT_ID = 'demo-okdates';
const rules = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  const alice = testEnv.authenticatedContext('alice').firestore();
  const bob = testEnv.authenticatedContext('bob').firestore();

  // Seed an existing event (with hashed admin credentials) bypassing rules.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'events/evt1'), {
      createdAt: new Date(),
      isActive: true,
      title: 'Seeded',
      adminKeyHash: 'hash-of-key',
      adminPassword: 'pbkdf2$100000$aa$bb',
    });
    await setDoc(doc(db, 'events/evt-nopw'), {
      createdAt: new Date(),
      isActive: true,
      title: 'No password',
      adminKeyHash: 'hash2',
    });
  });

  console.log('Firestore rules tests:');

  await test('any authed user can read an event', async () => {
    await assertSucceeds(getDoc(doc(alice, 'events/evt1')));
  });

  await test('authed user can edit non-secret fields (title)', async () => {
    await assertSucceeds(updateDoc(doc(alice, 'events/evt1'), { title: 'Edited' }));
  });

  await test('cannot change adminKeyHash', async () => {
    await assertFails(updateDoc(doc(bob, 'events/evt1'), { adminKeyHash: 'attacker' }));
  });

  await test('cannot change existing adminPassword', async () => {
    await assertFails(updateDoc(doc(bob, 'events/evt1'), { adminPassword: 'pbkdf2$1$cc$dd' }));
  });

  await test('cannot add an adminPassword to a password-less event (no takeover)', async () => {
    await assertFails(updateDoc(doc(bob, 'events/evt-nopw'), { adminPassword: 'pbkdf2$1$cc$dd' }));
  });

  await test('cannot write a plaintext adminKey via update', async () => {
    await assertFails(updateDoc(doc(bob, 'events/evt1'), { adminKey: 'plaintext' }));
  });

  await test('create requires adminKeyHash', async () => {
    await assertFails(setDoc(doc(alice, 'events/new1'), {
      createdAt: new Date(), isActive: true, title: 'x',
    }));
  });

  await test('create rejects plaintext adminKey', async () => {
    await assertFails(setDoc(doc(alice, 'events/new2'), {
      createdAt: new Date(), isActive: true, title: 'x',
      adminKeyHash: 'h', adminKey: 'plaintext',
    }));
  });

  await test('create succeeds with adminKeyHash and no plaintext', async () => {
    await assertSucceeds(setDoc(doc(alice, 'events/new3'), {
      createdAt: new Date(), isActive: true, title: 'x', adminKeyHash: 'h',
    }));
  });

  await test('participant create succeeds when ownerUid matches caller', async () => {
    await assertSucceeds(setDoc(doc(alice, 'events/evt1/participants/p1'), {
      name: 'Alice', rawDateInput: '6/15', parsedDates: [], ownerUid: 'alice',
    }));
  });

  await test('participant create rejects spoofed ownerUid', async () => {
    await assertFails(setDoc(doc(alice, 'events/evt1/participants/p2'), {
      name: 'Alice', rawDateInput: '6/15', parsedDates: [], ownerUid: 'someone-else',
    }));
  });

  await test('participant create still works without ownerUid (older clients)', async () => {
    await assertSucceeds(setDoc(doc(alice, 'events/evt1/participants/p3'), {
      name: 'Alice', rawDateInput: '6/15', parsedDates: [],
    }));
  });

  await testEnv.cleanup();
  console.log(`\n${passed} checks passed.`);
  assert(process.exitCode !== 1, 'Some rules tests failed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
