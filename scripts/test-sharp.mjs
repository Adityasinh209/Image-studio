/** Direct sharp pipeline test (no HTTP). Run: node scripts/test-sharp.mjs */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load compiled TS via dynamic import of source using tsx alternative - use child process tsc output
// Instead import the functions by spawning node with --experimental-vm-modules after building
// Simpler: inline minimal test using sharp only for cutout composite path

async function createTestPng() {
  return sharp({
    create: { width: 100, height: 80, channels: 3, background: "#5080dc" },
  })
    .png()
    .toBuffer();
}

async function createCutout() {
  return sharp({
    create: { width: 100, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 40, height: 50, channels: 4, background: "#ff6633" },
        })
          .png()
          .toBuffer(),
        left: 30,
        top: 15,
      },
    ])
    .png()
    .toBuffer();
}

async function testSolidColorComposite() {
  const cutout = await createCutout();
  const color = "#22c55e";
  const width = 100;
  const height = 80;

  const cutoutBuf = await sharp(cutout)
    .resize(width, height)
    .ensureAlpha()
    .png()
    .toBuffer();

  const composed = await sharp({
    create: { width, height, channels: 3, background: color },
  })
    .composite([{ input: cutoutBuf, blend: "over" }])
    .png()
    .toBuffer();

  const outDir = join(__dirname, "../.test-output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "solid-color-composite.png"), composed);

  const meta = await sharp(composed).metadata();
  const { data } = await sharp(composed).raw().toBuffer({ resolveWithObject: true });
  // Sample corner pixel should be green background
  const r = data[0];
  const g = data[1];
  const b = data[2];
  const isGreenish = g > r && g > b;
  if (!isGreenish) throw new Error(`Corner pixel not green: rgb(${r},${g},${b})`);
  console.log(`✓ solid color composite ${meta.width}x${meta.height}`);
}

async function main() {
  await testSolidColorComposite();
  console.log("All sharp smoke tests passed.");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
