import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken } from './token.util.js';

describe('ATT-01 Token Algorithm', () => {
  const masterSecret = 'super-secret-master-key';
  const activityId = '123e4567-e89b-12d3-a456-426614174000';

  it('generates a token and returns validUntil', () => {
    const unixMs = 1700000000000;
    const result = generateToken(masterSecret, activityId, unixMs);
    expect(result.token).toHaveLength(10);
    expect(result.validUntil).toBeGreaterThan(unixMs);
    
    const window = Math.floor(unixMs / 30000);
    expect(result.validUntil).toBe((window + 1) * 30000);
  });

  it('accepts a token from the current window', () => {
    const unixMs = 1700000000000;
    const { token } = generateToken(masterSecret, activityId, unixMs);
    const verify = verifyToken(masterSecret, activityId, token, unixMs);
    expect(verify.isValid).toBe(true);
  });

  it('accepts a token from the previous window (<= 60s)', () => {
    const unixMs = 1700000000000;
    const { token } = generateToken(masterSecret, activityId, unixMs);
    
    // Move time forward by 35 seconds (next window)
    const nextWindowMs = unixMs + 35000;
    const verify = verifyToken(masterSecret, activityId, token, nextWindowMs);
    expect(verify.isValid).toBe(true);
  });

  it('rejects a token from 2 windows ago', () => {
    const unixMs = 1700000000000;
    const { token } = generateToken(masterSecret, activityId, unixMs);
    
    // Move time forward by 65 seconds (2 windows later)
    const futureMs = unixMs + 65000;
    const verify = verifyToken(masterSecret, activityId, token, futureMs);
    expect(verify.isValid).toBe(false);
    expect(verify.reason).toBe('TOKEN_INVALID');
  });

  it('rejects a token from the wrong activity', () => {
    const unixMs = 1700000000000;
    const wrongActivityId = '999e4567-e89b-12d3-a456-426614174000';
    const { token } = generateToken(masterSecret, wrongActivityId, unixMs);
    
    const verify = verifyToken(masterSecret, activityId, token, unixMs);
    expect(verify.isValid).toBe(false);
  });

  it('rejects invalid token lengths safely', () => {
    const unixMs = 1700000000000;
    const verify = verifyToken(masterSecret, activityId, 'SHORT', unixMs);
    expect(verify.isValid).toBe(false);
  });
});
