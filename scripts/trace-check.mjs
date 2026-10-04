import { readFile, glob } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const [srsRaw, slicesRaw] = await Promise.all([
  readFile('docs/SRS.md', 'utf8'),
  readFile('docs/slices.json', 'utf8'),
]);

// Load KNOWN-GAPS.md to find deferred requirements (exempt from trace:check failure)
let deferredReqs = new Set();
if (existsSync('docs/KNOWN-GAPS.md')) {
  const gapsRaw = await readFile('docs/KNOWN-GAPS.md', 'utf8');
  // Extract req IDs listed under ## Deferred or lines like: REQ-XXX-NN (deferred)
  // Pattern: look for `REQ-<ID>` tokens anywhere in KNOWN-GAPS.md lines containing "defer" or in a Deferred section
  const deferredSection = gapsRaw.match(/##\s+[23]\.\s+.*(?:Deferred|Known Gaps|Gap)[\s\S]*?(?=\n##|$)/gi);
  const allReqMatches = gapsRaw.matchAll(/\b([A-Z]{2,6}-\d{2,3})\b.*(?:defer|optional|gap|placeholder|stub|not implement)/gi);
  for (const m of allReqMatches) {
    deferredReqs.add(m[1]);
  }
  // Also look for explicit DEFERRED: lines
  const explicitMatches = gapsRaw.matchAll(/DEFERRED:\s*([A-Z]{2,6}-\d{2,3})/gi);
  for (const m of explicitMatches) {
    deferredReqs.add(m[1]);
  }
}

// 1. Parse requirement tables in docs/SRS.md
// Tables follow markdown syntax with columns starting with | ID |
const srsLines = srsRaw.split('\n');
const srsReqIds = new Set();
let inReqTable = false;

for (const line of srsLines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('| ID |') || trimmed.startsWith('|ID|')) {
    inReqTable = true;
    continue;
  }
  if (inReqTable) {
    if (!trimmed.startsWith('|')) {
      inReqTable = false;
      continue;
    }
    // Match table row with requirement ID, e.g. | OPS-01 | ...
    const match = trimmed.match(/^\|\s*([A-Z]{2,6}-[0-9]{2,3})\s*\|/);
    if (match) {
      srsReqIds.add(match[1]);
    }
  }
}

// 2. Read tracked requirements from docs/slices.json (active or done)
const slices = JSON.parse(slicesRaw);
const trackedReqs = Object.values(slices)
  .filter((slice) => ['active', 'done'].includes(slice.status))
  .flatMap((slice) => slice.reqs);

// 3. Scan test files for describe/it/test names matching REQ-<ID> with word boundaries
const testFiles = [];
for await (const path of glob('{apps,packages,scripts}/**/*.{test,spec}.{ts,js,tsx,jsx}')) {
  testFiles.push(path);
}
const testBodies = await Promise.all(testFiles.map((path) => readFile(path, 'utf8')));

const testNames = [];
for (const body of testBodies) {
  const matches = body.matchAll(/(?:describe|describeDb|it|test)\w*(?:\.\w+)*\s*\(\s*(['"`])([\s\S]*?)\1/g);
  for (const m of matches) {
    testNames.push(m[2]);
  }
}

let failed = false;
const missing = [];
const deferred = [];

for (const req of trackedReqs) {
  // Confirm listed ID exists in docs/SRS.md tables
  if (!srsReqIds.has(req)) {
    console.error(`Requirement ${req} listed in docs/slices.json does not exist in docs/SRS.md requirement tables`);
    failed = true;
  }

  // Require a describe/it name matching REQ-<ID> with word boundaries
  const escapedReq = req.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryRegex = new RegExp(`\\bREQ-${escapedReq}\\b`);
  const hasMatchingTest = testNames.some((name) => boundaryRegex.test(name));

  if (!hasMatchingTest) {
    if (deferredReqs.has(req)) {
      deferred.push(req);
    } else {
      console.error(`Requirement ${req} has no matching test with name REQ-${req} with word boundaries`);
      missing.push(req);
      failed = true;
    }
  }
}

if (deferred.length > 0) {
  console.warn(`trace:check DEFERRED (listed in KNOWN-GAPS.md): ${deferred.join(', ')}`);
}

if (failed) {
  console.error(`\ntrace:check FAILED: ${missing.length} untested requirement(s): ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`trace:check PASSED for ${trackedReqs.length} requirements (${deferred.length} deferred).`);
