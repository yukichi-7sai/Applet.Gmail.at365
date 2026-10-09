// Offline GUI: navigation, toolbar preferences, external-link consent and notification clicks.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module"),
  { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", `toolbar-${Date.now()}`);
const accounts = ["One", "Two"].map((name) => ({ id: randomUUID(), name }));
const accountRoot = path.join(profile, ".appdock/web-accounts/at365.gmail");
fs.mkdirSync(accountRoot, { recursive: true });
fs.writeFileSync(
  path.join(accountRoot, "accounts.json"),
  JSON.stringify({ version: 1, selected: accounts[0].id, accounts }),
);
fs.cpSync(
  path.join(root, "publish/Applet.Gmail.at365"),
  path.join(profile, "extensions/Applet.Gmail.at365"),
  { recursive: true },
);
const settings = hostRequire(
  "./out/main/shared/settings-schema",
).createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.globalShortcutCommands = [];
settings.shortcuts["at365.gmail.reload"] = ["Ctrl+Alt+R"];
settings.extensions["at365.gmail"] = { enabled: false, settings: {} };
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app, dock, ui;
const checks = [];
const until = async (fn, name) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(name);
};
const button = (name) => ui.getByRole("button", { name, exact: true });
const snapshot = () => ui.evaluate(() => window.webAccounts.snapshot());
const command = (name) =>
  dock.evaluate((id) => window.dock.executeCommand("at365.gmail." + id), name);
