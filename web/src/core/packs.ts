// Knowledge packs: sourced data the answers must come from.
// The model may only point at an item by `ref`; every number shown to the user comes from here.

export interface Source {
  url: string;
  title?: string;
  quote?: string;
  fetched?: string;
}

export interface PriceItem {
  ref: string;
  category?: string;
  name: string;
  aliases: string[];
  unit: string;
  low: number;
  typical: number;
  high: number;
  includes?: string;
  sources: Source[];
}

export interface Guide {
  ref: string;
  category?: string;
  name: string;
  aliases: string[];
  minutes: [number, number];
  difficulty?: number;
  steps: string[];
  safety?: string[];
  stopIf?: string[];
  proRefs?: string[];
  sources: Source[];
}

export interface Pack {
  id: string;
  version: string;
  region: string;
  currency: string;
  prices: PriceItem[];
  guides: Guide[];
}

export function priceByRef(pack: Pack, ref: string): PriceItem | undefined {
  return pack.prices.find((p) => p.ref === ref);
}

export function guideByRef(pack: Pack, ref: string): Guide | undefined {
  return pack.guides.find((g) => g.ref === ref);
}

/** The menu offered to the model: refs and names only, never prices. */
export function menu(pack: Pack): Array<{ ref: string; name: string; aliases: string[] }> {
  return [
    ...pack.guides.map(({ ref, name, aliases }) => ({ ref, name, aliases })),
    ...pack.prices.map(({ ref, name, aliases }) => ({ ref, name, aliases })),
  ];
}

/** Add an item learned from a cloud lookup. It must carry a source, or it is refused. */
export function learn(pack: Pack, item: PriceItem): Pack {
  if (!item.sources.length || !item.sources.every((s) => /^https:\/\//.test(s.url))) {
    throw new Error(`refused to learn ${item.ref}: every learned price needs an https source`);
  }
  if (priceByRef(pack, item.ref)) return pack;
  return { ...pack, prices: [...pack.prices, item] };
}

/** A pro price for a guide, from the price items it points to. */
export function proPrice(pack: Pack, guide: Guide): { low: number; high: number } | undefined {
  const items = (guide.proRefs ?? []).map((r) => priceByRef(pack, r)).filter((p): p is PriceItem => !!p);
  if (!items.length) return undefined;
  return { low: Math.min(...items.map((i) => i.low)), high: Math.max(...items.map((i) => i.high)) };
}
