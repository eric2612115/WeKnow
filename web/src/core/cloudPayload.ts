// The only shape that may leave the device for a cloud lookup.
// One line item the local pack could not match, already masked, plus the region. Nothing else.

import { findPII } from './pii';

export interface CloudLookup {
  item: string; // e.g. "replace rear brake pads"
  region: string; // e.g. "US-CA"
  unit?: string;
}

export class CloudPayloadError extends Error {}

const ALLOWED_KEYS = new Set(['item', 'region', 'unit']);
const MAX_ITEM_LENGTH = 120;

export function buildCloudLookup(input: Record<string, unknown>): CloudLookup {
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new CloudPayloadError(`field "${key}" may not leave the device`);
  }
  const { item, region, unit } = input;
  if (typeof item !== 'string' || !item.trim()) throw new CloudPayloadError('item must be text');
  if (item.length > MAX_ITEM_LENGTH) throw new CloudPayloadError('item too long to be one line item');
  if (typeof region !== 'string' || !/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(region)) {
    throw new CloudPayloadError('region must look like US or US-CA');
  }
  if (unit !== undefined && (typeof unit !== 'string' || unit.length > 20)) {
    throw new CloudPayloadError('unit must be short text');
  }
  const hits = findPII([item, unit ?? ''].join(' '));
  if (hits.length) throw new CloudPayloadError(`personal data in cloud payload: ${hits.map((h) => h.kind).join(', ')}`);
  return unit === undefined ? { item: item.trim(), region } : { item: item.trim(), region, unit };
}
