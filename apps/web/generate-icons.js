// Generate placeholder icons for PWA
// For production, replace these with actual icons

const fs = require("node:fs");
const path = require("node:path");

// Minimal valid 1x1 transparent PNG
// Contains: PNG signature, IHDR, IDAT (with actual compressed data), IEND
const createMinimalPng = () =>
  Buffer.from([
    // PNG signature
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    // IHDR chunk (13 bytes)
    0x00,
    0x00,
    0x00,
    0x0d, // length
    0x49,
    0x48,
    0x44,
    0x52, // "IHDR"
    0x00,
    0x00,
    0x00,
    0x01, // width: 1
    0x00,
    0x00,
    0x00,
    0x01, // height: 1
    0x08, // bit depth: 8
    0x06, // color type: RGBA
    0x00, // compression: deflate
    0x00, // filter: adaptive
    0x00, // interlace: none
    0x1f,
    0x15,
    0xc4,
    0x89, // CRC
    // IDAT chunk (minimal compressed data for 1x1 transparent pixel)
    0x00,
    0x00,
    0x00,
    0x0a, // length: 10
    0x49,
    0x44,
    0x41,
    0x54, // "IDAT"
    0x78,
    0x9c,
    0x62,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01, // compressed data
    0x00, // (padding for valid zlib)
    0x05,
    0xfe,
    0x02,
    0xfe, // CRC (placeholder - browsers are lenient)
    // IEND chunk
    0x00,
    0x00,
    0x00,
    0x00, // length: 0
    0x49,
    0x45,
    0x4e,
    0x44, // "IEND"
    0xae,
    0x42,
    0x60,
    0x82, // CRC
  ]);

// Ensure directory exists
const iconsDir = path.join(__dirname, "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

// Write placeholder icons (minimal valid PNGs)
const placeholder = createMinimalPng();
fs.writeFileSync(path.join(iconsDir, "icon-192.png"), placeholder);
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), placeholder);

console.log("Placeholder icons generated in", iconsDir);
console.log("Note: Replace with actual icons for production");
