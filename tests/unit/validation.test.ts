import { describe, expect, test } from 'vitest';
import {
	audioInputSchema,
	escapeLike,
	optionalHttpsUrl,
	slugSchema,
	tagsField,
	videoInputSchema,
	youtubeIdSchema,
	passwordSchema
} from '../../src/lib/server/validation';

describe('slug validation', () => {
	test('accepts clean slugs', () => {
		expect(slugSchema.safeParse('hello-world-1').success).toBe(true);
		expect(slugSchema.safeParse('dev-example-insight').success).toBe(true);
	});
	test('normalizes case and whitespace, rejects spaces, underscores, edge hyphens', () => {
		const normalized = slugSchema.safeParse('  Hello  ');
		expect(normalized.success).toBe(true);
		if (normalized.success) expect(normalized.data).toBe('hello');
		expect(slugSchema.safeParse('has space').success).toBe(false);
		expect(slugSchema.safeParse('under_score').success).toBe(false);
		expect(slugSchema.safeParse('-lead').success).toBe(false);
		expect(slugSchema.safeParse('trail-').success).toBe(false);
		expect(slugSchema.safeParse('double--dash').success).toBe(false);
	});
	test('rejects reserved slugs', () => {
		expect(slugSchema.safeParse('admin').success).toBe(false);
		expect(slugSchema.safeParse('search').success).toBe(false);
		expect(slugSchema.safeParse('watch').success).toBe(false);
	});
	test('rejects too-short and too-long slugs', () => {
		expect(slugSchema.safeParse('ab').success).toBe(false);
		expect(slugSchema.safeParse('a'.repeat(81)).success).toBe(false);
	});
});

describe('YouTube ID validation', () => {
	test('accepts an 11-character ID', () => {
		expect(youtubeIdSchema.safeParse('aqz-KE-bpKQ').success).toBe(true);
	});
	test('rejects wrong lengths and junk', () => {
		expect(youtubeIdSchema.safeParse('aqz-KE-bpK').success).toBe(false);
		expect(youtubeIdSchema.safeParse('aqz-KE-bpKQQ').success).toBe(false);
		expect(youtubeIdSchema.safeParse('hello world').success).toBe(false);
		expect(youtubeIdSchema.safeParse('https://youtu.be/aqz-KE-bpKQ').success).toBe(false);
	});
});

describe('tags field', () => {
	test('splits, trims, and drops empties', () => {
		expect(tagsField.parse('a, b ,c,')).toEqual(['a', 'b', 'c']);
	});
	test('caps at 8 tags and 40 characters each', () => {
		const parsed = tagsField.parse(
			'1,2,3,4,5,6,7,8,9,10,' + 'x'.repeat(60)
		);
		expect(parsed).toHaveLength(8);
		expect(parsed[7].length).toBeLessThanOrEqual(40);
	});
});

describe('media source and URL fields', () => {
	test('optional https URL accepts empty and https, rejects http and junk', () => {
		expect(optionalHttpsUrl.safeParse('').success).toBe(true);
		expect(optionalHttpsUrl.safeParse('https://cdn.example/a.mp3').success).toBe(true);
		expect(optionalHttpsUrl.safeParse('http://cdn.example/a.mp3').success).toBe(false);
		expect(optionalHttpsUrl.safeParse('not a url').success).toBe(false);
	});
	test('audio source accepts https URLs and root-relative paths, rejects protocol-relative', () => {
		const base = {
			title: 'Episode Title',
			slug: 'valid-slug',
			description: '',
			audioSourceUrl: ''
		};
		expect(audioInputSchema.safeParse({ ...base, audioSourceUrl: 'https://ok.example/a.wav' }).success).toBe(true);
		expect(audioInputSchema.safeParse({ ...base, audioSourceUrl: '/fixtures/dev-tone-30s.wav' }).success).toBe(true);
		expect(audioInputSchema.safeParse({ ...base, audioSourceUrl: '//evil.example/a.wav' }).success).toBe(false);
		expect(audioInputSchema.safeParse({ ...base, audioSourceUrl: 'http://insecure/a.wav' }).success).toBe(false);
	});
});

describe('optional integer fields', () => {
	const valid = {
		title: 'Episode',
		slug: 'episode-one',
		description: '',
		audioSourceUrl: '/fixtures/dev-tone-30s.wav'
	};
	test('accepts numbers and empty strings', () => {
		const withDuration = audioInputSchema.safeParse({ ...valid, durationSeconds: '90' });
		expect(withDuration.success).toBe(true);
		if (withDuration.success) expect(withDuration.data.durationSeconds).toBe(90);
		const empty = audioInputSchema.safeParse({ ...valid, durationSeconds: '' });
		expect(empty.success).toBe(true);
	});
	test('rejects junk, negatives, and out-of-range numbers', () => {
		expect(audioInputSchema.safeParse({ ...valid, durationSeconds: 'abc' }).success).toBe(false);
		expect(audioInputSchema.safeParse({ ...valid, durationSeconds: '-5' }).success).toBe(false);
		expect(audioInputSchema.safeParse({ ...valid, durationSeconds: '99999' }).success).toBe(false);
	});
});

describe('video schema', () => {
	const valid = {
		title: 'Video',
		slug: 'video-one',
		description: '',
		providerVideoId: 'aqz-KE-bpKQ',
		tags: '',
		featured: 'on'
	};
	test('accepts a valid video and parses featured from form values', () => {
		const parsed = videoInputSchema.safeParse(valid);
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.featured).toBe(true);
	});
	test('rejects an invalid video ID', () => {
		expect(videoInputSchema.safeParse({ ...valid, providerVideoId: 'nope' }).success).toBe(false);
	});
});

describe('password policy', () => {
	test('minimum length and maximum length', () => {
		expect(passwordSchema.safeParse('short').success).toBe(false);
		expect(passwordSchema.safeParse('a'.repeat(10)).success).toBe(true);
		expect(passwordSchema.safeParse('a'.repeat(201)).success).toBe(false);
	});
});

describe('LIKE escaping', () => {
	test('escapes wildcards so user input matches literally', () => {
		expect(escapeLike('100%_real')).toBe('100\\%\\_real');
		expect(escapeLike('plain')).toBe('plain');
	});
});
