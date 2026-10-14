const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activate, deactivate } = require("../out/index");

test("typed mail notifications honor suppression, use safe history, end per account and never beep", async () => {
  let tick,
    onChanged,
    acknowledged = [],
    suppressed = false;
  const commands = new Map(),
    published = [],
    ended = [],
    sounds = [];
  const values = { notifications: true, notificationDetails: true };
  const keys = [];
  const observation = (key) => {
    keys.unshift(key);
    return {
      ready: true,
      context: "inbox",
      document: "one",
      revision: Date.now(),
      keys: [...keys],
      unread: [key],
      read: keys.slice(1),
    };
  };
  const account = {
    id: "one",
    name: "Private account",
    monitoring: true,
    sound: { enabled: true, file: "" },
    observation: observation("first"),
  };
  const c = {
    commands: {
      register(id, _title, fn) {
        commands.set(id, fn);
      },
    },
    ui: { async showPanel() {} },
    tray: { add() {}, async attention() {} },
    settings: {
      get: (key, fallback) => values[key] ?? fallback,
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
        throw Error(text);
      },
    },
    audio: {
      async play(file) {
        sounds.push(file);
      },
    },
    notifications: {
      async publish(input) {
        published.push(input);
        return suppressed
          ? { status: "suppressed", reason: "type-disabled" }
          : { status: "accepted", notificationId: String(published.length) };
      },
      async end(id, status) {
        ended.push({ id, status });
      },
    },
    webAccounts: {
      async start() {},
      async open() {},
      async read() {
        const result = { accounts: [account], acknowledged };
        acknowledged = [];
        return result;
      },
      async report() {},
    },
  };
  try {
    await activate(c);
    assert.equal(published[0].typeId, "new-mail");
    assert.equal(published[0].silent, true);
    assert.deepEqual(published[0].historyText, {
      title: "Gmailの新着メール",
      body: "未読の新着メールを検知しました。",
    });
    assert.deepEqual(sounds, []);
    await tick();
    assert.equal(published.length, 1);
    account.observation = observation("second");
    await tick();
    assert.deepEqual(ended, [{ id: "1", status: "withdrawn" }]);
    await commands.get("at365.gmail.acknowledge")();
    assert.deepEqual(ended.at(-1), { id: "2", status: "resolved" });
    suppressed = true;
    account.observation = observation("third");
    await tick();
    suppressed = false;
    await tick();
    assert.equal(
      published.length,
      3,
      "policy changes do not replay old arrivals",
    );
    account.observation = observation("fourth");
    await tick();
    values.notifications = false;
    await onChanged();
    assert.deepEqual(ended.at(-1), { id: "4", status: "withdrawn" });
    assert.equal(published.length, 4);
  } finally {
    await deactivate();
  }
});

test("per-account monitoring clears only its history and attention, suppresses sound, and reimports unread on resume", async () => {
  let tick,
    resets = [];
  const accounts = ["one", "two"].map((id) => ({
    id,
    name: id,
    error: "",
    monitoring: id === "two",
    sound: { enabled: true, file: id + ".wav" },
    observation: {
      ready: true,
      context: "inbox",
      document: id,
      revision: 1,
      keys: ["unread"],
      unread: ["unread"],
      read: [],
    },
  }));
  const reports = new Map(),
    notices = [],
    sounds = [],
    attention = [];
  const c = {
    commands: { register() {} },
    ui: { async showPanel() {} },
    tray: {
      add() {},
      async attention(value) {
        attention.push(value);
      },
    },
    notifications: {
      async end() {},
      async publish(request) {
        notices.push(request.title);
        return { status: "accepted", notificationId: String(notices.length) };
      },
    },
    audio: {
      async play(file) {
        sounds.push(file);
      },
    },
    settings: { get: (key, fallback) => fallback, onChanged() {} },
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
        const data = { accounts, acknowledged: [], monitoringResets: resets };
        resets = [];
        return data;
      },
      async report(id, status, value, data) {
        reports.set(id, { status, attention: value, data });
      },
    },
  };
  try {
    await activate(c);
    assert.equal(reports.get("one").data.pending, 0);
    assert.equal(reports.get("two").data.pending, 1);
    assert.deepEqual(sounds, ["two.wav"]);
    assert.equal(notices.length, 1);
    accounts[1].monitoring = false;
    resets = ["two"];
    await tick();
    assert.equal(reports.get("two").data.arrivals.length, 0);
    assert.equal(attention.at(-1), false);
    accounts[0].monitoring = true;
    resets = ["one"];
    await tick();
    assert.equal(reports.get("one").data.pending, 1);
    assert.equal(reports.get("two").data.pending, 0);
    assert.deepEqual(sounds, ["two.wav", "one.wav"]);
    await tick();
    assert.equal(notices.length, 2);
    // Even an OFF/ON entirely between ticks must establish a new baseline.
    resets = ["one"];
    await tick();
    assert.equal(notices.length, 3);
  } finally {
    await deactivate();
  }
});

test("account sounds are independent of desktop notifications and cycle commands keep stable IDs", async () => {
  let tick;
  const sounds = [],
    commands = new Map(),
    cycles = [],
    navigations = [],
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
      async navigate(action) {
        navigations.push(action);
      },
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
      async end() {},
      async publish(request) {
        notices.push(request);
        return { status: "accepted", notificationId: String(notices.length) };
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
    for (const action of ["back", "forward", "reload", "inbox"])
      await commands.get("at365.gmail." + action)();
    assert.deepEqual(navigations, ["back", "forward", "reload", "inbox"]);
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
    assert.ok(
      notices.every(
        (notice) =>
          notice.silent === true &&
          notice.actions[0].command === "at365.gmail.open" &&
          notice.typeId === "new-mail",
      ),
    );
    await commands.get("at365.gmail.acknowledge")();
    assert.equal(sounds.length, 2);
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
      async end() {},
      async publish(request) {
        notifications.push(request);
        return {
          status: "accepted",
          notificationId: String(notifications.length),
        };
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
    assert.equal(notifications[0].silent, true);
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
