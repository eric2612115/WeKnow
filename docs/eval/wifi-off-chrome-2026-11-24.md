# Wi-Fi off: Gemini Nano in Chrome answers from the computer alone (2026-11-24)

Chrome 158 on a Windows PC with Gemini Nano available, live build 35b4d67, knowledge pack us-home 2026-11-16.bbc297fe,
"Use the internet" set to "When it helps". Full report: [issue #1, round 8](https://github.com/eric2612115/WeKnow/issues/1#issuecomment-7136789941);
screenshots `r8-*` in [pull request #2](https://github.com/eric2612115/WeKnow/pull/2).

## How it was run

- Four tabs were opened while online. Three had been used once; the fourth was a fresh page that had never loaded the
  price book.
- A small logger in each page recorded every network request and the browser's `offline` and `online` events.
- The Wi-Fi was turned off by hand (`offline` 15:38:23 UTC, `online` 15:39:27 UTC), and Send was pressed in each tab
  while it was off.

## What came back

| Tab | Paper or question | Answer | Requests while offline |
|---|---|---|---|
| 1 | [`bill-3-electric-new-account-buried`](../test-sheets/) | Stop. It asks you to pay a new account ending 7730; you paid them at one ending 4821 before (from the notes on this computer); it rushes you. Tagged "No internet. Answered on this computer." 11.2 s | None for the answer |
| 2 | [`quote-1-auto-one-high`](../test-sheets/), ten lines | Careful. Line 4 is $185 above the usual top price; lines 1-3 and 5-9 are fair; line 10 is below usual, from a price looked up online earlier and kept on the computer. 9 price-book sources listed. 16.4 s | None |
| 3 | A typed question the price book does not cover | "This one needs the internet, and this computer has no connection right now. Ask me again when it is back." | None |
| 4 | The same quote, on a page that had never loaded the price book | The same answer as tab 2, word for word. 7.3 s | The settings and catalog requests failed; the price-book files came from the computer's own copy, 0 bytes fetched |

Every answer was read and decided on the computer while the network was off.
