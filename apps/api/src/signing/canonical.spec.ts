import { canonicalizeJson } from './canonical.js';

describe('Canonical JSON', () => {
  it('sorts keys', () => {
    expect(canonicalizeJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('handles unicode', () => {
    expect(canonicalizeJson({ name: 'Ém' })).toBe('{"name":"Ém"}');
  });

  it('handles numbers', () => {
    expect(canonicalizeJson({ num: 1.5 })).toBe('{"num":1.5}');
  });
});
