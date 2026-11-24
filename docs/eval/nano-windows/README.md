# Windows Chrome + Gemini Nano test screenshots

Screenshots from the Windows test runs in issue #1 (Chrome's built-in Gemini Nano, live web app).
Browser page area only. All papers are the fictional test sheets in `docs/test-sheets`.

## Round 1 (2026-11-24, Chrome 158.0.8127.89, live build dc0c167)

| File | What it shows |
|---|---|
| r1-01-computer-light-paper1.jpg | Paper 1 (bill-2 PDF) while it is read: computer light on, "Working on this computer..." |
| r1-02-paper1-answer-remember-company.jpg | Paper 1 answer: "Check this bill before you pay." with "Remember this company" |
| r1-03-q10-vacuum-wrong-guide.jpg | Question 10 (vacuum): unrelated guide "Top up windshield washer fluid", "Nothing left this computer." |
| r1-04-paper3-explain-spanish.jpg | Paper 3, Explain in my language, Spanish (on this computer); the last sentence adds a date that is not in the answer |
| r1-05-paper3-explain-zh-asks-first.png | Paper 3, Explain in my language, Traditional Chinese: asks before using the internet and shows the covered text |
| r1-06-paper3-explain-zh-result.jpg | Paper 3, Traditional Chinese explanation, "Checked online" |
| r1-07-internet-light-paper4.jpg | Paper 4 (bill-4 PDF): internet light on, the words on their way shown under it |
| r1-08-paper5-scam-read-as-quote.jpg | Paper 5 (bill-7 PNG): read as a repair quote ("Two lines cost more than usual."), then "Shall I remember this shop for next time?" |
| r1-09-what-the-lights-mean.jpg | "What the lights mean", opened by pressing the lights while paper 6 was read |

## Round 2 (2026-11-24, Chrome 158.0.8127.89, live build 72b8c3d)

| File | What it shows |
|---|---|
| r2-01-computer-light-paper1.jpg | Paper 1 while it is read: computer light on |
| r2-02-internet-light-paper4.jpg | Paper 4: internet light on with the company and charge names under it |
| r2-03-paper3-explain-spanish.jpg | Paper 3, Explain in my language, Spanish: no numbers now |
| r2-04-paper5-png-second-run.jpg | Paper 5 (bill-7 PNG), second run: "Don't pay this bill yet." and the online scam check, but no sums check |
| r2-05-bill7-pdf-extra-null-payee.jpg | Extra: bill-7 as PDF: "The numbers on this bill don't add up" and the scam check, with "I have no note of paying null before." |
| r2-06-paper6-run4-row3-misread-remember-prompt.jpg | Paper 6 run 4: amounts right, names with row numbers, line 3 named from other text, and the "remember this shop" prompt |
| r2-07-q10-internet-light.jpg | Question 10: checked online, the sentence shown under the internet light |
| r2-08-q11-only-the-vacuum-sentence.jpg | Question 11: only "My vacuum won't pick anything up." under the internet light |

## Round 3 (2026-11-24, Chrome 158.0.8127.89, live build 7c5ae84)

| File | What it shows |
|---|---|
| r3-01-paper5-png-numbers-dont-add-up.jpg | Paper 5 (bill-7 PNG, paste), run 1: "The numbers on this bill don't add up" and the online scam check |
| r3-02-bill7-pdf-payee-is-the-bank.jpg | bill-7 PDF: payee read as "Thistlewick Savings Bank" (the bank in the remittance box), not the letterhead |
| r3-03-paper6-run3-rows.jpg | Paper 6 run 3: clean names; line 8 read as "Shops, repair, hardware $6.50"; "3 items not checked" |
| r3-04-paper3-explain-spanish-placeholders.jpg | Paper 3, Spanish: a faithful translation, shown with `"""` marks and [cuenta] / [número] placeholders |

## Round 4 (2026-11-24, Chrome 158.0.8127.89, live build 3c610f4)

| File | What it shows |
|---|---|
| r4-01-paper6-run2-rushes-you-row8.jpg | Paper 6 run 2: bold line "Check this before you pay." with "It rushes you to pay.", line 8 read as "Shop repairs, hardware $6.50" |
| r4-02-paper3-explain-spanish.jpg | Paper 3, Spanish: sentence by sentence, with 7730 and 4821, no quotation marks |

## Round 5 (2026-11-24, Chrome 158.0.8127.89, live build e18847b)

| File | What it shows |
|---|---|
| r5-01-paper6-same-every-run.jpg | Paper 6 run 3 (runs 1-3 identical): lines 1-8 from the price book, line 4 high, line 9 below usual, line 10 looked up |

## Round 5, clean start (2026-11-24, after Settings > Delete my data, live build c8a8704)

| File | What it shows |
|---|---|
| r5c-01-clean-paper6-line10-not-checked.jpg | Paper 6 after Delete my data: same ten lines every run, line 10 "Not checked yet" and no online lookup or ask |
| r5c-02-clean-first-online-ask-paper5.jpg | Paper 5 after Delete my data: the first-time "Check this online?" ask |

## Round 6 (2026-11-24, live build d76b586)

| File | What it shows |
|---|---|
| r6-01-clean-paper6-one-time-internet-ask.jpg | Paper 6 after Delete my data: "When this computer can't answer, may I use the internet?" for line 9 |
| r6-02-clean-paper6-line10-fair.jpg | Paper 6 after Delete my data: line 9 not checked, line 10 "Fair" (matched to "Clean a dryer vent") |
| r6-03-never-setting-q10.jpg | Use the internet = Never: question 10 answers "I don't know that one yet ... You set WeKnow to answer only from this computer" |
| r6-04-simulated-offline-q10.jpg | Simulated offline (page told it is offline, its network requests blocked): question 10, "No internet" in the top bar |
