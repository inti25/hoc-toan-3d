import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveImageUrl, extractMarkdownImage } from '../src/core/imageResolver';

test('resolveImageUrl converts various Google Drive share links to direct thumbnail URL', () => {
  const driveViewLink = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing';
  assert.equal(
    resolveImageUrl(driveViewLink),
    'https://lh3.googleusercontent.com/d/1A2B3C4D5E6F7G8H9I'
  );

  const driveOpenLink = 'https://drive.google.com/open?id=1A2B3C4D5E6F7G8H9I';
  assert.equal(
    resolveImageUrl(driveOpenLink),
    'https://lh3.googleusercontent.com/d/1A2B3C4D5E6F7G8H9I'
  );

  const driveUcLink = 'https://drive.google.com/uc?id=1A2B3C4D5E6F7G8H9I&export=download';
  assert.equal(
    resolveImageUrl(driveUcLink),
    'https://lh3.googleusercontent.com/d/1A2B3C4D5E6F7G8H9I'
  );
});

test('resolveImageUrl preserves standard direct image URLs and local filenames', () => {
  const cdnUrl = 'https://images.unsplash.com/photo-sample.png?w=500';
  assert.equal(resolveImageUrl(cdnUrl), cdnUrl);

  const githubRaw = 'https://raw.githubusercontent.com/user/repo/main/image.webp';
  assert.equal(resolveImageUrl(githubRaw), githubRaw);

  const localFile = 'Screenshot 2026-09-27 160421.png';
  assert.equal(resolveImageUrl(localFile), '/Screenshot 2026-09-27 160421.png');

  const relativePath = './images/diagram.svg';
  assert.equal(resolveImageUrl(relativePath), '/images/diagram.svg');
});

test('resolveImageUrl handles Base64 data URIs and prefixes raw Base64 strings', () => {
  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(resolveImageUrl(dataUri), dataUri);

  const svgDataUri = 'data:image/svg+xml;utf8,<svg></svg>';
  assert.equal(resolveImageUrl(svgDataUri), svgDataUri);

  const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(resolveImageUrl(rawBase64), `data:image/png;base64,${rawBase64}`);
});

test('resolveImageUrl sanitizes invalid or blank URLs', () => {
  assert.equal(resolveImageUrl(''), undefined);
  assert.equal(resolveImageUrl('   '), undefined);
  assert.equal(resolveImageUrl('javascript:alert(1)'), undefined);
});

test('extractMarkdownImage extracts image URL and strips markdown syntax from text', () => {
  const rawText = 'Quan sát hình bên dưới: ![Hình tam giác](https://example.com/triangle.png) Có bao nhiêu hình tam giác?';
  const result = extractMarkdownImage(rawText);

  assert.equal(result.cleanText, 'Quan sát hình bên dưới: Có bao nhiêu hình tam giác?');
  assert.equal(result.imageUrl, 'https://example.com/triangle.png');

  // Text without image
  const normalText = '5 + 5 = ?';
  const normalResult = extractMarkdownImage(normalText);
  assert.equal(normalResult.cleanText, '5 + 5 = ?');
  assert.equal(normalResult.imageUrl, undefined);
});
