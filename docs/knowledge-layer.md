# The knowledge layer

WeKnow answers only from sourced knowledge packs, and the model may only pick among pack items it was offered.
This document describes how a pack is built, stored on the device, searched, and updated. Code:
`web/src/core/{text,lexicon,bloom,searchIndex,packFormat,packBuild,knowledge,budget}.ts`, the builder
`scripts/build-pack.mjs`, the browser adapter `web/src/knowledgeBrowser.ts`.

## 1. What others already do (survey, 2026-11-16)

The problem is old: search a large static collection on a device, offline, downloading as little as possible, and
update it in small pieces. We looked at client-side search libraries, static-site search that splits its index,
offline map and encyclopedia formats, database-in-the-browser options, and on-device embeddings. Sizes are
minified + gzipped JavaScript or the file sizes shown, measured or read on 2026-11-16.

| Option | What it is | Runtime size | License | Offline / incremental | Fits our budgets? |
|---|---|---|---|---|---|
| [MiniSearch](https://github.com/lucaong/minisearch) 7.2.0 | In-memory full-text index, BM25+ ranking, prefix and fuzzy match, field boosts, `processTerm` may return several terms, `toJSON`/`loadJS` serialisation, `add`/`discard`/`replace` | 5.9 KB | MIT | Serialised indexes load without re-tokenising; documents can be added and discarded at any time | **Yes.** Smallest runtime; exactly the per-shard engine we need |
| [FlexSearch](https://github.com/nextapps-de/flexsearch) 0.8.212 | Fast index with "contextual" slot scoring (not BM25), IndexedDB persistence | 10.7–17.7 KB | Apache-2.0 | export/import; persistent IndexedDB adapter | Bytes yes; its scoring is tuned for long text, not short quote lines |
| [Lunr](https://github.com/olivernn/lunr.js) 2.3.9 | BM25 index, stemmers for 14 languages | 8.4 KB | MIT | Indexes are [immutable once built](https://lunrjs.com/guides/upgrading.html); no release since 2.3.9 | No: learned items could not join without a rebuild |
| [Orama](https://github.com/oramasearch/orama) 3.1.18 | BM25, typo tolerance, stemming in 30 languages, vector and hybrid search | 25.2 KB | Apache-2.0 | save/load of a whole database | Works, 4× MiniSearch. We use only its stemmers package (below) |
| [Pagefind](https://pagefind.app/docs/) 1.6.0 | Static-site search: index split into chunks loaded on demand, one fragment file per page, BM25-style [ranking knobs](https://pagefind.app/docs/ranking/), [Node API](https://pagefind.app/docs/node-api/) for custom records | 13.3 KB JS + 59.8 KB WASM per language (measured) | MIT | Content-hashed static files; rebuild per release | **The model we copy** (manifest → index chunks → fragments). The runtime itself is 12× MiniSearch, needs a native binary to build and WASM to test, has no per-field weights for custom records, and fetches one fragment per result |
| [tinysearch](https://github.com/tinysearch/tinysearch) | Static search in WASM; its optional `xor8` indexer keeps one probabilistic filter per article | small | Apache-2.0 | rebuild | The filter-per-unit idea we use for routing |
| [SQLite WASM](https://sqlite.org/wasm/doc/trunk/persistence.md) 3.54 + FTS5 | Full SQL with `bm25()` ranking | 408 KB WASM | Public domain / Apache-2.0 wrapper | OPFS persistence needs a Worker; the `opfs` VFS also needs COOP/COEP headers | No: 70× MiniSearch before any data, for a few hundred items |
| [sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs) | Reads a static SQLite file with HTTP range requests | as above | Apache-2.0 | Read-only; the author calls it a demonstration with an untested VFS | No |
| [wa-sqlite](https://github.com/rhashimoto/wa-sqlite) / [PGlite](https://github.com/electric-sql/pglite) 0.5.16 | SQLite or Postgres in WASM with IndexedDB/OPFS storage | PGlite ≈ 5 MB | MIT / Apache-2.0 | Yes | No: far over a phone's first-load budget |
| [Firestore data bundles](https://firebase.google.com/docs/firestore/bundles) | Prebuilt query results served from a CDN and loaded into Firestore's offline cache | Firestore SDK (already in the app) | Firebase | Yes; reads from a bundle are not billed per client | Not for the levels: we rank items ourselves, so a bundle adds the SDK's query layer and gains nothing. Useful pattern for the learned list |
| [PMTiles v3](https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md) (offline maps) | Header + root directory in the first 16 KiB, optional leaf directories, then tile data; the spec discourages more than one level of leaves | n/a (format) | open spec | Per-region downloads; immutable files | **Pattern adopted:** a small root fetched first, at most one more directory level, then data |
| [Kiwix ZIM](https://wiki.openzim.org/wiki/ZIM_file_format) (offline Wikipedia) | URL and title pointer lists, compressed clusters of articles, optional Xapian full-text index | n/a (format) | libzim GPL-2.0 | Whole-file updates | **Pattern adopted:** a title index separate from data clusters; we add per-file updates |
| [MediaPipe Text Embedder](https://developers.google.com/edge/mediapipe/solutions/text/text_embedder) | Sentence embeddings (Universal Sentence Encoder, EmbeddingGemma 300M) on web, Android, iOS | USE model 6.1 MB, BERT embedder 26.1 MB (measured), plus WASM runtime | Apache-2.0 | Model cached after download | Not now: 1,000× the index for lines that are mostly literal. The choose step's on-device LLM already does the semantic match among candidates |
| [transformers.js](https://huggingface.co/Xenova/all-MiniLM-L6-v2) + all-MiniLM-L6-v2 | ONNX embeddings in the browser | 23 MB (int8 model) | Apache-2.0 | Cached | No, same reason |
| [AI Edge RAG SDK](https://developers.google.com/edge/mediapipe/solutions/genai/rag/android) | On-device RAG pipeline: Gecko embedder + SQLite vector store | n/a | Apache-2.0 | Yes | Android only; WeKnow is web and iOS |

On-device model limits that bound every prompt: Chrome's [Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
(Gemini Nano) reports its window as `session.contextWindow` (about 9,216 tokens on current builds), needs 22 GB
free disk and more than 4 GB of VRAM, and accepts English, Japanese, Spanish, German and French. Apple's
on-device model has [4,096 tokens per session](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window),
shared by instructions, prompt and answer, at 3–4 characters per token in English.

**Choice.** Pagefind's architecture (a tiny manifest, index shards fetched on demand, data fragments) with
PMTiles' size discipline (the root fits one small first download) and ZIM's split of index from data clusters;
[MiniSearch](https://lucaong.github.io/minisearch/) (MIT, 5.9 KB) as the ranking engine inside each shard; Porter
stemming from [`@orama/stemmers`](https://www.npmjs.com/package/@orama/stemmers) (Apache-2.0, 0.8 KB for
English, the same API for 30 languages). The only code we wrote ourselves is the glue those libraries do not
cover: the file layout, a small Bloom filter for routing (a dependency would be larger than the code), the
loader with hash checks, and token budgeting. Where routing cannot be exact (a typo, a partial word, a question
made only of common words), the device searches one index over the whole kind instead, built at pack time: the
same answer one whole-pack index would give. Synonyms are expanded at query time, as
[Elastic recommends](https://www.elastic.co/docs/solutions/search/full-text/search-with-synonyms) for synonym
lists that change, so editing them never rewrites a shard.

## 2. Levels

```
catalog.json                       level 0  which packs exist; each one's current root          ~0.4 KB
us-home/root.<hash>.json           level 1  top index: one Bloom filter per shard (which words   10.5 KB (4.7 KB gzip)
                                            live where, plus "ref:<ref>" for every item)
                                            top map: shards, their blocks, sizes; the lexicon
us-home/s/<shard>.<hash>.json      level 2  shard index: MiniSearch BM25+ over names + aliases,  17 files, 72.8 KB (20.9 KB gzip)
                                            built at pack time
                                            shard map: ref -> name, data block, and for guides
                                            where their pro prices live
us-home/s/<kind>.all.<hash>.json   level 2  fallback: one index over every price (or every guide),  2 files, 70.1 KB (16.7 KB gzip)
                                            each item pointing at its shard and block; loaded only
                                            when routing cannot be exact
us-home/d/<shard>.<n>.<hash>.json  level 3  the data: prices, guides, steps, and every source     32 files, 372.7 KB (92.8 KB gzip)
```

A shard is one category and one kind (`plumbing.price`, `plumbing.guide`); a category above 400 items splits
into several shards, each with its own filter. Blocks are packed up to 16 KB of JSON in ref order. Every file
below the catalog is named by the first 16 hex digits of its SHA-256, so it never changes once published. The
builder also writes the same items as one file, `us-home.json` (427.5 KB, 77.8 KB gzip), for the current app
shell and the eval runner.

## 3. How a question walks the levels

1. **Open** (once per session): catalog + root, 5 KB over the wire. Nothing else. Every file, from the network
   or from the device's own copy, is checked against the hash in its name before it is used.
2. **Candidates** for a printed line, e.g. `R&R front pads & rotors`:
   - text pipeline: rewrite `r&r` → `replace`; words; drop stop words; Porter stems
     → `replac front pad rotor`; synonyms add `frt`, `brake disc`, `brake disk` at weight 0.6;
   - **route** with the root's filters: a shard scores Σ ln(1 + S / cf(t)) over the query terms its filter holds
     (cf = how many shards hold the term, so a word found everywhere counts little). Shards scoring at least half
     the best are loaded, at most 3. Here: `car-service.price` and `locksmith.price` ("front door");
   - **search** each loaded shard with BM25+ (name ×2, aliases ×1, synonym terms ×0.6, one typo per five
     letters for words of six letters or more, prefix match for words of four or more);
   - **fall back** to the whole-kind index when more than 3 shards score close to the best (a line of common words
     such as "Replace"), or when a printed word of four letters or more matched nothing in the routed shards: a
     typo ("altenrator"), the start of a longer word ("refrig"), or a filter's 1% "maybe". Filters only know whole
     words, so this is what keeps typo and prefix matching as good as one whole-pack index;
   - merge, drop anything under 20% of the best score, keep 5. Here: `brake-pads-rotors`, then `brake-pads`.
3. **Choose**: the on-device model picks one ref per line or null (reader.ts stage C). Stage B first caps the
   reading at 30 lines of 120 characters, then `core/budget.ts` trims until the prompt fits: options beyond 3,
   labels to 60 characters, options beyond the best one, labels to 32 and then 16 characters, and only then lines.
4. **Resolve** the chosen refs: the shard map says which block holds each item, and for a guide where its pro
   prices live, so only those blocks load. Any ref can also be resolved cold: the root's filters hold
   `ref:<ref>`, which finds its shard without a search.

## 4. Budgets and measured numbers

`node scripts/bench-pack.mjs` (files served from memory, so times are device-side work: parsing, hash checks,
search; a laptop, expect 5–10× on an old phone):

| Query, cold start | Raw bytes loaded (median / max) | Gzip on the wire (median / max) | Index files / blocks (median) | Time cold (median) | Warm, per line | Choose prompt (median / max tokens) |
|---|---|---|---|---|---|---|
| A quote photo, all its lines (25 eval quotes; 11 used the fallback index) | 75 / 129 KB | 19.5 / 30.1 KB | 4 / 3 | 2.2 ms | 0.14 ms | 412 / 941 |
| One shop-printed line (44 hand-written; 8 used it) | 26 / 82 KB | 9.2 / 19.6 KB | 1 / 1 | 0.8 ms | 0.08 ms | 131 / 299 |
| One household problem (30 hand-written; 11 used it) | 43 / 72 KB | 13.6 / 22.0 KB | 2 / 2 | 1.1 ms | 0.12 ms | 151 / 243 |

Eval quotes use the fallback index for lines the pack does not cover ("Shop supplies", "Diagnostic labor"); a
household problem is a sentence, and words such as "slowly" are in no index.

Typo and prefix tolerance, on every price whose name has a word of six letters or more (150 cases; test
"the layered pack finds typo and prefix queries at least as well as one whole-pack index"):

| Query | Layered, before the fallback | Layered now | One whole-pack index |
|---|---|---|---|
| The name with two letters swapped in its longest word | 145 | **150** | 150 |
| That misspelled word alone | 0 | **22** | 22 |
| The first six letters of that word | 29 | **75** | 75 |

Token budgets for the choose prompt (`core/budget.ts`). No tokenizer for either model ships to the web, so the
count is pessimistic: every digit and every symbol is a token (the Gemini family's tokenizers split numbers into
digits), letters count one token per 2.5 characters (Apple documents 3–4), and any non-ASCII character is a token.

| Model | Context | Left for the choose prompt | Eval quotes | Worst case: 30 lines × 120 characters (letters, shop text, or all digits) × 5 longest names |
|---|---|---|---|---|
| Chrome Gemini Nano | ~9,216 | 6,000 (after schema, 30 answers, margin) | ≤ 941 tokens, untrimmed | trimmed to fit, all 30 lines kept with their best option |
| Apple on-device | 4,096 | 2,400 | ≤ 941 tokens, untrimmed | trimmed to fit, all 30 lines kept with their best option |

Stage A's prompt holds no pack data at all, so pack growth never touches it. Size limits enforced by tests: root
≤ 16 KiB gzip (the PMTiles rule), each shard ≤ 64 KiB gzip, each block ≤ 16 KB unless it holds one item.

**At scale.** Bloom filters cost ~10 bits per distinct word per shard and do not compress. Projected for ~5,000
items: filters ~25 KB, block lists ~24 KB; the root would pass its 16 KiB budget (the test fails first). The next
two steps, in order: move each shard's block list into its shard file, then add one directory level between root
and shards (PMTiles' leaf directories: the root keeps one filter per category, the category directory keeps the
shard filters). Nothing else changes.

## 5. Storage: where each level lives, and why

| Level | Where | Why |
|---|---|---|
| 0 catalog | Hosting, `Cache-Control: no-cache` (revalidated, a 304 when unchanged); last copy in Cache Storage | The only mutable file; tiny |
| 1 root | Hosting, `public, max-age=300`; Cache Storage on the device (`weknow-packs-v1`) | Content-hashed; kept short in browsers on request, it costs one revalidation at most |
| 2–3 | Hosting, `public, max-age=300, s-maxage=31536000`; Cache Storage on the device | Content-hashed. The CDN keeps them until the next deploy (Hosting clears the CDN on every deploy). Browsers keep a response at most 5 minutes, because header rules match paths, not status: a 404 for a pack path gets the same header, and must not stick (checked in the Hosting emulator). The device keeps its own verified copy in Cache Storage, so it does not depend on the browser's HTTP cache. No sign-in needed before the first answer; no per-document reads against the Spark plan's daily quota. Cache Storage works in the page and in a future service worker and lets the loader work offline without one |
| learned list (shared) | Firestore, one document `packs/{packId}` field `learned` | Changes between pack builds; one read per session; Firestore's persistent cache serves it offline; clients can only read it (`firestore.rules`, tested in `web/rules-test`) |
| learned (this device) | Cache Storage, `/packs/<pack>/learned.json` | A price found by this person's own cloud lookup, never shared automatically |

Missing pack files are real 404s: the single-page-app rewrite in `firebase.json` excludes `/packs/**`, so Hosting
never answers a missing pack file with `index.html` (checked in the local Hosting emulator: a missing shard, block
or root returns 404 with `max-age=300`, while app routes still get `index.html`).

Not chosen for the levels: Firestore documents (billed per read, each shard a read, slow queries over thousands of
cached documents, sign-in before first use), IndexedDB directly (Cache Storage does the same for whole files with
less code), SQLite/PGlite in WASM (runtime cost, section 1).

## 6. Versions and updates

- **Version** = the newest source date plus a content hash (`2026-11-16.1f335f17`). Rebuilding unchanged data
  produces byte-identical files.
- **Delta updates.** A new release changes the catalog, the root, and only the files whose bytes changed.
  Editing one price rewrites one block and the root; editing a name or alias also rewrites that shard and its
  kind's fallback index; editing the lexicon rewrites only the root. The device revalidates the catalog, fetches the new root, and fetches changed
  shards or blocks only when a question needs them (or all of them in `prefetch`). Unchanged files are cache hits
  under the same names. `gc()` then deletes files the new root no longer names.
- **Remote Config.** `pack_id` picks the pack per region or language (conditions); `pack_root` pins a root for a
  staged rollout while its files are served, and the loader falls back to the catalog if they are not. The main
  rollback is a Hosting rollback, which restores the previous catalog and files together.
- **After a deploy**, a device holding the old root may ask for a file that is gone and get a 404. The loader asks
  once more past the HTTP cache (`cache: 'reload'`, in case the browser kept an old answer), then re-reads the
  catalog once, adopts the new root and retries. A body that does not match its hash is handled the same way.
- **Only hashed roots** are accepted, including a root pinned in Remote Config, so nothing unverified loads. The
  root records the search engine version (`minisearch@7.2.0`); an app with a different engine refuses the pack
  rather than misread it (the dependency is pinned exactly).

## 7. Offline

After one session the files it used are on the device, and the same questions work with no network (test:
"after one session, the same questions work with no network at all"). A device copy is checked against its hash on
every read: a copy edited or damaged after download (test: a cached price changed from 700 to 7000) is deleted
and fetched again online, and refused offline; it is never shown. A shard that was never downloaded is
reported in `stats().unavailable` and the question is answered from what is there; nothing throws. With nothing
downloaded and no network, opening says so (`KnowledgeUnavailableError`), and the app can explain it.
`prefetch(true)` downloads the whole pack (135 KB gzip today, fallback indexes included) for "keep it all offline", like downloading a map
region.

## 8. Regions and languages

The catalog lists one pack per region and language (`us-home`, later `uk-home`, `de-home`); `PackSpec`
(`core/packSpecs.ts`) sets currency, allowed categories and the lexicon. A lexicon carries its stemmer name, stop
words, rewrites and synonyms, and the root embeds it, so a pack is self-describing; adding a language means a
lexicon file and a stemmer import from `@orama/stemmers/<language>`. Prices are per region; guides can be shared
across regions of one language by listing the same `packs-src` file in several specs. Scripts without spaces
between words (Chinese, Japanese) need a character-bigram tokenizer (the approach of Lucene's CJK analyzer) before
those packs can ship; Fair Quote already holds `zh-TW` names and a Taiwan price book. Chrome's Nano does not accept
Chinese prompts today, so such packs would be read in the cloud or by Apple's model.

## 9. Learned items

A learned price is one a cloud lookup found, with web sources, for a line the pack did not know
(`web/src/lookup.ts`). It joins an overlay index on the device; every path refuses it without a `learned-` ref,
an ordered range and https sources (`assertLearnable`, the same rule as `learn` in `packs.ts`). Its tiny index
cannot give BM25 scores comparable with a shard's, so it is offered when it covers at least half of the printed
words, at most two per line, and the UI can say it was found online. Shared learned prices go through review:
`scripts/seed-learned.mjs` validates (sources, ranges, refs not already in the pack, no personal data) and writes
the list to Firestore; the next pack build moves them into `packs-src/` with their sources and they leave the list.

## 10. Tests and benchmark

`cd web && npm test` runs, among others:

- `knowledge.test.ts`: opening loads levels 0–1 only; a quote line loads ≤ 3 price shards and no data; a problem
  loads guide shards only; resolving loads only the chosen blocks and the guide's pro prices; every ref resolves
  cold and unchanged; every item is top-5 for its own name; any alias unique to an item finds it (property);
  shop noise around a name does not lose it (property); recall@5 on the 71 labelled eval lines is 100%; recall@5
  on 44 hand-written shop labels and 30 household problems is 100%; sharded ranking agrees with one whole-pack
  index on ≥ 97% of top-1 results (99.1% measured); typo and prefix queries do at least as well as one whole-pack
  index; any input (undefined, numbers, emoji, 5,000 characters, random text as a property) never throws;
  offline; device copies re-hashed on every read (700 → 7000); stale HTTP 404 asked again with reload; delta
  update; stale-root recovery; pinned and unhashed roots; engine mismatch refused; learned items.
- `packBuild.test.ts`: refuses unsourced items, http sources, duplicate refs, unknown pro refs, bad ranges,
  foreign categories, reserved refs (and a property: removing any item's sources stops the build); random valid
  packs resolve every ref; identical input gives identical bytes; one edit changes only its own category's files
  and the root (property); the shipped files equal a fresh build; every index term and ref passes its shard's
  filter (no false negatives, 1,000+ terms); one fallback index per kind; size budgets.
- `budget.test.ts`: digits and symbols count one token each, never more optimistic than 3 characters per token
  (property); readings capped at 30 lines of 120 characters; every eval quote fits the Apple budget untrimmed; the
  worst case (letters, shop text, all digits) fits both budgets with every line kept; fitting never exceeds a
  budget and only shortens lists and labels from the end (property).

`node scripts/bench-pack.mjs [--json out.json]` prints section 4.

## 11. Operating it

```bash
# 1. Build the pack (after editing packs-src/*.json or the Fair Quote data). It refuses unsourced items.
node scripts/build-pack.mjs
# 2. Check and build the app.
cd web && npm test && npx tsc -b && npm run build && cd ..
node scripts/bench-pack.mjs                       # optional: bytes and times
# 3. Deploy the pack files with their cache headers (firebase.json), then the Remote Config template
#    (adds pack_id and pack_root; publishing the template replaces values edited in the console).
web/node_modules/.bin/firebase deploy --only hosting --project weknow-6092f
web/node_modules/.bin/firebase deploy --only remoteconfig --project weknow-6092f
# Firestore rules are unchanged by the knowledge layer; no rules deploy is needed for it.
```

Publishing reviewed learned prices (optional, only when there are some):

```bash
node scripts/seed-learned.mjs learned.json                      # dry run: validates and prints
FIRESTORE_TOKEN=$(gcloud auth print-access-token) node scripts/seed-learned.mjs learned.json --live
```

Using the layered pack in the app (one place, where the app now loads `us-home.json`):

```ts
const s = await settings();
const kb = await openBrowserKnowledge({ packId: s.packId, root: s.packRoot }); // web/src/knowledgeBrowser.ts
const reading = await readPhoto(kb, photo, question, where);
// verdicts and guides from the items this reading resolved, each with its sources:
quoteVerdicts(reading.understanding, reading.pack); guideByRef(reading.pack, ref); proPrice(reading.pack, guide);
```
