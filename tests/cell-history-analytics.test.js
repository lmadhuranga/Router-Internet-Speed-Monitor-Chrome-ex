const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "history.html"), "utf8");
const js = fs.readFileSync(path.join(root, "history.js"), "utf8");

test("history dashboard includes exact signal value distribution", () => {
  assert.match(html, /Signal value distribution by cell/);
  assert.match(html, /id="signalDistributionBody"/);
  assert.match(js, /buildSignalDistribution/);
  assert.match(js, /row\.count \+= 1/);
});

test("signal distribution keeps first and last timestamps", () => {
  assert.match(js, /firstSeen/);
  assert.match(js, /lastSeen/);
  assert.match(html, /First recorded/);
  assert.match(html, /Last recorded/);
});

test("history dashboard includes tower connection sessions", () => {
  assert.match(html, /Tower connection sessions/);
  assert.match(html, /id="towerSessionsBody"/);
  assert.match(js, /buildTowerSessions/);
  assert.match(js, /summarizeTowerSessions/);
});

test("new session starts on cell change or sample gap", () => {
  assert.match(js, /current\.cellId !== cellId/);
  assert.match(js, /timestamp - current\.lastSeen > gapLimitMs/);
  assert.match(js, /2\.5 \* 60 \* 1000/);
});

test("tower session summary exposes daily connection count and approximate minutes", () => {
  assert.match(js, /connections \+= 1/);
  assert.match(js, /samples \+= session\.samples/);
  assert.match(js, /formatApproxMinutes/);
  assert.match(html, /Connections/);
  assert.match(html, /Approx\. time/);
});
