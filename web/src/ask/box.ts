// What is in the question box at the bottom of Ask: the words typed or heard so far. It lives outside React so the
// flows (the microphone fills it), the sample pictures (they put their question in it) and Space can reach it.

import { createStore, useStore } from '../store/store';

export const boxStore = createStore('');
export const useBox = () => useStore(boxStore);
export const boxText = () => boxStore.get();
export function setBox(text: string) {
  boxStore.set(text);
}
/** Add heard words after what is already typed. */
export function addToBox(text: string) {
  const cur = boxStore.get().trimEnd();
  boxStore.set(cur ? `${cur} ${text}` : text);
}

let focus: () => void = () => undefined;
/** The page tells the box how to take the cursor. */
export function setBoxFocus(fn: () => void) {
  focus = fn;
}
/** Put the cursor in the box (after "Type instead"). */
export function focusBox() {
  // After the choice that asked for it has gone from the screen, so nothing takes the focus back.
  requestAnimationFrame(() => focus());
}
