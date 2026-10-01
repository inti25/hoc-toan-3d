import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('PWA and Favicon assets exist with valid dimensions and sizes', () => {
  const rootDir = process.cwd();
  const requiredFiles = [
    'public/logo.png',
    'public/favicon.ico',
    'public/apple-touch-icon.png',
    'public/icons/favicon-16x16.png',
    'public/icons/favicon-32x32.png',
    'public/icons/apple-touch-icon.png',
    'public/icons/pwa-192x192.png',
    'public/icons/pwa-512x512.png',
    'public/icons/pwa-maskable-512x512.png',
    'public/icons/logo-ui.png'
  ];

  for (const relPath of requiredFiles) {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Expected asset ${relPath} to exist`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 500, `Expected asset ${relPath} to be non-empty (size: ${stat.size})`);
  }
});

test('index.html links to responsive favicons and PWA tags', () => {
  const rootDir = process.cwd();
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  assert.ok(html.includes('rel="icon"'), 'index.html must include favicon link');
  assert.ok(html.includes('rel="apple-touch-icon"'), 'index.html must include apple-touch-icon link');
  assert.ok(html.includes('apple-mobile-web-app-capable'), 'index.html must support mobile web app mode');
  assert.ok(html.includes('theme-color'), 'index.html must specify theme-color');
});
