const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const popupCss = fs.readFileSync(path.join(root, "popup.css"), "utf8");
const popupJs = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");

test("popup has a state overlay", () => {
  assert.match(popupHtml, /id="stateOverlay"/);
  assert.match(popupHtml, /id="overlayPrimaryBtn"/);
});

test("popup overlay dims the underlying interface", () => {
  assert.match(popupCss, /\.popup\.state-dimmed/);
  assert.match(popupCss, /opacity:\.28/);
});

test("paused state displays enable monitoring overlay", () => {
  assert.match(popupJs, /showStateOverlay\("paused"/);
  assert.match(popupJs, /Enable Monitoring/);
});

test("offline state displays retry overlay", () => {
  assert.match(popupJs, /showStateOverlay\("offline"/);
  assert.match(popupJs, /Retry Connection/);
});

test("overlay primary action resumes when paused", () => {
  assert.match(popupJs, /currentOverlayState==="paused"[\s\S]*resumeFromOverlay/);
});

test("overlay primary action retries when offline", () => {
  assert.match(popupJs, /currentOverlayState==="offline"[\s\S]*retryFromOverlay/);
});

test("paused badge is visually distinct", () => {
  assert.match(background, /function setPausedBadge/);
  assert.match(background, /setBadgeText\(\{text:"II"\}\)/);
  assert.match(background, /Router Monitor — Paused/);
});

test("offline badge displays OFF", () => {
  assert.match(background, /function setOfflineBadge/);
  assert.match(background, /setBadgeText\(\{text:"OFF"\}\)/);
  assert.match(background, /Router Monitor — Offline/);
});

test("pause action immediately updates badge", () => {
  const matches = background.match(/setPausedBadge\(\)/g) || [];
  assert.ok(matches.length >= 3);
});

test("connected state restores normal badge title", () => {
  assert.match(background, /Router Monitor — Connected/);
});
