import { readFile, glob } from 'node:fs/promises';

const [srsRaw, slicesRaw] = await Promise.all([
  readFile('docs/SRS.md', 'utf8'),
  readFile('docs/slices.json', 'utf8'),
]);

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
  const matches = body.matchAll(/(?:describe|describeDb|it|test)\w*(?:\.[\w]+)*\s*\(\s*(['"`])([\s\S]*?)\1/g);
  for (const m of matches) {
    testNames.push(m[2]);
  }
}

let failed = false;
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
    console.error(`Requirement ${req} has no matching test with name REQ-${req} with word boundaries`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`trace check passed for ${trackedReqs.length} requirements`);
