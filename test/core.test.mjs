import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChord, transposeChord } from '../public/js/music.js';
import { getChord, chordKey, fretsKey } from '../public/js/chords.js';
import { parseSong, convertChordsOverLyrics } from '../public/js/chordpro.js';
import { detectPitch } from '../public/js/pitch.js';

test('reconnaissance des accords', () => {
  for (const c of ['C', 'Am7', 'F#m', 'Bb', 'D/F#', 'Gsus4', 'Cmaj7']) assert.ok(isChord(c), c);
  for (const c of ['Be', 'Add', 'Dim', 'La', 'x2']) assert.ok(!isChord(c), c);
});

test('transposition', () => {
  assert.equal(transposeChord('Am7', 2), 'Bm7');
  assert.equal(transposeChord('D/F#', 3), 'F/A');
  assert.equal(transposeChord('C', -2, true), 'Bb');
});

test('doigtés', () => {
  assert.deepEqual(getChord('C').voicings[0].frets, [null, 3, 2, 0, 1, 0]);
  assert.deepEqual(getChord('F').voicings[0].frets, [1, 3, 3, 2, 1, 1]);
  assert.deepEqual(getChord('Bm').voicings.find((v) => v.barre).frets, [null, 2, 4, 4, 3, 2]);
  assert.equal(getChord('A').voicings[0].barre, null);
  assert.equal(getChord('Xyz'), null);
  assert.ok(getChord('Am/G').voicings.length);
});

test('notations A2 / E4 et accords étendus', () => {
  assert.deepEqual(getChord('A2').voicings[0].frets, [null, 0, 2, 2, 0, 0]);
  assert.deepEqual(getChord('E4').voicings[0].frets, [0, 2, 2, 2, 0, 0]);
  assert.deepEqual(getChord('A5').voicings[0].frets, [null, 0, 2, 2, null, null]);
  assert.equal(getChord('A2').approx, false);
  const a11 = getChord('A11');
  assert.equal(a11.approx, true);
  assert.ok(a11.voicings.length);
  assert.ok(getChord('F#m7b5').voicings.length);
});

test('position préférée : passe en premier, clé partagée par les alias', () => {
  assert.equal(chordKey('A2'), chordKey('Asus2'));
  const second = getChord('Bm').voicings[1];
  const chord = getChord('Bm', { [chordKey('Bm')]: fretsKey(second) });
  assert.deepEqual(chord.voicings[0].frets, second.frets);
  assert.equal(chord.preferred, true);
  assert.equal(getChord('Bm').preferred, false);
});

test('ChordPro', () => {
  const s = parseSong('{title: T}\n{c: Refrain}\nA[Am]mazing [G]grace\n[Intro]\n');
  assert.equal(s.meta.title, 'T');
  assert.equal(s.lines[0].text, 'Refrain');
  assert.deepEqual(s.lines[1].segs, [{ chord: null, text: 'A' }, { chord: 'Am', text: 'mazing ' }, { chord: 'G', text: 'grace' }]);
  assert.equal(s.lines[2].type, 'section');
});

test('accords au-dessus des paroles', () => {
  const out = convertChordsOverLyrics('Am      G\nHello world\n\nC F\n');
  assert.equal(out.split('\n')[0], '[Am]Hello wo[G]rld');
  assert.ok(out.includes('[C] [F]'));
});

test('YIN détecte 110 Hz', () => {
  const sr = 44100;
  const buf = new Float32Array(4096).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 110 * i) / sr));
  assert.ok(Math.abs(detectPitch(buf, sr) - 110) < 0.5);
  assert.equal(detectPitch(new Float32Array(4096), sr), null);
});
