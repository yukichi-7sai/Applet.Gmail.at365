const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activate, deactivate } = require("../out/index");

test("account sounds are independent of desktop notifications and cycle commands keep stable IDs", async () => {
  let tick;
  const sounds = [],
    commands = new Map(),
    cycles = [],
    notices = [];
  const observation = (keys, unread) => ({
    ready: true,
    context: "inbox",
    document: "one",
    revision: 1,
    keys,
    unread,
    read: keys.filter((key) => !unread.includes(key)),
  });
  const accounts = [
    {
      id: "one",
      name: "One",
      error: "",
      sound: { enabled: true, file: "C:\\fixture\\one.wav" },
      observation: observation(["a"], []),
    },
    {
      id: "two",
      name: "Two",
      error: "",
      sound: { enabled: false, file: "C:\\fixture\\two.wav" },
      observation: observation(["a"], []),
    },
  ];
  let enabled = true,
    notifications = false;
  const context = {
    commands: {
      register(id, title, handler) {
        commands.set(id, handler);
      },
    },
    webAccounts: {
      async start() {},
      async open() {},
      async cycle(direction) {
        cycles.push(direction);
      },
      async read() {
        return { accounts, acknowledged: [] };
      },
      async report() {},
    },
    audio: {
      async play(file) {
        sounds.push(file);
      },
    },
    tray: { add() {}, async attention() {} },
    ui: { async showPanel() {} },
    notifications: {
      async show(...args) {
        notices.push(args);
      },
    },
    settings: {
      get: (key, fallback) =>
        key === "monitoring"
          ? enabled
          : key === "notifications"
            ? notifications
            : fallback,
      onChanged() {},
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
  };
  try {
    await activate(context);
    await commands.get("at365.gmail.nextAccount")();
    await commands.get("at365.gmail.previousAccount")();
    assert.deepEqual(cycles, [1, -1]);
    for (const account of accounts)
      account.observation = observation(["new", "a"], ["new"]);
    await tick();
    assert.deepEqual(sounds, ["C:\\fixture\\one.wav"]);
    assert.equal(notices.length, 0);
    accounts[0].sound.enabled = false;
    accounts[1].sound.enabled = true;
    notifications = true;
    for (const account of accounts)
      account.observation = observation(["next", "new", "a"], ["next", "new"]);
    await tick();
    assert.deepEqual(sounds, ["C:\\fixture\\one.wav", "C:\\fixture\\two.wav"]);
    assert.equal(notices.length, 2);
    assert.ok(notices.every((notice) => notice[2].silent === true));
    await tick();
    assert.equal(sounds.length, 2);
    enabled = false;
    await tick();
    assert.equal(sounds.length, 2);
  } finally {
    await deactivate();
  }
});
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
      async show(title, body, options) {
        notifications.push({ title, body, options });
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
    assert.equal(notifications[0].options.silent, true);
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
