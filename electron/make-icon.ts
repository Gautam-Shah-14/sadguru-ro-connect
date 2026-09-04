import { BrowserWindow } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Renders the app icon with a canvas in an offscreen window and writes
 * build/icon.png (512) and build/icon.ico (256, PNG-encoded). Run with
 * `electron . --make-icon`.
 */
export async function makeIcon(projectRoot: string): Promise<void> {
  const outDir = join(projectRoot, "build");
  mkdirSync(outDir, { recursive: true });

  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">
  <canvas id="c" width="512" height="512"></canvas>
  <script>
    const ctx = document.getElementById('c').getContext('2d');
    const S = 512, r = 96;
    // rounded-square background, teal gradient
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#2ea3b5');
    g.addColorStop(1, '#1c7f93');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(S, 0, S, S, r);
    ctx.arcTo(S, S, 0, S, r);
    ctx.arcTo(0, S, 0, 0, r);
    ctx.arcTo(0, 0, S, 0, r);
    ctx.closePath();
    ctx.fill();
    // water droplet
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const cx = S / 2, topY = 118, w = 132;
    ctx.moveTo(cx, topY);
    ctx.bezierCurveTo(cx + w, topY + 168, cx + w, S - 150, cx, S - 118);
    ctx.bezierCurveTo(cx - w, S - 150, cx - w, topY + 168, cx, topY);
    ctx.closePath();
    ctx.fill();
    // inner highlight
    ctx.fillStyle = 'rgba(46,163,181,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx + 26, S / 2 + 40, 34, 58, -0.35, 0, Math.PI * 2);
    ctx.fill();
    window.__ready = true;
  </script></body>`;

  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: "#00000000",
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await win.webContents.executeJavaScript(
    "new Promise(r => (window.__ready ? r() : setTimeout(r, 200)))",
  );

  const img512 = await win.webContents.capturePage();
  const png512 = img512.toPNG();
  writeFileSync(join(outDir, "icon.png"), png512);

  const png256 = img512.resize({ width: 256, height: 256 }).toPNG();
  writeFileSync(join(outDir, "icon.ico"), pngToIco(png256));

  win.destroy();
  console.log("wrote build/icon.png and build/icon.ico");
}

/** Wrap a 256x256 PNG in a single-image .ico container (Vista+ / electron-builder). */
function pngToIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 256 -> 0
  entry.writeUInt8(0, 1); // height 256 -> 0
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset

  return Buffer.concat([header, entry, png]);
}
