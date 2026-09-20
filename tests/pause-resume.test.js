const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("popup contains pause monitoring button", () => {
  assert.match(popupHtml, /id="pauseMenuBtn"/);
  assert.match(popupHtml, /Pause Monitoring/);
});

test("popup contains enable monitoring button", () => {
  assert.match(popupHtml, /id="resumeBtn"/);
  assert.match(popupHtml, /Enable Monitoring/);
});

test("popup contains pause presets", () => {
  assert.match(popupHtml, /data-pause="1h"/);
  assert.match(popupHtml, /data-pause="8h"/);
  assert.match(popupHtml, /data-pause="tomorrow"/);
  assert.match(popupHtml, /data-pause="indefinite"/);
});

test("popup resume action calls resumeExtension", () => {
  assert.match(popupJs, /type:"resumeExtension"/);
});

test("background exposes pause/resume message handlers", () => {
  assert.match(background, /case "pauseExtension"/);
  assert.match(background, /case "resumeExtension"/);
});

test("paused payload uses live settings variable", () => {
  assert.match(background, /settings:\s*\{\s*\.\.\.settings\s*\}/);
  assert.doesNotMatch(background, /currentSettings/);
});

test("refresh router does not poll while paused", () => {
  assert.match(background, /async function refreshRouter\(\)\s*\{\s*if \(isExtensionPaused\(\)\)/);
});

test("device alert scan does not run while paused", () => {
  assert.match(background, /async function scanDevicesForAlerts\(\)\s*\{\s*if \(isExtensionPaused\(\)\)/);
});

test("manifest includes alarms permission", () => {
  assert.ok(manifest.permissions.includes("alarms"));
});
