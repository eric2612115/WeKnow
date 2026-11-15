import { describe, expect, it } from 'vitest';
import { isBusy } from '../errors';

describe('busy or unreadable', () => {
  it('a full queue or a dropped connection is "busy", never the photo', () => {
    expect(isBusy(new Error('[429 Too Many Requests] Resource has been exhausted (e.g. check quota).'))).toBe(true);
    expect(isBusy(new Error('RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel'))).toBe(true);
    expect(isBusy(new Error('[503 Service Unavailable] The model is overloaded.'))).toBe(true);
    expect(isBusy(new TypeError('Failed to fetch'))).toBe(true);
    expect(isBusy(new Error('reading timed out'))).toBe(true);
  });
  it('an answer that cannot be used is the picture, not the service', () => {
    expect(isBusy(new SyntaxError('Unexpected token < in JSON at position 0'))).toBe(false);
    expect(isBusy(new Error('bad kind poem'))).toBe(false);
  });
});
