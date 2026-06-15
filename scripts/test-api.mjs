/**
 * Smoke-test /api/process for core export paths.
 * Run: node scripts/test-api.mjs [baseUrl]
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const __dirname = dirname(fileURLToPath(import.meta.url));

async function createTestPng() {
  return sharp({
    create: {
      width: 200,
      height: 150,
      channels: 3,
      background: { r: 80, g: 140, b: 220 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 80,
            height: 100,
            channels: 4,
            background: { r: 255, g: 100, b: 50, alpha: 0.9 },
          },
        })
          .png()
          .toBuffer(),
        left: 60,
        top: 25,
      },
    ])
    .png()
    .toBuffer();
}

async function createCutoutPng() {
  return sharp({
    create: {
      width: 200,
      height: 150,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 80,
            height: 100,
            channels: 4,
            background: { r: 255, g: 100, b: 50, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: 60,
        top: 25,
      },
    ])
    .png()
    .toBuffer();
}

const DEFAULT_OPS = {
  adjustments: { brightness: 0, contrast: 0, sharpness: 0, noiseReduction: 0 },
  resize: {
    width: 0,
    height: 0,
    scalePercent: 100,
    maintainAspectRatio: true,
    mode: "scale",
    upscaleFactor: 1,
  },
  background: { type: "transparent", color: "#ffffff" },
  portrait: { enabled: false, blurStrength: 50 },
  effects: { look: "none", vignette: 0, retouch: 0 },
};

async function postProcess({ imageBuf, cutoutBuf, ops, format = "png" }) {
  const form = new FormData();
  form.append(
    "image",
    new Blob([imageBuf], { type: "image/png" }),
    "test.png",
  );
  if (cutoutBuf) {
    form.append(
      "cutout",
      new Blob([cutoutBuf], { type: "image/png" }),
      "cutout.png",
    );
  }
  form.append("ops", JSON.stringify(ops));
  form.append("format", format);

  const res = await fetch(`${baseUrl}/api/process`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

const tests = [
  {
    name: "basic PNG export",
    run: async (img) =>
      postProcess({ imageBuf: img, ops: DEFAULT_OPS, format: "png" }),
  },
  {
    name: "JPG with brightness",
    run: async (img) =>
      postProcess({
        imageBuf: img,
        ops: {
          ...DEFAULT_OPS,
          adjustments: { ...DEFAULT_OPS.adjustments, brightness: 20 },
        },
        format: "jpg",
      }),
  },
  {
    name: "solid color background + cutout",
    run: async (img, cutout) =>
      postProcess({
        imageBuf: img,
        cutoutBuf: cutout,
        ops: {
          ...DEFAULT_OPS,
          background: { type: "color", color: "#22c55e" },
        },
        format: "png",
      }),
  },
  {
    name: "sepia look",
    run: async (img) =>
      postProcess({
        imageBuf: img,
        ops: {
          ...DEFAULT_OPS,
          effects: { look: "sepia", vignette: 30, retouch: 10 },
        },
        format: "webp",
      }),
  },
  {
    name: "2x upscale preset cover",
    run: async (img) =>
      postProcess({
        imageBuf: img,
        ops: {
          ...DEFAULT_OPS,
          resize: {
            width: 1080,
            height: 1080,
            scalePercent: 100,
            maintainAspectRatio: false,
            mode: "cover",
            upscaleFactor: 2,
          },
        },
        format: "png",
      }),
  },
];

async function main() {
  console.log(`Testing ${baseUrl}/api/process ...\n`);
  const imageBuf = await createTestPng();
  const cutoutBuf = await createCutoutPng();

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const out = await test.run(imageBuf, cutoutBuf);
      if (out.length < 100) throw new Error("output too small");
      const meta = await sharp(out).metadata();
      console.log(`✓ ${test.name} → ${meta.width}x${meta.height} ${meta.format} (${out.length} bytes)`);
      passed++;
    } catch (err) {
      console.error(`✗ ${test.name} → ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
