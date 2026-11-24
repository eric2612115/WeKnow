import { describe, expect, it } from 'vitest';
import { pickVoice } from '../voice';

const v = (name: string, lang: string, localService = true, isDefault = false) =>
  ({ name, lang, localService, default: isDefault, voiceURI: name }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
  it('skips the novelty and robotic voices macOS lists first', () => {
    const mac = [v('Albert', 'en-US'), v('Bad News', 'en-US'), v('Bubbles', 'en-US'), v('Daniel', 'en-GB'), v('Eddy (English (US))', 'en-US'), v('Samantha', 'en-US')];
    expect(pickVoice(mac, 'en-US')?.name).toBe('Samantha');
  });

  it('prefers a voice on the device to one online, and the same region', () => {
    const win = [v('Google US English', 'en-US', false), v('Microsoft George - English (United Kingdom)', 'en-GB'), v('Microsoft Zira - English (United States)', 'en-US')];
    expect(pickVoice(win, 'en-US')?.name).toBe('Microsoft Zira - English (United States)');
  });

  it('reads Traditional Chinese with a Taiwan voice, and gives none for a language it lacks', () => {
    const zh = [v('Tingting', 'zh-CN'), v('Meijia', 'zh-TW'), v('Samantha', 'en-US')];
    expect(pickVoice(zh, 'zh-Hant')?.name).toBe('Meijia');
    expect(pickVoice(zh, 'ja-JP')).toBeNull();
  });
});
