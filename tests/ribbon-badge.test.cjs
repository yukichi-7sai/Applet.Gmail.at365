const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activate, deactivate } = require("../out/index");
function fixture() {
  const commands = new Map(),
    badges = [],
    reports = [],
    errors = [],
    notices = [];
  const settings = { monitoring: true, notifications: true };
  let tick,
    onChanged,
    acknowledged = [],
    failBadge = false,
    waitReport;
  const accounts = ["one", "two"].map((id) => ({
    id,
    name: id,
    error: "",
    monitoring: true,
    observation: {
      ready: true,
      context: "inbox",
      document: id,
      revision: 1,
      keys: ["a", "b"],
      unread: ["a", "b"],
      read: [],
    },
  }));
  const context = {
    ribbon: {
      async setBadge(target, value) {
        badges.push({ target, value });
        if (failBadge) throw Error("fixture badge failure");
      },
    },
    commands: {
      register(id, _title, fn) {
        commands.set(id, fn);
      },
    },
    ui: { async showPanel() {} },
    tray: { add() {}, async attention() {} },
    audio: { async play() {} },
    settings: {
      get: (key, fallback) => settings[key] ?? fallback,
      onChanged(fn) {
        onChanged = fn;
      },
    },
    scheduler: {
      every(_ms, fn) {
        tick = fn;
        return () => {};
      },
    },
    log: {
      async error(text) {
        errors.push(text);
      },
    },
    notifications: {
      async publish(input) {
        notices.push(input);
        return { status: "accepted", notificationId: String(notices.length) };
      },
      async end() {},
    },
    webAccounts: {
      async start() {},
      async open() {},
      async read() {
        const value = { accounts, acknowledged };
        acknowledged = [];
        return value;
      },
      async report(...args) {
        reports.push(args);
        if (waitReport) {
          const work = waitReport;
          waitReport = undefined;
          await work;
        }
      },
    },
  };
  return {
    accounts,
    commands,
    settings,
    context,
    badges,
    reports,
    errors,
    notices,
    tick: () => tick(),
    changed: () => onChanged(),
    acknowledge: (id) => acknowledged.push(id),
    fail: (value) => (failBadge = value),
    wait: (value) => (waitReport = value),
  };
}

test("Gmail badge sums current monitored accounts, follows read/acknowledge/disable/delete and does not replay equal values", async () => {
  const f = fixture();
  try {
    await activate(f.context);
    assert.deepEqual(f.badges.at(-1), {
      target: { pageId: "gmail" },
      value: { kind: "count", count: 4, label: "未読の新着スレッド" },
    });
    await f.tick();
    assert.equal(f.badges.length, 1);
    f.accounts[0].observation.unread = ["b"];
    f.accounts[0].observation.read = ["a"];
    f.accounts[0].observation.revision++;
    await f.tick();
    assert.equal(f.badges.at(-1).value.count, 3);
    f.acknowledge("one");
    await f.tick();
    assert.equal(f.badges.at(-1).value.count, 2);
    f.accounts[1].monitoring = false;
    await f.tick();
    assert.equal(f.badges.at(-1).value, null);
    f.accounts[1].monitoring = true;
    await f.tick();
    assert.equal(f.badges.at(-1).value.count, 2);
    f.accounts.splice(1, 1);
    await f.tick();
    assert.equal(f.badges.at(-1).value, null);
    f.settings.monitoring = false;
    await f.changed();
    assert.equal(f.badges.at(-1).value, null);
  } finally {
    await deactivate();
  }
});

test("badge failure leaves monitoring and notices working, logs once, retries only newest count on normal tick", async () => {
  const f = fixture();
  f.fail(true);
  try {
    await activate(f.context);
    assert.equal(f.reports.length, 2);
    assert.equal(f.notices.length, 2);
    await f.tick();
    assert.equal(f.errors.length, 1);
    assert.equal(f.badges.length, 2);
    f.accounts.pop();
    f.fail(false);
    await f.tick();
    assert.equal(f.badges.at(-1).value.count, 2);
    await f.tick();
    assert.equal(f.badges.length, 3);
    await f.commands.get("at365.gmail.acknowledge")();
    assert.equal(f.badges.at(-1).value, null);
  } finally {
    await deactivate();
  }
});

test("acknowledge clears badge immediately while a monitoring tick is waiting", async () => {
  const f = fixture();
  let release;
  try {
    await activate(f.context);
    f.wait(new Promise((resolve) => (release = resolve)));
    const pending = f.tick();
    await new Promise((resolve) => setImmediate(resolve));
    await f.commands.get("at365.gmail.acknowledge")();
    assert.equal(f.badges.at(-1).value, null);
    release();
    await pending;
    assert.equal(f.badges.at(-1).value, null);
  } finally {
    release?.();
    await deactivate();
  }
});
