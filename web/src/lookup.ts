// Cloud lookup for a line the pack does not know.
// Only `buildCloudLookup`'s payload leaves the device: the masked item name and the region.
// The answer must cite web sources found by Google Search grounding, or it is not kept.

import { getGenerativeModel, InferenceMode, type GenerativeModel } from 'firebase/ai';
import { ai, CLOUD_MODEL } from './firebase';
import { buildCloudLookup, type CloudLookup } from './core/cloudPayload';
import type { PriceItem, Source } from './core/packs';

let searchModel: GenerativeModel | undefined;

function model(): GenerativeModel {
  searchModel ??= getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, tools: [{ googleSearch: {} }], generationConfig: { temperature: 0 } },
  });
  return searchModel;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export interface LookupResult {
  item: PriceItem | null;
  payload: CloudLookup;
  ms: number;
  reason?: string;
}

/** Search the web for a typical price range. Returns null when no sourced range was found. */
export async function lookupPrice(itemName: string, region: string): Promise<LookupResult> {
  const payload = buildCloudLookup({ item: itemName, region });
  const started = performance.now();
  // Asking for JSON alone makes the model answer from memory; it is told to search first, then sum up in JSON.
  const prompt = `Search the web: what do customers in ${payload.region} typically pay a professional for this repair or service line item: "${payload.item}"?
Use recent cost guides you find with Google Search, then end your answer with one line of JSON:
{"name": short plain name, "unit": "job" or similar, "low": number, "typical": number, "high": number}
Use US dollars. If the sources do not give a price range for this item, reply {"none": true}.`;
  const res = await model().generateContent(prompt);
  const ms = Math.round(performance.now() - started);
  const text = res.response.text();
  // The last {...} in the answer: the summary line after the prose.
  const json = [...text.matchAll(/\{[^{}]*\}/g)].pop()?.[0];
  const chunks = res.response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: Source[] = chunks
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => !!w?.uri && w.uri.startsWith('https://'))
    .map((w) => ({ url: w.uri, title: w.title, fetched: new Date().toISOString().slice(0, 10) }));
  if (!json) return { item: null, payload, ms, reason: 'no answer' };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { item: null, payload, ms, reason: 'unreadable answer' };
  }
  if (parsed.none) return { item: null, payload, ms, reason: 'no price range in sources' };
  const nums = [parsed.low, parsed.typical, parsed.high];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)) {
    return { item: null, payload, ms, reason: 'no numbers' };
  }
  const [low, typical, high] = nums as number[];
  if (!(low <= typical && typical <= high)) return { item: null, payload, ms, reason: 'range out of order' };
  if (!sources.length) return { item: null, payload, ms, reason: 'no web sources' };
  return {
    payload,
    ms,
    item: {
      ref: `learned-${slug(payload.item)}`,
      category: 'learned',
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 80) : payload.item,
      aliases: [payload.item],
      unit: typeof parsed.unit === 'string' ? parsed.unit.slice(0, 20) : 'job',
      low,
      typical,
      high,
      sources: sources.slice(0, 5),
    },
  };
}
