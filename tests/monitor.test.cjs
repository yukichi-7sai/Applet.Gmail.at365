const { test } = require("node:test");
const assert = require("node:assert/strict");
const { InboxMonitor, parseObservation } = require("../out/monitor");
const o = (keys, extra = {}) => ({
  ready: true,
  context: "/mail/u/0/#inbox|primary",
  document: "page-one",
  revision: 1,
  keys,
  ...extra,
});
test("initial load is a baseline; prepended arrival is sticky and deduplicated", () => {
  const m = new InboxMonitor();
  assert.equal(m.observe(o(["a", "b", "c"])), false);
  assert.equal(m.observe(o(["new", "a", "b", "c"])), true);
  assert.equal(m.attention, true);
  assert.equal(m.observe(o(["new", "a", "b", "c"])), false);
  m.acknowledge();
  assert.equal(m.attention, false);
  assert.equal(m.observe(o(["new", "a", "b", "c"])), false);
});
test("read-state, row reordering, appended older mail, removal and missing anchors are not arrivals", () => {
  for (const next of [
    ["a", "b", "c"],
    ["b", "a", "c"],
    ["a", "b", "c", "older"],
    ["b", "c"],
    ["x", "y", "z"],
  ]) {
    const m = new InboxMonitor();
    m.observe(o(["a", "b", "c"]));
    assert.equal(m.observe(o(next)), false);
  }
});
test("login, reload, tab/folder/page transitions and monitoring restart rebaseline", () => {
  for (const extra of [
    { document: "reloaded" },
    { context: "sent" },
    { context: "#inbox/p2" },
    { context: "secondary" },
  ]) {
    const m = new InboxMonitor();
    m.observe(o(["a", "b"]));
    assert.equal(m.observe(o(["new", "a", "b"], extra)), false);
  }
  const m = new InboxMonitor();
  m.observe(o(["a", "b"]));
  m.observe(null);
  assert.equal(m.observe(o(["new", "a", "b"])), false);
  m.reset();
  assert.equal(m.observe(o(["newer", "new", "a", "b"])), false);
});
test("temporary DOM mutation settling preserves baseline; invalid snapshots cannot trigger", () => {
  const m = new InboxMonitor();
  m.observe(o(["a", "b"]));
  m.observe(o([], { ready: false, reason: "settling" }));
  assert.equal(m.observe(o(["new", "a", "b"])), true);
  for (const raw of [
    null,
    {},
    o(["x", "x"]),
    o([42]),
    o(["x".repeat(201)]),
    o(["a"], { revision: NaN }),
  ])
    assert.equal(parseObservation(raw), null);
});
test("seen rows cannot be notified again after reordering; state is isolated per account", () => {
  const a = new InboxMonitor(),
    b = new InboxMonitor();
  a.observe(o(["one", "two"]));
  b.observe(o(["one", "two"]));
  a.observe(o(["two", "one"]));
  assert.equal(a.observe(o(["one", "two"])), false);
  assert.equal(b.observe(o(["new", "one", "two"])), true);
  assert.equal(a.attention, false);
});
test("a confirmed empty inbox establishes a baseline for its first mail", () => {
  const m = new InboxMonitor();
  assert.equal(m.observe(o([])), false);
  assert.equal(m.observe(o(["first"])), true);
});

test("arrival batches count distinct thread updates, carry metadata, and preserve history on acknowledge", () => {
  const m = new InboxMonitor();
  m.observe(o(["a~old", "b~same"]));
  const next = o(["new~one", "a~reply", "b~same"], {
    unread: ["new~one", "a~reply"],
    details: [
      { key: "new~one", sender: "ユキ", subject: "確認メール" },
      { key: "a~reply", sender: "Alice", subject: "返信" },
    ],
  });
  assert.equal(m.observe(next), true);
  assert.equal(m.pending, 2);
  assert.deepEqual(
    m.lastArrivals.map((a) => a.sender),
    ["ユキ", "Alice"],
  );
  assert.ok(
    m.history.every(
      (a) => Number.isSafeInteger(a.detectedAt) && !a.acknowledged,
    ),
  );
  assert.equal(m.observe(next), false);
  assert.equal(m.pending, 2);
  m.acknowledge();
  assert.equal(m.pending, 0);
  assert.equal(m.history.length, 2);
  assert.ok(m.history.every((a) => a.acknowledged));
  m.reset();
  assert.deepEqual(m.history, []);
});

test("metadata is optional, validated and session history remains bounded", () => {
  const m = new InboxMonitor();
  m.observe(o(["a"]));
  for (let n = 0; n < 65; n++) {
    const keys = ["n" + n, ...m.history.slice(0, 2).map((a) => a.key), "a"];
    m.observe(
      o(keys, {
        details: [
          { key: keys[0], sender: "送".repeat(120), subject: "題".repeat(200) },
        ],
      }),
    );
  }
  assert.equal(m.pending, 65);
  assert.ok(m.history.length <= 50 && m.history.length > 0);
  assert.ok(
    Buffer.byteLength(
      JSON.stringify({ pending: m.pending, arrivals: m.history }),
    ) <= 48000,
  );
  for (const details of [
    [{ key: "other", sender: "A", subject: "S" }],
    [{ key: "a", sender: "A", subject: "S".repeat(201) }],
    [null],
    "wrong",
  ])
    assert.equal(parseObservation(o(["a"], { details })), null);
  const fallback = new InboxMonitor();
  fallback.observe(o(["old"]));
  fallback.observe(o(["new", "old"]));
  assert.equal(fallback.history[0].subject, "");
});
test("changed last-message ID in unread thread detects reply; marking unread and read sent-replies do not", () => {
  const m = new InboxMonitor();
  m.observe(o(["thread~old", "other~same"], { unread: [] }));
  assert.equal(
    m.observe(o(["thread~old", "other~same"], { unread: ["thread~old"] })),
    false,
  );
  assert.equal(
    m.observe(o(["thread~reply", "other~same"], { unread: ["thread~reply"] })),
    true,
  );
  m.acknowledge();
  assert.equal(
    m.observe(o(["thread~reply", "other~same"], { unread: ["thread~reply"] })),
    false,
  );
  assert.equal(
    m.observe(o(["thread~sent", "other~same"], { unread: [] })),
    false,
  );
});
