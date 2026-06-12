/**
 * One-time migration: move admin secrets out of world-readable event docs.
 *
 * For every document in the `events` collection:
 *   1. If a plaintext `adminKey` exists, write `adminKeyHash = sha256(adminKey)`
 *      (if not already present) and delete the plaintext `adminKey` field.
 *   2. If `adminPassword` is in the legacy reversed-base64 format (no "$"), it is
 *      reversible, so decode it to plaintext and re-hash with PBKDF2-SHA256 to the
 *      `pbkdf2$<iter>$<saltHex>$<hashHex>` format the client now uses. This removes
 *      the reversible (takeover-enabling) value from the database.
 *   3. Legacy `salt$hash` (single-round SHA-256) passwords are one-way and cannot be
 *      upgraded without the plaintext, so they are left as-is.
 *
 * The Admin SDK bypasses firestore.rules, so this runs cleanly before/after the
 * new rules are deployed.
 *
 * Hash formats MUST match src/app/core/services/event.service.ts:
 *   - adminKeyHash:  SHA-256 hex of the UTF-8 key
 *   - adminPassword: pbkdf2$<iterations>$<saltHex>$<hashHex>, PBKDF2-HMAC-SHA256,
 *                    32-byte derived key, hex-encoded.
 *
 * Usage:
 *   # Against the emulator (safe dry run target):
 *   export FIRESTORE_EMULATOR_HOST=localhost:8081
 *   export GCLOUD_PROJECT=okdates
 *   npx ts-node functions/scripts/migrate-admin-keys.ts            # dry run
 *   npx ts-node functions/scripts/migrate-admin-keys.ts --commit   # apply
 *
 *   # Against production (requires GOOGLE_APPLICATION_CREDENTIALS service account):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   export GCLOUD_PROJECT=okdates
 *   npx ts-node functions/scripts/migrate-admin-keys.ts --commit
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const PBKDF2_ITERATIONS = 100000;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function pbkdf2Hash(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Decode the legacy reversed-base64 password obfuscation back to plaintext. */
function decodeLegacyReversedBase64(stored: string): string | null {
  try {
    const base64 = stored.split('').reverse().join('');
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const commit = process.argv.includes('--commit');

  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || undefined
  });
  const db = admin.firestore();

  const snapshot = await db.collection('events').get();
  console.log(`Scanning ${snapshot.size} event(s). Mode: ${commit ? 'COMMIT' : 'DRY RUN'}`);

  let migratedKeys = 0;
  let migratedPasswords = 0;
  let skippedSha256Passwords = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, any>;
    const updates: Record<string, any> = {};

    // 1. Admin key → hash
    if (typeof data.adminKey === 'string' && data.adminKey.length > 0) {
      if (!data.adminKeyHash) {
        updates.adminKeyHash = sha256Hex(data.adminKey);
      }
      updates.adminKey = admin.firestore.FieldValue.delete();
      migratedKeys++;
    }

    // 2. Admin password → upgrade reversible legacy format
    if (typeof data.adminPassword === 'string' && data.adminPassword.length > 0) {
      const pw = data.adminPassword as string;
      if (pw.startsWith('pbkdf2$')) {
        // already current
      } else if (pw.includes('$')) {
        // legacy salt$hash SHA-256 — one-way, cannot upgrade without plaintext
        skippedSha256Passwords++;
      } else {
        const plaintext = decodeLegacyReversedBase64(pw);
        if (plaintext !== null) {
          updates.adminPassword = pbkdf2Hash(plaintext);
          migratedPasswords++;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log(`  event ${doc.id}: ${Object.keys(updates).join(', ')}`);
      if (commit) {
        await doc.ref.update(updates);
      }
    }
  }

  console.log('—');
  console.log(`Admin keys hashed + plaintext removed: ${migratedKeys}`);
  console.log(`Legacy base64 passwords upgraded to PBKDF2: ${migratedPasswords}`);
  console.log(`SHA-256 salt$hash passwords left as-is (cannot reverse): ${skippedSha256Passwords}`);
  if (!commit) {
    console.log('\nDry run only — re-run with --commit to apply.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
