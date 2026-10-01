import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

const [srsRaw, slicesRaw] = await Promise.all([
  readFile('docs/SRS.md', 'utf8'),
  readFile('docs/slices.json', 'utf8'),
]);

const slices = JSON.parse(slicesRaw);
const trackedReqs = Object.values(slices)
  .filter((slice) => ['active', 'done'].includes(slice.status))
  .flatMap((slice) => slice.reqs);

const testFiles = [];
for await (const path of glob('{apps,packages,scripts}/**/*.{test,spec}.ts')) {
  testFiles.push(path);
}
const testBodies = await Promise.all(testFiles.map((path) => readFile(path, 'utf8')));
const allTests = testBodies.join('\n');

let failed = false;
for (const req of trackedReqs) {
  if (!srsRaw.includes(req)) {
    console.error(`Requirement ${req} is missing from docs/SRS.md`);
    failed = true;
  }
  if (!allTests.includes(req)) {
    console.error(`Requirement ${req} has no matching test name`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`trace check passed for ${trackedReqs.length} requirements`);
