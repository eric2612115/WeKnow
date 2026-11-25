// A follow-up about what was just said ("Why is that a scam?", "What does line 4 mean?"): answered by the model on
// this device (Gemini Nano in Chrome, through Firebase AI Logic) from the conversation so far. Nothing leaves the
// device here, so the conversation is given as the person saw it. The model may explain; it never decides: plain code
// (ask/flows.ts) keeps the verdict, and drops a reply that brings a number of its own or clears a warning.

import { getGenerativeModel, InferenceMode } from 'firebase/ai';
import { ai } from './firebase';
import { unwrapQuotes } from './explain';

export function threadPrompt(conversation: string, question: string): string {
  return `You are WeKnow, a careful helper that checks bills and quotes before people pay.
Below is the conversation so far. Answer the person's new question in one to three short, plain sentences, using
only what the conversation says, and give WeKnow's reasons in your own words. Read the numbers carefully: what the shop
or company charges is not the same as how much above the usual price it is. If the conversation does not answer the question,
do not guess yes or no: say you can't tell from this check, and suggest asking the shop or the company. Never say a bill is safe to pay or that a warning was wrong. Say which warning signs WeKnow found; call it a scam only if WeKnow did. Do not bring
any number that is not in the conversation. Answer in the language of the question. Give only the answer.

Two examples of the style only (use the reasons in this conversation, not these):
Question: Why is that line so high?
Answer: Because the shop charges much more for that job than most shops do. Ask them what the extra covers.
Question: What does past due mean?
Answer: It means the date to pay has passed and the money has not arrived yet.

Conversation so far:
${conversation}

New question: ${question}`;
}

export async function askAboutThread(conversation: string, question: string): Promise<{ text: string; ms: number }> {
  const t0 = performance.now();
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: { createOptions: { expectedInputs: [{ type: 'text' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] } as never },
  });
  const res = await model.generateContent(threadPrompt(conversation, question));
  return { text: unwrapQuotes(res.response.text()).slice(0, 700), ms: Math.round(performance.now() - t0) };
}
