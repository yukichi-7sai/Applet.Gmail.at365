const { test } = require("node:test");
const assert = require("node:assert/strict");
const { InboxMonitor, parseObservation } = require("../out/monitor");

test("complete large observations keep all unread rows and full sender/subject text", () => {
  const keys = Array.from(
    { length: 500 },
    (_, index) => "thread-" + index + "-".repeat(210),
  );
  const details = keys.map((key) => ({
    key,
    sender: "Sender".repeat(40),
    subject: "件名".repeat(500),
  }));
  const value = {
    ready: true,
    context: "inbox",
    document: "fixture",
    revision: 1,
    keys,
    unread: keys,
    read: [],
    details,
    rowsComplete: true,
    complete: true,
  };
  assert(Buffer.byteLength(JSON.stringify(value)) > 55000);
  assert.equal(parseObservation(value), value);
  const monitor = new InboxMonitor();
  assert.equal(monitor.observe(value), true);
  assert.equal(monitor.pending, keys.length);
  assert.equal(monitor.lastArrivals.length, keys.length);
  assert.equal(monitor.lastArrivals[0].subject, details[0].subject);
  assert.equal(monitor.lastArrivals[0].sender, details[0].sender);
  assert.equal(
    monitor.history.length,
    50,
    "explicit history preference remains independent of observation capacity",
  );
});
