const { test } = require("node:test");
const assert = require("node:assert/strict");
const { InboxMonitor, parseObservation } = require("../out/monitor");
const o = (keys, extra = {}) => ({
  ready: true,
  context: "/mail/u/0/#inbox|primary",
  document: "page-one",
  revision: 1,
  keys,
  rowsComplete: true,
  unread: extra.unread ?? [],
  read: keys.filter((key) => !(extra.unread ?? []).includes(key)),
  ...extra,
});
test("history limit changes trim old entries without changing unread counts or replaying arrivals", () => {
  const m = new InboxMonitor();
  const keys = Array.from({ length: 40 }, (_, i) => "thread-" + i);
  m.observe(o(keys, { unread: keys }));
  assert.equal(m.history.length, 40);
  m.setHistoryLimit(10);
  assert.equal(m.history.length, 10);
  assert.equal(m.pending, 40);
  assert.equal(m.observe(o(keys, { unread: keys })), false);
  m.setHistoryLimit(50);
  assert.equal(m.history.length, 10, "discarded history cannot be restored");
  m.observe(o(["new", ...keys], { unread: ["new", ...keys] }));
  assert.equal(m.history.length, 11);
  assert.equal(m.history[0].key, "new");
  assert.equal(m.pending, 41);
  m.setHistoryLimit(10);
  assert.equal(m.history[0].key, "new", "keep newest entries");
  for (const invalid of [0, 100, 15, 10.5, NaN, "10", null]) {
    m.setHistoryLimit(invalid);
    assert.equal(
      m.observe(o(["new", ...keys], { unread: ["new", ...keys] })),
      false,
    );
    assert.equal(m.pending, 41);
  }
});
test("initial load is a baseline; prepended arrival is sticky and deduplicated", () => {
  const m = new InboxMonitor();
  assert.equal(m.observe(o(["a", "b", "c"])), false);
  assert.equal(m.observe(o(["new", "a", "b", "c"], { unread: ["new"] })), true);
  assert.equal(m.attention, true);
  assert.equal(
    m.observe(o(["new", "a", "b", "c"], { unread: ["new"] })),
    false,
  );
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
  assert.equal(m.observe(o(["new", "a", "b"], { unread: ["new"] })), true);
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
  assert.equal(b.observe(o(["new", "one", "two"], { unread: ["new"] })), true);
  assert.equal(a.attention, false);
});
test("a confirmed empty inbox establishes a baseline for its first mail", () => {
  const m = new InboxMonitor();
  assert.equal(m.observe(o([])), false);
  assert.equal(m.observe(o(["first"], { unread: ["first"] })), true);
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
  const collected = [];
  for (let n = 0; n < 65; n++) {
    collected.unshift("n" + n);
    const keys = [...collected, "a"];
    m.observe(
      o(keys, {
        unread: [...collected],
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

test("startup imports only unread threads; reload does not re-notify but monitor restart imports unread", () => {
  const m = new InboxMonitor();
  assert.equal(m.observe(o(["a", "b", "read"], { unread: ["a", "b"] })), true);
  assert.equal(m.pending, 2);
  assert.equal(m.history.length, 2);
  assert.ok(m.history.every((entry) => entry.initial && entry.unread === true));
  m.observe(null);
  assert.equal(
    m.observe(
      o(["a", "b", "read"], { unread: ["a", "b"], document: "reloaded" }),
    ),
    false,
  );
  assert.equal(m.pending, 2);
  m.acknowledge();
  assert.equal(m.observe(o(["a", "b", "read"], { unread: ["a", "b"] })), false);
  assert.equal(m.pending, 0);
  m.reset();
  assert.equal(m.observe(o(["a", "b", "read"], { unread: ["a", "b"] })), true);
  assert.equal(m.pending, 2);
});

test("reading reduces badge without losing history; marking unread restores count without a notification", () => {
  const m = new InboxMonitor();
  m.observe(o(["thread~one"], { unread: ["thread~one"] }));
  assert.equal(m.observe(o(["thread~one"])), false);
  assert.equal(m.pending, 0);
  assert.equal(m.attention, false);
  assert.equal(m.history[0].unread, false);
  assert.equal(m.observe(o(["thread~one"], { unread: ["thread~one"] })), false);
  assert.equal(m.pending, 1);
  assert.equal(m.observe(o(["thread~two"], { unread: ["thread~two"] })), true);
  assert.equal(m.pending, 1, "multiple arrivals in the same thread count once");
  assert.equal(m.history.length, 2);
  m.observe(o(["thread~two"]));
  assert.equal(m.pending, 0);
  assert.ok(m.history.every((entry) => entry.unread === false));
});

test("read and unknown arrivals cannot notify; removed rows within the observed range leave history", () => {
  const m = new InboxMonitor();
  m.observe(o(["old"]));
  assert.equal(m.observe(o(["read-new", "old"])), false);
  assert.equal(m.pending, 0);
  assert.equal(m.history[0].unread, false);
  assert.equal(
    m.observe(o(["unknown", "read-new", "old"], { read: [], unread: [] })),
    false,
  );
  assert.equal(m.history[0].unread, null);
  m.observe(
    o(["unread", "unknown", "read-new", "old"], { unread: ["unread"] }),
  );
  assert.equal(m.pending, 1);
  m.observe(o(["old"]));
  assert.equal(m.pending, 0);
  assert.equal(m.history.length, 0);
  assert.equal(
    parseObservation(o(["a"], { unread: ["a"], read: ["a"] })),
    null,
  );
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

test("confirmed whole-inbox removal clears every reply and acknowledged history entry", () => {
  const m = new InboxMonitor();
  m.observe(o(["a~one", "b"], { unread: ["a~one", "b"], complete: true }));
  m.acknowledge();
  m.observe(o(["a~two", "b"], { unread: ["a~two", "b"], complete: true }));
  assert.equal(m.history.length, 3);
  assert.equal(m.observe(o(["b"], { unread: ["b"], complete: true })), false);
  assert.deepEqual(
    m.history.map((entry) => entry.key),
    ["b"],
  );
  assert.equal(m.pending, 0);
  m.observe(o([], { complete: true }));
  assert.equal(m.history.length, 0);
  assert.equal(m.attention, false);
});

test("page-boundary displacement and unrelated categories do not erase arrival history", () => {
  const m = new InboxMonitor();
  m.observe(o(["a", "b", "tail"], { unread: ["tail"] }));
  m.observe(o(["new", "a", "b"], { unread: ["new"] }));
  assert.ok(
    m.history.some((entry) => entry.key === "tail" && entry.unread === null),
  );
  m.observe(o([], { context: "another-category", complete: true }));
  assert.equal(m.history.length, 2);
  m.observe(o(["a", "b"], { document: "reload", complete: true }));
  assert.equal(m.history.length, 0);
});

test("partial inbox removal needs stable ordered lower anchors, not a reload or reorder", () => {
  for (const next of [
    o(["c", "a"]),
    o(["a", "c"], { document: "reload" }),
    o(["a", "c"], { context: "another-category" }),
    o(["unrelated"]),
    o(["a", "c"], { rowsComplete: false }),
    o([], { ready: false, reason: "settling" }),
  ]) {
    const m = new InboxMonitor();
    m.observe(o(["a", "b", "c"], { unread: ["b"] }));
    m.observe(next);
    assert.equal(m.history.length, 1);
  }
  const m = new InboxMonitor();
  m.observe(o(["a", "b", "c"], { unread: ["a", "b"] }));
  m.observe(o(["c", "older"]));
  assert.equal(m.history.length, 0);
  assert.equal(m.pending, 0);
});

test("complete empty inbox reconciles pending threads beyond the history limit", () => {
  const m = new InboxMonitor();
  const keys = Array.from({ length: 70 }, (_, i) => "thread" + i);
  m.observe(o(keys, { unread: keys, complete: true }));
  assert.equal(m.history.length, 50);
  assert.equal(m.pending, 70);
  m.observe(o([], { complete: true }));
  assert.equal(m.pending, 0);
  assert.equal(m.history.length, 0);
  m.observe(o(keys, { unread: keys, complete: true }));
  assert.equal(
    m.pending,
    0,
    "restoring old mail does not create another notification",
  );
  assert.equal(parseObservation(o([], { complete: "yes" })), null);
});
