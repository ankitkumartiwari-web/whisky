/* Generate Whisky Music brand icon (amber disc) at multiple sizes and pack into ICO. */
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const toIco = require('to-ico');

const COLORS = {
  bg: { r: 14, g: 11, b: 7, a: 255 }, // dark cigar #0E0B07
  ringOuter: { r: 216, g: 163, b: 92, a: 255 }, // amber #D8A35C
  ringInner: { r: 14, g: 11, b: 7, a: 255 },
  hub: { r: 216, g: 163, b: 92, a: 255 },
  notch: { r: 216, g: 163, b: 92, a: 255 },
};

function blend(target, color, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  target.r = Math.round(target.r * (1 - a) + color.r * a);
  target.g = Math.round(target.g * (1 - a) + color.g * a);
  target.b = Math.round(target.b * (1 - a) + color.b * a);
  target.a = 255;
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = color.a ?? 255;
}

function blendPixel(png, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  const current = {
    r: png.data[idx],
    g: png.data[idx + 1],
    b: png.data[idx + 2],
    a: png.data[idx + 3],
  };
  blend(current, color, alpha);
  png.data[idx] = current.r;
  png.data[idx + 1] = current.g;
  png.data[idx + 2] = current.b;
  png.data[idx + 3] = current.a;
}

function makeIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const cornerRadius = size * 0.22;

  const ringOuter = size * 0.42;
  const ringInner = size * 0.30;
  const hubRadius = size * 0.08;
  const notchHalfWidth = size * 0.04;
  const notchTopY = size * 0.14;
  const notchBottomY = size * 0.30;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Rounded-rect background mask with edge antialiasing
      const dx = Math.max(cornerRadius - x, x - (size - 1 - cornerRadius), 0);
      const dy = Math.max(cornerRadius - y, y - (size - 1 - cornerRadius), 0);
      const cornerDist = Math.sqrt(dx * dx + dy * dy);
      const bgAlpha = cornerDist <= cornerRadius
        ? 1
        : Math.max(0, Math.min(1, cornerRadius - cornerDist + 0.5));
      if (bgAlpha <= 0) {
        setPixel(png, x, y, { r: 0, g: 0, b: 0, a: 0 });
        continue;
      }
      // Start with bg
      const px = { ...COLORS.bg, a: 255 };
      setPixel(png, x, y, px);
      if (bgAlpha < 1) {
        // make corner transparent
        png.data[(png.width * y + x) << 2 | 3] = Math.round(255 * bgAlpha);
      }

      const dxRing = x - cx + 0.5;
      const dyRing = y - cy + 0.5;
      const dist = Math.sqrt(dxRing * dxRing + dyRing * dyRing);

      // Outer ring (annulus between ringInner and ringOuter)
      if (dist <= ringOuter + 1 && dist >= ringInner - 1) {
        const inEdge = Math.max(0, Math.min(1, ringOuter - dist + 0.5));
        const outEdge = Math.max(0, Math.min(1, dist - ringInner + 0.5));
        const ringAlpha = Math.min(inEdge, outEdge);
        if (ringAlpha > 0) blendPixel(png, x, y, COLORS.ringOuter, ringAlpha);
      }

      // Center hub
      if (dist <= hubRadius + 1) {
        const a = Math.max(0, Math.min(1, hubRadius - dist + 0.5));
        if (a > 0) blendPixel(png, x, y, COLORS.hub, a);
      }

      // Notch line at top: vertical bar
      if (
        x + 0.5 >= cx - notchHalfWidth &&
        x + 0.5 <= cx + notchHalfWidth &&
        y >= notchTopY &&
        y <= notchBottomY
      ) {
        const nudge = Math.min(
          1,
          (notchHalfWidth - Math.abs(x + 0.5 - cx)) + 0.5,
        );
        blendPixel(png, x, y, COLORS.notch, Math.max(0, Math.min(1, nudge)));
      }
    }
  }

  return PNG.sync.write(png);
}

async function main() {
  const buildDir = path.resolve(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = sizes.map((size) => makeIcon(size));

  // Save 256 as PNG for fallback / docs
  fs.writeFileSync(path.join(buildDir, 'icon.png'), buffers[buffers.length - 1]);
  // 512 PNG for high-res
  fs.writeFileSync(path.join(buildDir, 'icon-512.png'), makeIcon(512));

  const ico = await toIco(buffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

  console.log('Icon written: build/icon.ico, build/icon.png, build/icon-512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
