// Reading a photo: on this device when a local model is ready, in the cloud only after consent.
// Routing is explicit, not an SDK fallback, so the app always knows and shows where a photo was read.

import { getGenerativeModel, InferenceMode, type GenerativeModel } from 'firebase/ai';
import { ai, CLOUD_MODEL } from './firebase';
import type { Pack } from './core/packs';
import { menu } from './core/packs';
import { readPrompt } from './core/prompt';
import { checkUnderstanding, type Understanding } from './core/understanding';

export type Where = 'device' | 'cloud';

/** JSON Schema for both the on-device constraint and the cloud response. */
export const understandingJsonSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['quote', 'bill', 'problem', 'unknown'] },
    lines: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', maxLength: 120 },
          amount: { type: ['number', 'null'] },
          ref: { type: ['string', 'null'] },
        },
        required: ['label', 'amount', 'ref'],
      },
    },
    problemRef: { type: ['string', 'null'] },
    payee: { type: ['string', 'null'] },
    payTo: { type: ['string', 'null'] },
    urgent: { type: 'boolean' },
    addressedToAI: { type: 'boolean' },
  },
  required: ['kind', 'lines', 'problemRef', 'payee', 'payTo', 'urgent', 'addressedToAI'],
};

type LanguageModelGlobal = { availability?: (o?: unknown) => Promise<string> };

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' from Chrome's built-in model, if any. */
export async function deviceModelStatus(): Promise<string> {
  const lm = (globalThis as unknown as { LanguageModel?: LanguageModelGlobal }).LanguageModel;
  if (!lm?.availability) return 'unavailable';
  try {
    return await lm.availability({
      expectedInputs: [{ type: 'text' }, { type: 'image' }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  } catch {
    return 'unavailable';
  }
}

let deviceModel: GenerativeModel | undefined;
let cloudModel: GenerativeModel | undefined;

function model(where: Where): GenerativeModel {
  if (where === 'device') {
    deviceModel ??= getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: { expectedInputs: [{ type: 'text' }, { type: 'image' }] } as never,
        promptOptions: { responseConstraint: understandingJsonSchema },
      },
    });
    return deviceModel;
  }
  cloudModel ??= getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: understandingJsonSchema,
        temperature: 0.1,
      },
    },
  });
  return cloudModel;
}

export interface Reading {
  understanding: Understanding;
  where: Where;
  ms: number;
}

/** Read one photo. `where` is decided by the caller: device when ready, cloud only after the person agreed. */
export async function readPhoto(pack: Pack, image: Blob, question: string, where: Where): Promise<Reading> {
  const started = performance.now();
  const data = await blobToBase64(image);
  const result = await model(where).generateContent([
    { type: 'text', text: readPrompt(pack, question) },
    { type: 'inlineData', inlineData: { mimeType: image.type || 'image/jpeg', data } },
  ]);
  const raw = JSON.parse(result.response.text());
  const offered = new Set(menu(pack).map((m) => m.ref));
  return { understanding: checkUnderstanding(raw, offered), where, ms: Math.round(performance.now() - started) };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
