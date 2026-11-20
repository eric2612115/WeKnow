import { describe, expect, it } from 'vitest';
import { mapsSearchUrl, proKind, proNearbyUrl } from '../maps';
import { t, EN } from '../strings';

describe('maps links', () => {
  it('search only the kind of pro, never anything from the paper', () => {
    expect(proKind('plumbing')).toBe('plumber');
    expect(proKind(undefined)).toBe('handyman');
    expect(proNearbyUrl('plumbing', false)).toBe('https://www.google.com/maps/search/?api=1&query=plumber%20near%20me');
    expect(proNearbyUrl('electrical', true)).toBe('https://maps.apple.com/?q=electrician%20near%20me');
  });
  it('keeps a search short', () => {
    expect(decodeURIComponent(mapsSearchUrl('x'.repeat(200), false).split('query=')[1])).toHaveLength(80);
  });
});

describe('strings', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('tag.local', { device: 'phone' })).toBe('On this phone');
    expect(t('tag.local')).toBe('On this {device}');
  });
  it('never names a model, a cloud or a brand where a person reads it', () => {
    const banned = /\b(AI|model|cloud|on-device|sync|cache|token|offline|consent|Gemini|Firebase|Chrome)\b/;
    // "Sign in with Google" is the spec's own string; the two steps that say which browser to open must name it.
    const allowed = new Set(['set.signin', 'needmodel.chrome.t', 'needmodel.chrome.1']);
    for (const [id, s] of Object.entries(EN)) if (!allowed.has(id)) expect(s, id).not.toMatch(banned);
  });
});
