#!/usr/bin/env node
// expand-timestamp.js

const { DateTime } = require('luxon');

// ▸ argv[2]: the Unix‐seconds timestamp
// ▸ argv[3]: the IANA timezone name (e.g. "Europe/Zurich")
const [,, tsArg, tzArg = 'UTC'] = process.argv;
const seconds = Number(tsArg);

if (!tsArg || Number.isNaN(seconds)) {
  console.error(`❌ Invalid or missing timestamp: ${tsArg}`);
  console.error(`Usage: node expand-timestamp.js <seconds> [IANA-zone]`);
  process.exit(1);
}

try {
  // Step 1: parse the seconds as UTC so we don't shift the clock yet
  let dt = DateTime.fromSeconds(seconds, { zone: 'utc' });
  // Step 2: relabel that same wall-clock time into the target zone
  dt = dt.setZone(tzArg, { keepLocalTime: true });

  console.log(`${tzArg}: ${dt.toISO()}`);

} catch (e) {
  console.error(`❌ Error with timezone "${tzArg}": ${e.message}`);
  process.exit(1);
}
