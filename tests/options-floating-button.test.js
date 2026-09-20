const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "options.html"), "utf8");
const js = fs.readFileSync(path.join(root, "options.js"), "utf8");

test("options page contains Float Cell button", () => {
  assert.match(html, /id="floatCellFromOptionsBtn"/);
  assert.match(html, /Float Cell/);
});

test("options Float Cell button opens Document Picture-in-Picture", () => {
  assert.match(js, /documentPictureInPicture\.requestWindow/);
  assert.match(js, /width:\s*230/);
  assert.match(js, /height:\s*86/);
});

test("options floating HUD includes cell signal and traffic", () => {
  assert.match(js, /pipCellId/);
  assert.match(js, /pipSignal/);
  assert.match(js, /pipTraffic/);
  assert.match(js, /getCellSignalHistory/);
  assert.match(js, /getStatus/);
});
