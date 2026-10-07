const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activate, deactivate } = require("../out/index");
test("runtime reports arrivals and keeps notification metadata opt-in; settings changes do not erase baseline", async () => {
  let tick,
    onChanged,
    acknowledged = [],
    observation;
  const values = {
    monitoring: true,
    notifications: true,
    notificationDetails: false,
  };
  const notifications = [],
    reports = [];
  const context = {
    commands: { register() {} },
    tray: { add() {}, async attention() {} },
    notifications: {
      async show(title, body) {
        notifications.push({ title, body });
      },
    },
    ui: { async showPanel() {} },
    settings: {
      get: (key, fallback) => values[key] ?? fallback,
      onChanged(handler) {
        onChanged = handler;
      },
    },
    scheduler: {
      every(ms, handler) {
        tick = handler;
        return () => {};
      },
    },
    log: {
      async error(message) {
        throw Error(message);
      },
    },
    webAccounts: {
      async start() {},
      async open() {},
      async read() {
        const data = {
          accounts: [{ id: "one", name: "Test", error: "", observation }],
          acknowledged,
        };
        acknowledged = [];
        return data;
      },
      async report(id, status, attention, data) {
        reports.push({ id, status, attention, data });
      },
    },
  };
  const o = (keys, unread = []) => ({
    ready: true,
    context: "inbox",
    document: "one",
    revision: 1,
    keys,
    unread,
    read: keys.filter((key) => !unread.includes(key)),
    details: keys.map((key) => ({
      key,
      sender: "Fixture sender",
      subject: "Private fixture subject",
    })),
  });
  observation = o(["old"]);
  try {
    await activate(context);
    observation = o(["new", "old"], ["new"]);
    await tick();
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].body, "未読の新着を 1 件検知しました。");
    assert.equal(
      reports.at(-1).data.arrivals[0].subject,
      "Private fixture subject",
    );
    values.notificationDetails = true;
    await onChanged();
    assert.equal(reports.at(-1).data.pending, 1);
    observation = o(["newer", "new", "old"], ["newer", "new"]);
    await tick();
    assert.match(
      notifications.at(-1).body,
      /Fixture sender：Private fixture subject/,
    );
    acknowledged = ["one"];
    await tick();
    assert.equal(reports.at(-1).data.pending, 0);
    assert.equal(reports.at(-1).data.arrivals.length, 2);
    values.monitoring = false;
    await onChanged();
    assert.equal(reports.at(-1).data.arrivals.length, 0);
    values.monitoring = true;
    observation = o(
      ["while-off", "newer", "new", "old"],
      ["while-off", "newer"],
    );
    await onChanged();
    assert.equal(notifications.length, 3);
    assert.equal(reports.at(-1).data.pending, 2);
    observation = o(["while-off", "newer", "new", "old"]);
    await tick();
    assert.equal(reports.at(-1).data.pending, 0);
    assert.equal(reports.at(-1).attention, false);
    assert.equal(notifications.length, 3);
  } finally {
    await deactivate();
  }
});
