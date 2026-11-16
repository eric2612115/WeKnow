import { describe, expect, it } from 'vitest';
import { isStaleChunk } from '../staleBuild';

describe('isStaleChunk', () => {
  it('recognises the stale-chunk errors of Chrome, Safari and Firefox', () => {
    expect(isStaleChunk(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Checks-CrJfDhNn.js'))).toBe(true);
    expect(isStaleChunk(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunk(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true);
  });
  it('leaves other errors alone', () => {
    expect(isStaleChunk(new Error('[429] RESOURCE_EXHAUSTED'))).toBe(false);
    expect(isStaleChunk(undefined)).toBe(false);
  });
});
