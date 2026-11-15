// The packs WeKnow builds. One entry per region and language; the builder and the tests read the same spec.

import { LEXICON_EN } from './lexicon.ts';
import type { Lexicon } from './text.ts';

export interface PackSpec {
  id: string;
  region: string;
  language: string;
  currency: string;
  origin: string;
  /** Categories this pack may hold; anything else is refused at build time. */
  categories: string[];
  lexicon: Lexicon;
}

export const US_HOME: PackSpec = {
  id: 'us-home',
  region: 'US',
  language: 'en',
  currency: 'USD',
  origin:
    'Built from the Fair Quote price book and DIY guides (pre-existing work by the same author, disclosed in README) and hand-researched guides in packs-src/.',
  categories: ['plumbing', 'appliance', 'electrical', 'home', 'device', 'cleaning', 'car-service', 'car-body', 'locksmith'],
  lexicon: LEXICON_EN,
};