const geometry = () =>
  ui.evaluate(() => ({
    account: document
      .querySelector(".accounts .account")
      .getBoundingClientRect().top,
    main: document.querySelector("main").getBoundingClientRect().top,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
const changeHost = (patch) =>
  dock.evaluate(
    (patch) =>
      window.dock.snapshot().then((s) =>
        window.dock.saveSettings(
          {
            ...s.settings.value,
            extensions: {
              ...s.settings.value.extensions,
              "at365.gmail": {
                ...s.settings.value.extensions["at365.gmail"],
                settings: {
                  ...s.settings.value.extensions["at365.gmail"].settings,
                  ...patch,
                },
              },
            },
          },
          s.settings.revision,
        ),
      ),
    patch,
  );
const remote = async (id, source) =>
  app.evaluate(
    ({ webContents }, { id, source }) =>
      webContents.fromId(id).executeJavaScript(source, true),
    { id, source },
  );
async function launch() {
  app = await electron.launch({
    executablePath: process.argv[2]
      ? path.resolve(process.argv[2])
      : hostRequire("electron"),
    args: [...(process.argv[2] ? [] : [host]), `--test-profile=${profile}`],
    env,
  });
  dock = await app.firstWindow();
  dock.setDefaultTimeout(15000);
  await dock.getByRole("heading", { name: "ホーム", exact: true }).waitFor();
  await app.evaluate(({ app, Notification, dialog, shell }) => {
    globalThis.capturedNotices = [];
    Notification.isSupported = () => true;
    Notification.prototype.show = function () {
      capturedNotices.push(this);
    };
    globalThis.externalCalls = [];
    globalThis.linkPrompts = [];
    globalThis.linkAnswer = { response: 0, checkboxChecked: false };
    dialog.showMessageBox = async (_window, options) => {
      linkPrompts.push(options);
      return linkAnswer;
    };
    shell.openExternal = async (url) => {
      externalCalls.push(url);
    };
    globalThis.fixtureLoads = 0;
    app.on("session-created", (session) => {
      if (!session.isPersistent()) return;
      session.protocol.handle("https", () => {
        fixtureLoads++;
        return new Response(
          '<!doctype html><title>Offline Gmail</title><main role="main"><table><tbody><tr class="zA zE"><td class="yW"><span name="Fixture">Fixture</span></td><td><span class="bog" data-legacy-thread-id="first">Offline mail</span></td></tr></tbody></table></main>',
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      });
    });
  });
  await command("open");
  await until(() => {
    ui = app
      .context()
      .pages()
      .find((p) => p.url().endsWith("/web/index.html"));
    return !!ui;
  }, "UI opens");
  ui.setDefaultTimeout(15000);
  await until(
    async () => (await snapshot()).accounts.every((a) => a.data?.pending === 1),
    "Both accounts observed",
  );
}
(async () => {
  try {
    await launch();
    assert.equal(
      await ui.locator(".brand small").textContent(),
      `v${require("../package.json").version}`,
    );
    const titles = ["戻る", "進む", "リロード", "受信トレイへ"];
    assert.equal(await ui.locator(".navigation button").count(), 4);
    for (const title of titles) {
      assert.equal(await button(title).getAttribute("title"), title);
      assert.equal(await button(title).locator("svg").count(), 1);
      assert.equal((await button(title).textContent()).trim(), "");
    }
    assert.equal(await button("新着表示をクリア").count(), 0);
    assert.deepEqual(await geometry(), {
      account: 130,
      main: 130,
      overflow: false,
    });
    await ui.screenshot({ path: path.join(profile, "toolbar-icons.png") });
    const registered = (
      await dock.evaluate(() => window.dock.snapshot())
    ).extensions
      .find((e) => e.id === "at365.gmail")
      .commands.map((c) => c.id);
    for (const id of ["back", "forward", "reload", "inbox", "acknowledge"])
      assert.ok(registered.includes(`at365.gmail.${id}`));
    const remoteIds = await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .filter((wc) => wc.getURL().startsWith("https://mail.google.com"))
        .map((wc) => wc.id),
    );
    assert.equal(remoteIds.length, 2);
    const first = remoteIds[0];
    await app.evaluate(({ webContents }, id) => {
      globalThis.navigationLoads = 0;
      webContents.fromId(id).on("did-start-loading", () => navigationLoads++);
    }, first);
    // A hash change identifies the account owning this view without exposing session contents.
    await remote(first, 'location.hash="folder-one"');
    await until(
      async () =>
        (await snapshot()).accounts.some((a) => a.url.endsWith("#folder-one")),
      "Folder one",
    );
    const targetAccount = (await snapshot()).accounts.find((a) =>
      a.url.endsWith("#folder-one"),
    );
    await ui.evaluate((id) => window.webAccounts.select(id), targetAccount.id);
    await remote(first, 'location.hash="folder-two"');
    await until(
      async () =>
        (await snapshot()).accounts
          .find((a) => a.id === targetAccount.id)
          .url.endsWith("#folder-two"),
      "Folder two",
    );
    await command("back");
    await until(
      async () =>
        (await snapshot()).accounts
          .find((a) => a.id === targetAccount.id)
          .url.endsWith("#folder-one"),
      "Back command",
    );
    await command("forward");
    await until(
      async () =>
        (await snapshot()).accounts
          .find((a) => a.id === targetAccount.id)
          .url.endsWith("#folder-two"),
      "Forward command",
    );
    await until(
      () =>
        app.evaluate(
          ({ webContents }, id) => !webContents.fromId(id).isLoading(),
          first,
        ),
      "History navigation settles",
    );
    let loads = await app.evaluate(() => navigationLoads);
    await command("reload");
    await until(
      () =>
        app.evaluate((_electron, before) => navigationLoads > before, loads),
      "Reload command",
    );
    await button("設定").click();
    await command("inbox");
    await until(
      async () =>
        (await button("受信トレイ").getAttribute("aria-pressed")) === "true",
      "Inbox command returns to inbox tab",
    );
    await until(
      async () =>
        (await snapshot()).accounts
          .find((a) => a.id === targetAccount.id)
          .url.endsWith("#inbox"),
      "Inbox URL",
    );
    await until(
      () =>
        app.evaluate(
          ({ webContents }, id) => !webContents.fromId(id).isLoading(),
          first,
        ),
      "Inbox load settles",
    );
    loads = await app.evaluate(() => navigationLoads);
    await app.evaluate(({ webContents }, id) => {
      const wc = webContents.fromId(id);
      wc.focus();
      wc.sendInputEvent({
        type: "keyDown",
        keyCode: "R",
        modifiers: ["control", "alt"],
      });
      wc.sendInputEvent({
        type: "keyUp",
        keyCode: "R",
        modifiers: ["control", "alt"],
      });
    }, first);
    await until(
      () =>
        app.evaluate((_electron, before) => navigationLoads > before, loads),
      "Custom navigation shortcut",
    );
    await command("acknowledge");
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data?.pending === 0),
      "Clear command clears all accounts",
    );
    checks.push(
      "Four icon buttons and command-name tooltips; inbox clear button removed; manifest commands; selected-account history/reload/inbox and custom shortcut; clear across accounts",
    );

    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await ui.getByLabel("未読だけ", { exact: true }).check();
    await until(
      async () => (await snapshot()).settings.unreadOnly === true,
      "Unread-only saves",
    );
    for (const tab of ["新着一覧", "アカウント設定", "設定"]) {
      await (
        tab === "新着一覧"
          ? ui.getByRole("button", { name: /^新着一覧/ })
          : button(tab)
      ).click();
      const g = await geometry();
      assert.equal(g.account, 130);
      assert.equal(g.main, 146);
    }
    await ui.getByLabel("ツールバーを表示", { exact: true }).uncheck();
    await until(
      async () => (await snapshot()).settings.showToolbar === false,
      "Toolbar preference saves",
    );
    for (const tab of ["受信トレイ", "新着一覧", "アカウント設定", "設定"]) {
      await (
        tab === "新着一覧"
          ? ui.getByRole("button", { name: /^新着一覧/ })
          : button(tab)
      ).click();
      assert.equal(await ui.locator(".toolbar").count(), 0);
      assert.deepEqual(await geometry(), {
        account: 66,
        main: 66,
        overflow: false,
      });
    }
    await ui.screenshot({ path: path.join(profile, "toolbar-hidden.png") });
    await changeHost({ showToolbar: true });
    await until(
      async () => (await ui.locator(".toolbar").count()) === 1,
      "Host toolbar setting synchronizes",
    );
    await button("受信トレイ").click();
    assert.equal((await geometry()).account, 130);
    checks.push(
      "Account list stays at inbox top across tabs; toolbar hidden across every tab; UI and host preference synchronization",
    );

    const popup = async (url) => {
      await remote(
        first,
        `window.open(${JSON.stringify(url)}, '_blank'); true`,
      );
    };
    await app.evaluate(() => {
      linkAnswer = { response: 0, checkboxChecked: true };
    });
    await popup("https://external.example.test/cancel");
    await until(
      () => app.evaluate(() => linkPrompts.length === 1),
      "Cancel link prompt",
    );
    assert.equal(
      (await snapshot()).settings.openExternalWithoutConfirmation,
      false,
    );
    assert.deepEqual(await app.evaluate(() => externalCalls), []);
    assert.equal(
      await app.evaluate(() => linkPrompts[0].checkboxLabel),
      "次回から聞かずに開く",
    );
    await app.evaluate(() => {
      linkAnswer = { response: 1, checkboxChecked: false };
    });
    await popup("https://external.example.test/once");
    await until(
      () => app.evaluate(() => externalCalls.length === 1),
      "Open once",
    );
    assert.equal(
      (await snapshot()).settings.openExternalWithoutConfirmation,
      false,
    );
    await app.evaluate(() => {
      linkAnswer = { response: 1, checkboxChecked: true };
    });
    await popup("https://external.example.test/remember");
    await until(
      async () =>
        (await snapshot()).settings.openExternalWithoutConfirmation === true,
      "Remember saves",
    );
    await until(
      () => app.evaluate(() => externalCalls.length === 2),
      "Remembered open",
    );
    await popup("mailto:test@example.test");
    await until(
      () => app.evaluate(() => externalCalls.length === 3),
      "No-dialog external open",
    );
    assert.equal(await app.evaluate(() => linkPrompts.length), 3);
    await button("設定").click();
    await ui
      .getByLabel("外部リンクを確認せずに開く", { exact: true })
      .uncheck();
    await until(
      async () => !(await snapshot()).settings.openExternalWithoutConfirmation,
      "Reset link preference",
    );
    await popup("https://external.example.test/ask-again");
    await until(
      () => app.evaluate(() => linkPrompts.length === 4),
      "Ask again",
    );
    await until(
      () => app.evaluate(() => externalCalls.length === 4),
      "Ask-again open",
    );
    for (const url of [
      "file:///C:/fixture.txt",
      "https://user:password@external.example.test/",
    ])
      await popup(url);
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(await app.evaluate(() => linkPrompts.length), 4);
    assert.equal(await app.evaluate(() => externalCalls.length), 4);
    checks.push(
      "External-link cancel never remembers; open once; checked confirmation persists; HTTP(S)/mailto no-dialog path; UI restores confirmation; unsafe schemes/credentials rejected without launching apps",
    );

    assert.ok(await app.evaluate(() => capturedNotices.length >= 2));
    await dock
      .locator(".activity-rail")
      .getByRole("button", { name: "ホーム", exact: true })
      .click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL() === "appdock://host/index.html")
        .minimize(),
    );
    await app.evaluate(() => capturedNotices[0].emit("click"));
    await until(
      async () =>
        (await dock
          .locator('[data-ribbon-id="page:at365.gmail:gmail"]')
          .getAttribute("aria-current")) === "page",
      "Notification opens Gmail page",
    );
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL() === "appdock://host/index.html")
          .isMinimized(),
      ),
      false,
    );
    // The same click respects the user's separate-window setting.
    await dock.evaluate(() =>
      window.dock.snapshot().then((s) =>
        window.dock.saveSettings(
          {
            ...s.settings.value,
            extensions: {
              ...s.settings.value.extensions,
              "at365.gmail": {
                ...s.settings.value.extensions["at365.gmail"],
                pages: { gmail: { display: "window" } },
              },
            },
          },
          s.settings.revision,
        ),
      ),
    );
    await command("open");
    await until(
      () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some(
            (w) => w.getTitle() === "Gmail" && w.isVisible(),
          ),
        ),
      "Separate window",
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === "Gmail")
        .hide(),
    );
    await app.evaluate(() => capturedNotices[0].emit("click"));
    await until(
      () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some(
            (w) => w.getTitle() === "Gmail" && w.isVisible(),
          ),
        ),
      "Notification opens separate window",
    );
    await changeHost({
      showToolbar: false,
      openExternalWithoutConfirmation: true,
    });
    await dock.evaluate(() =>
      window.dock.snapshot().then((s) =>
        window.dock.saveSettings(
          {
            ...s.settings.value,
            extensions: {
              ...s.settings.value.extensions,
              "at365.gmail": {
                ...s.settings.value.extensions["at365.gmail"],
                enabled: false,
              },
            },
          },
          s.settings.revision,
        ),
      ),
    );
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === "at365.gmail",
        ).state === "stopped",
      "Disabled",
    );
    await app.evaluate(() => capturedNotices[0].emit("click"));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(
      (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
        (e) => e.id === "at365.gmail",
      ).state,
      "stopped",
    );
    checks.push(
      "Real Notification click handler executes Gmail open command, restores main page or selected window; stale click cannot reactivate a disabled Applet",
    );
    assert.deepEqual(
      (await dock.evaluate(() => window.dock.snapshot())).logs.filter(
        (l) => l.level === "error",
      ),
      [],
    );
    await app.close();
    app = null;
    await launch();
    assert.equal((await snapshot()).settings.showToolbar, false);
    assert.equal(
      (await snapshot()).settings.openExternalWithoutConfirmation,
      true,
    );
    assert.equal(await ui.locator(".toolbar").count(), 0);
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    assert.equal(
      await ui.getByLabel("未読だけ", { exact: true }).isChecked(),
      true,
    );
    assert.equal((await snapshot()).settings.unreadOnly, true);
    const restartRemote = await app.evaluate(
      ({ webContents }) =>
        webContents
          .getAllWebContents()
          .find((w) => w.getURL().startsWith("https://mail.google.com")).id,
    );
    await remote(
      restartRemote,
      "window.open('https://external.example.test/restart', '_blank'); true",
    );
    await until(
      () => app.evaluate(() => externalCalls.length === 1),
      "Restart keeps skip confirmation",
    );
    assert.equal(await app.evaluate(() => linkPrompts.length), 0);
    await ui.screenshot({ path: path.join(profile, "restart-hidden.png") });
    checks.push(
      "Toolbar, external-link and unread-only preferences survive restart",
    );
    await app.close();
    app = null;
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify({ ok: true, checks }, null, 2),
    );
    console.log(JSON.stringify({ ok: true, profile, checks }));
  } catch (error) {
    console.error(error);
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify({ ok: false, checks, error: String(error) }, null, 2),
    );
    if (app) {
      try {
        await ui?.screenshot({ path: path.join(profile, "failure.png") });
      } catch {}
      await app.close().catch(() => {});
    }
    process.exitCode = 1;
  }
})();
