import { applyTestEnv } from '../test-env.js';
import { ensureReferenceData } from '../helpers/reference-data.js';
import { ownerPrisma } from '../helpers/db.js';

export async function setup(): Promise<void> {
  applyTestEnv();
  await ensureReferenceData();
}

export async function teardown(): Promise<void> {
  await ownerPrisma.$disconnect();
}

export default setup;
