#!/usr/bin/env node
// Generates the labeled development audio fixture: a 30-second
// soft two-tone chord with fade in/out, written as a plain PCM WAV file.
// This is explicitly a development fixture — never a substitute for a
// licensed, real audio source.
import { mkdirSync, writeFileSync } from 'node:fs';

const seconds = 30;
const rate = 22050;
const count = seconds * rate;

const data = Buffer.alloc(count * 2);
for (let i = 0; i < count; i++) {
	const t = i / rate;
	const envelope = Math.max(0, Math.min(1, t / 0.5, (seconds - t) / 0.5));
	const sample =
		0.22 * Math.sin(2 * Math.PI * 220 * t) + 0.18 * Math.sin(2 * Math.PI * 330 * t);
	data.writeInt16LE(Math.round(sample * envelope * 16384), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // PCM chunk size
header.writeUInt16LE(1, 20); // PCM format
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

mkdirSync('static/fixtures', { recursive: true });
writeFileSync('static/fixtures/dev-tone-30s.wav', Buffer.concat([header, data]));
console.log(`Wrote static/fixtures/dev-tone-30s.wav (${36 + data.length} bytes, ${seconds}s @ ${rate}Hz mono)`);
