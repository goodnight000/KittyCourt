#!/usr/bin/env node
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const TILE = 256;

// --- Pseudo-random hash (deterministic) ---
function hash(x, y, seed) {
    let h = seed | 0;
    h = (h + Math.imul(x | 0, 0x165667B1)) | 0;
    h = (h + Math.imul(y | 0, 0x27D4EB2D)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
    h = Math.imul(h ^ (h >>> 12), 0x297A2D39);
    h = h ^ (h >>> 15);
    return (h >>> 0) / 4294967296;
}

// --- Smoothed value noise with wrapping for seamless tiling ---
function smoothNoise(x, y, seed, period) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    // Hermite smoothstep
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const w = (v) => ((v % period) + period) % period;

    const n00 = hash(w(ix),     w(iy),     seed);
    const n10 = hash(w(ix + 1), w(iy),     seed);
    const n01 = hash(w(ix),     w(iy + 1), seed);
    const n11 = hash(w(ix + 1), w(iy + 1), seed);

    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    return nx0 + sy * (nx1 - nx0);
}

// --- Multi-octave tileable fractal noise ---
// Each octave's grid period divides evenly into TILE, ensuring seamless wrap.
function paperGrain(px, py) {
    let value = 0, total = 0;
    // Weighted octaves: favor fine grain over coarse blobs for paper texture
    const octaves = [
        { grid: 64, seed: 42,  amp: 0.3 },  // coarse: 4 cells (subtle tonal variation)
        { grid: 32, seed: 137, amp: 0.5 },   // medium: 8 cells
        { grid: 16, seed: 256, amp: 0.8 },   // fine: 16 cells
        { grid: 8,  seed: 389, amp: 1.0 },   // very fine: 32 cells (main paper grain)
        { grid: 4,  seed: 512, amp: 0.7 },   // ultra fine: 64 cells (fiber detail)
    ];

    for (const { grid, seed, amp } of octaves) {
        value += smoothNoise(px / grid, py / grid, seed, TILE / grid) * amp;
        total += amp;
    }

    return value / total;
}

// --- Generate pixel data (RGB, color type 2) ---
const CHANNELS = 3;
const rawRows = [];

for (let y = 0; y < TILE; y++) {
    const row = Buffer.alloc(1 + TILE * CHANNELS); // 1 filter byte + pixel data
    row[0] = 0; // PNG filter: None

    for (let x = 0; x < TILE; x++) {
        const smooth = paperGrain(x, y);
        // Add sharp per-pixel grit on top (real paper has micro-grit)
        const sharp = hash(x, y, 1234);
        const grain = smooth * 0.78 + sharp * 0.22;

        // Pure neutral grain — no color, just texture.
        // Near-white so multiply blend only subtly darkens grain areas.
        const delta = (grain - 0.5) * 30; // ±15 levels — slightly stronger
        const v = Math.max(0, Math.min(255, Math.round(253 + delta)));

        const r = v;
        const g = v;
        const b = v;

        const off = 1 + x * CHANNELS;
        row[off]     = r;
        row[off + 1] = g;
        row[off + 2] = b;
    }

    rawRows.push(row);
}

const rawData = Buffer.concat(rawRows);

// --- Minimal PNG encoder ---
function crc32(data) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(TILE, 0);  // width
ihdr.writeUInt32BE(TILE, 4);  // height
ihdr[8]  = 8;  // bit depth
ihdr[9]  = 2;  // color type: RGB
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter method
ihdr[12] = 0;  // interlace: none

const compressed = zlib.deflateSync(rawData, { level: 9 });

const png = Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
]);

// --- Save ---
const outDir = path.join(__dirname, '..', 'client', 'public', 'textures');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'parchment-grain.png');
fs.writeFileSync(outPath, png);

console.log(`Generated ${outPath}`);
console.log(`  Size: ${TILE}x${TILE}px, ${(png.length / 1024).toFixed(1)} KB`);
console.log(`  Seamlessly tileable, warm cream paper grain`);
console.log(`  Designed for CSS background-blend-mode: multiply`);
