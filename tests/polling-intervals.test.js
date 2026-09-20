const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const monitor = fs.readFileSync(path.join(root, "monitor.js"), "utf8");

test("background device scan runs every 30 seconds", () => {
  const start = background.indexOf("function scheduleDeviceScan()");
  assert.notEqual(start, -1);
  const block = background.slice(start, start + 500);
  assert.match(block, /30000/);
});

test("live monitor defines 30 second device refresh interval", () => {
  assert.match(monitor, /const DEVICE_REFRESH_MS=30000/);
});

test("live monitor status loop does not reload devices every fast tick", () => {
  const start = monitor.indexOf("const statusLoop=async()=>");
  assert.notEqual(start, -1);
  const block = monitor.slice(start, start + 220);
  assert.match(block, /await load\(\)/);
  assert.doesNotMatch(block, /loadDevices/);
});

test("live monitor device loop reloads devices at DEVICE_REFRESH_MS", () => {
  const start = monitor.indexOf("const deviceLoop=async()=>");
  assert.notEqual(start, -1);
  const block = monitor.slice(start, start + 220);
  assert.match(block, /await loadDevices\(\)/);
  assert.match(block, /DEVICE_REFRESH_MS/);
});

