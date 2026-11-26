import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Recadrage « une seule image -> deux formats » de l'étape Image (public/suivi-editorial.html).
const html = readFileSync(new URL('../../public/suivi-editorial.html', import.meta.url), 'utf8');
const start = html.indexOf('function formatSize(key){');
const end = html.indexOf('async function renderCrop(', start);
const ctx: Record<string, any> = {};
runInNewContext(html.slice(start, end) + '\nthis.formatSize = formatSize; this.cropRect = cropRect; this.croppedName = croppedName;', ctx);

test('a wide image keeps its full height and slides horizontally', () => {
  const left = ctx.cropRect(3000, 1000, 1500, 700, 0);
  assert.equal(left.axis, 'x');
  assert.equal(left.h, 1000);
  assert.ok(Math.abs(left.w - 1000 * 1500 / 700) < 1e-9);
  assert.equal(left.x, 0);
  const center = ctx.cropRect(3000, 1000, 1500, 700, 0.5);
  assert.ok(Math.abs(center.x - (3000 - center.w) / 2) < 1e-9);
  const right = ctx.cropRect(3000, 1000, 1500, 700, 1);
  assert.ok(Math.abs(right.x + right.w - 3000) < 1e-9);
});

test('a tall image keeps its full width and slides vertically', () => {
  const r = ctx.cropRect(1200, 1600, 950, 475, 0.25);
  assert.equal(r.axis, 'y');
  assert.equal(r.w, 1200);
  assert.equal(r.h, 600);
  assert.equal(r.y, (1600 - 600) * 0.25);
});

test('an image already in the right ratio cannot move', () => {
  assert.equal(ctx.cropRect(1900, 950, 950, 475, 0.8).axis, '');
});

test('cropped files are named after the original and the format', () => {
  assert.deepEqual({ ...ctx.formatSize('1500x700') }, { w: 1500, h: 700 });
  assert.equal(ctx.croppedName('Visuel PAC.png', '950x475', '.webp'), 'Visuel PAC-950x475.webp');
  assert.equal(ctx.croppedName('visuel-1500x700.jpg', '950x475', '.jpg'), 'visuel-950x475.jpg');
});
