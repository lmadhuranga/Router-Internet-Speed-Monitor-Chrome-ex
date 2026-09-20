const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const monitor = fs.readFileSync(path.join(root, "monitor.js"), "utf8");
const apiDocs = fs.readFileSync(path.join(root, "docs", "router-api.md"), "utf8");

test("background no longer imports access-rules runtime module", () => {
  assert.doesNotMatch(background, /access-rules\.js/);
});

test("background no longer exposes setDeviceAccess", () => {
  assert.doesNotMatch(background, /setDeviceAccess/);
  assert.doesNotMatch(background, /getAccessRules/);
});

test("monitor no longer contains block or allow controls", () => {
  assert.doesNotMatch(monitor, /Block Internet/);
  assert.doesNotMatch(monitor, /Allow Internet/);
  assert.doesNotMatch(monitor, /access-toggle-btn/);
});

test("router API documentation still keeps CMD 23 information", () => {
  assert.match(apiDocs, /CMD 23/i);
  assert.match(apiDocs, /IPV4/i);
});
