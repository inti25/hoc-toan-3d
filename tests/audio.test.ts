import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../src/audio/audio';

test('AudioManager instantiates and manages sound and music toggles safely without throwing', () => {
  const audio = new AudioManager();
  assert.equal(audio.enabled, true);

  audio.enabled = false;
  assert.equal(audio.enabled, false);

  // In Node environment (without Web Audio), playCue and music do not throw
  audio.playCue('correct');
  audio.playCue('celebrate');
  audio.playCue('hint');
  audio.playCue('jump');
  audio.music(true);
  audio.music(false);
});
