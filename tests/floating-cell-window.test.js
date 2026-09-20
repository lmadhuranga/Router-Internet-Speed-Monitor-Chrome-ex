const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "monitor.html"), "utf8");
const js = fs.readFileSync(path.join(root, "monitor.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("monitor has Float Cell button", () => {
  assert.match(html, /id="floatCellBtn"/);
  assert.match(html, /Float Cell/);
});

test("floating window uses Document Picture-in-Picture", () => {
  assert.match(js, /documentPictureInPicture\.requestWindow/);
  assert.match(js, /width:\s*230/);
  assert.match(js, /height:\s*86/);
});

test("floating window asks Chrome to hide return-to-opener control", () => {
  assert.match(js, /disallowReturnToOpener:\s*true/);
});

test("floating HUD content disables pointer interaction", () => {
  assert.match(js, /pointer-events:none/);
  assert.match(js, /user-select:none/);
});

test("floating HUD displays compact cell, signal and combined traffic line", () => {
  assert.match(js, /pipCellId/);
  assert.match(js, /pipSignal/);
  assert.match(js, /pipTraffic/);
  assert.match(js, /↑ \$\{uploadText\}  \|  ↓ \$\{downloadText\}/);
  assert.match(js, /sample\.globalCellId/);
  assert.match(js, /status\?\.router\?\.rssi/);
  assert.match(js, /status\?\.speed\?\.uploadKB/);
  assert.match(js, /status\?\.speed\?\.downloadKB/);
});

test("floating HUD reuses local sample and does not collect another sample", () => {
  const start = js.indexOf("function updateCellPipContent");
  assert.notEqual(start, -1);
  const end = js.indexOf("function buildCellPipDocument", start);
  const block = js.slice(start, end);
  assert.doesNotMatch(block, /collectCellSignalSample/);
  assert.doesNotMatch(block, /cmd:\s*186/);
});

test("manifest minimum Chrome supports disallowReturnToOpener", () => {
  assert.equal(Number(manifest.minimum_chrome_version), 124);
});


test("floating HUD uses a full-bleed dark background", () => {
  assert.match(js, /background:#07111b/);
  assert.match(js, /\.hud\{[\s\S]*width:100%[\s\S]*height:100%/);
});


test("floating HUD uses a single compact traffic line", () => {
  assert.match(js, /id="pipTraffic"/);
  assert.doesNotMatch(js, /id="pipUpload"/);
  assert.doesNotMatch(js, /id="pipDownload"/);
});


test("floating HUD uses low-glare dark-mode colors", () => {
  assert.match(js, /color:#c6d3df/);
  assert.match(js, /color:#b9c8d6/);
  assert.match(js, /color:#78c99a/);
  assert.match(js, /color:#7f93a6/);
  assert.doesNotMatch(js, /color:#edf6ff/);
});
