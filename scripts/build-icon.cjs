/* Generate the Whisky Music brand icon (soft dusk tile with peach + lavender rings). */
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const toIco = require('to-ico');

const COLORS = {
  bgTop: { r: 38, g: 32, b: 49, a: 255 }, // #262031
  bgBottom: { r: 20, g: 17, b: 26, a: 255 }, // #14111A
  peachLight: { r: 247, g: 203, b: 169, a: 255 }, // #F7CBA9
  peachDeep: { r: 224, g: 154, b: 108, a: 255 }, // #E09A6C
  lavender: { r: 156, g: 139, b: 212, a: 255 }, // #9C8BD4
  cream: { r: 242, g: 235, b: 227, a: 255 }, // #F2EBE3
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function mix(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: 255,
  };
}

function blendPixel(png, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const a = clamp01(alpha);
  if (a <= 0) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = Math.round(png.data[idx] * (1 - a) + color.r * a);
  png.data[idx + 1] = Math.round(png.data[idx + 1] * (1 - a) + color.g * a);
  png.data[idx + 2] = Math.round(png.data[idx + 2] * (1 - a) + color.b * a);
}

function ringAlpha(dist, radius, thickness) {
  const half = thickness / 2;
  return clamp01(half + 0.5 - Math.abs(dist - radius));
}

function capsuleAlpha(x, y, x1, y1, x2, y2, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  const t = clamp01(((x - x1) * dx + (y - y1) * dy) / lenSq);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return clamp01(radius + 0.5 - Math.hypot(x - px, y - py));
}

function makeIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const cornerRadius = size * 0.28125; // 18/64

  const ringRadius = size * (19 / 64);
  const ringThickness = size * (4.5 / 64);
  const innerRadius = size * (12.5 / 64);
  const innerThickness = size * (2 / 64);
  const hubRadius = size * (3.4 / 64);
  const notchRadius = size * (1.5 / 64);

  const glowX = size * 0.28;
  const glowY = size * 0.2;
  const glowR = size * 0.6;
  const coolX = size * 0.9;
  const coolY = size * 0.94;
  const coolR = size * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Soft rounded-square mask with antialiased corners.
      const dx = Math.max(cornerRadius - (x + 0.5), (x + 0.5) - (size - cornerRadius), 0);
      const dy = Math.max(cornerRadius - (y + 0.5), (y + 0.5) - (size - cornerRadius), 0);
      const cornerDist = Math.sqrt(dx * dx + dy * dy);
      const mask = cornerDist <= cornerRadius
        ? 1
        : clamp01(cornerRadius - cornerDist + 0.5);
      const idx = (png.width * y + x) << 2;
      if (mask <= 0) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Base vertical/diagonal gradient.
      const t = clamp01((x * 0.3 + y * 0.7) / Math.max(size - 1, 1));
      const base = mix(COLORS.bgTop, COLORS.bgBottom, t);
      png.data[idx] = base.r;
      png.data[idx + 1] = base.g;
      png.data[idx + 2] = base.b;
      png.data[idx + 3] = Math.round(255 * mask);

      // Warm glow in the upper-left.
      const gd = Math.hypot(x - glowX, y - glowY) / glowR;
      const glow = clamp01(1 - gd);
      blendPixel(png, x, y, COLORS.peachLight, 0.28 * glow * glow);

      // Cool lavender ambient in the lower-right.
      const cd = Math.hypot(x - coolX, y - coolY) / coolR;
      const cool = clamp01(1 - cd);
      blendPixel(png, x, y, COLORS.lavender, 0.16 * cool * cool);

      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);

      // Outer peach ring, warmed from top to bottom.
      const outerA = ringAlpha(dist, ringRadius, ringThickness);
      if (outerA > 0) {
        const ringT = clamp01((y + 0.5 - (cy - ringRadius)) / (ringRadius * 2));
        blendPixel(png, x, y, mix(COLORS.peachLight, COLORS.peachDeep, ringT), outerA);
      }

      // Thin lavender inner ring.
      const innerA = ringAlpha(dist, innerRadius, innerThickness);
      if (innerA > 0) blendPixel(png, x, y, COLORS.lavender, innerA * 0.62);

      // Cream hub.
      if (dist <= hubRadius + 1) {
        const hubA = clamp01(hubRadius + 0.5 - dist);
        if (hubA > 0) blendPixel(png, x, y, COLORS.cream, hubA);
      }

      // Soft rounded "spin" notch at the top.
      const notchA = capsuleAlpha(
        x + 0.5,
        y + 0.5,
        cx,
        size * (13.2 / 64),
        cx,
        size * (17 / 64),
        notchRadius,
      );
      if (notchA > 0) blendPixel(png, x, y, COLORS.peachLight, notchA);
    }
  }

  return PNG.sync.write(png);
}

async function main() {
  const buildDir = path.resolve(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = sizes.map((size) => makeIcon(size));

  fs.writeFileSync(path.join(buildDir, 'icon.png'), buffers[buffers.length - 1]);
  fs.writeFileSync(path.join(buildDir, 'icon-512.png'), makeIcon(512));

  const ico = await toIco(buffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

  console.log('Icon written: build/icon.ico, build/icon.png, build/icon-512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
