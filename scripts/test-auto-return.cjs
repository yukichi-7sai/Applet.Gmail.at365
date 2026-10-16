const { getPublishDirectory } = require('../../AppDock.at365/scripts/publish-paths.cjs');
// Offline Gmail navigation in real WebContents and an isolated host profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module"),
  { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", "auto-return-" + Date.now());
const accounts = ["One", "Two"].map((name) => ({ id: randomUUID(), name }));
const accountRoot = path.join(profile, "data/web-accounts/at365.gmail");
fs.mkdirSync(accountRoot, { recursive: true });
fs.writeFileSync(
  path.join(accountRoot, "accounts.json"),
  JSON.stringify({ version: 1, selected: accounts[0].id, accounts }),
);
fs.cpSync(
  path.join(getPublishDirectory(root), "Applet.Gmail.at365"),
  path.join(profile, "extensions/Applet.Gmail.at365"),
  { recursive: true },
);
const settings = hostRequire(
  "./out/main/shared/settings-schema",
).createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.globalShortcutCommands = [];
settings.keybindings = [];
settings.gestures.enabled = false;
settings.host.notifications = false;
settings.extensions["at365.gmail"] = {
  enabled: false,
  settings: { monitoring: false, notifications: false },
};
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app, dock, ui, ribbon;
const checks = [];
const until = async (fn, name) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(name);
};
const snapshot = () => ui.evaluate(() => window.webAccounts.snapshot());
const command = (name) =>
  dock.evaluate((id) => window.dock.executeCommand("at365.gmail." + id), name);
const button = (name) => ui.getByRole("button", { name, exact: true });
const route = (id, hash) =>
  app.evaluate(
    ({ webContents }, { id, hash }) =>
      webContents
        .fromId(id)
        .executeJavaScript(
          "location.hash = " + JSON.stringify(hash) + "; true",
        ),
    { id, hash },
  );
const url = (id) =>
  app.evaluate(({ webContents }, id) => webContents.fromId(id).getURL(), id);
const hostSettings = (patch) =>
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
                ...patch,
              },
            },
          },
          s.settings.revision,
        ),
      ),
    patch,
  );

async function launchHost() {
  if (!process.argv[2])
    return electron.launch({
      executablePath: hostRequire("electron"),
      args: [
        host,
        "--test-profile=" + profile,
        "--test-local-state=" + path.join(profile, "data"),
      ],
      env,
    });
  // Portable NSIS does not forward the Electron child's inspector output.
  const { spawn } = require("node:child_process");
  const { chromium } = hostRequire("playwright");
  const { freePort, inspect, electronExpression } = hostRequire(
    "./scripts/electron-main-helper.cjs",
  );
  const port = await freePort(),
    mainPort = await freePort();
  const child = spawn(
    path.resolve(process.argv[2]),
    [
      "--test-profile=" + profile,
      "--test-local-state=" + path.join(profile, "data"),
      "--remote-debugging-port=" + port,
      "--inspect=" + mainPort,
    ],
    { env, windowsHide: true, stdio: "ignore" },
  );
  let browser;
  await until(async () => {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:" + port, {
        timeout: 1000,
      });
      return true;
    } catch {
      return false;
    }
  }, "Portable CDP connects");
  await until(async () => {
    try {
      return (await inspect(mainPort, "1")) === 1;
    } catch {
      return false;
    }
  }, "Portable main inspector connects");
  let main;
  await until(() => {
    main = browser
      .contexts()[0]
      .pages()
      .find((page) => page.url().startsWith("appdock://host/"));
    return !!main;
  }, "Portable host renderer");
  return {
    firstWindow: async () => main,
    context: () => browser.contexts()[0],
    evaluate: (fn, arg) =>
      inspect(
        mainPort,
        "(" +
          fn.toString() +
          ")(" +
          electronExpression +
          ", " +
          JSON.stringify(arg) +
          ")",
      ),
    close: async () => {
      await inspect(
        mainPort,
        "setTimeout(() => " + electronExpression + ".app.quit(), 100); true",
      );
      await until(() => child.exitCode !== null, "Portable shutdown");
      assert.equal(child.exitCode, 0);
      await browser.close().catch(() => {});
    },
  };
}

async function launch() {
  const saved = JSON.parse(
    fs.readFileSync(path.join(profile, "settings.json")),
  );
  saved.extensions["at365.gmail"].enabled = false;
  fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(saved));
  app = await launchHost();
  assert.equal(
    await app.evaluate(({ app }) => app.getVersion()),
    hostRequire("./package.json").version,
  );
  dock = await app.firstWindow();
  dock.setDefaultTimeout(15000);
  await hostRequire("./scripts/shell-overlay-helper.cjs").homePage(dock);
  ribbon = await hostRequire("./scripts/shell-overlay-helper.cjs").ribbonPage(
    dock,
  );
  await app.evaluate(({ app }) => {
    globalThis.fixtureRequests = 0;
    globalThis.holdNextRequest = false;
    globalThis.releaseHeldRequest = null;
    app.on("session-created", (session) => {
      if (!session.isPersistent()) return;
      session.protocol.handle("https", async () => {
        fixtureRequests++;
        if (holdNextRequest) {
          holdNextRequest = false;
          await new Promise((resolve) => {
            releaseHeldRequest = resolve;
          });
          releaseHeldRequest = null;
        }
        return new Response(
          '<!doctype html><title>Offline Gmail</title><main role="main"><input id="draft" value="preserved"><table><tr class="zA zE"><td class="yW"><span name="Fixture">Fixture</span></td><td><span class="bog" data-legacy-thread-id="first">Offline mail</span></td></tr></table></main>',
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
  }, "Gmail UI opens");
  ui.setDefaultTimeout(15000);
  await until(
    async () =>
      (await snapshot()).accounts.every(
        (a) => a.url.endsWith("#inbox") && !a.loading,
      ),
    "Both accounts loaded",
  );
}
(async () => {
  try {
    await launch();
    const ids = await app.evaluate(
      ({ webContents, session }, directories) =>
        directories.map(
          (directory) =>
            webContents
              .getAllWebContents()
              .find(
                (wc) =>
                  wc.session === session.fromPath(directory) &&
                  wc.getURL().startsWith("https://mail.google.com"),
              ).id,
        ),
      accounts.map((account) => path.join(accountRoot, "sessions", account.id)),
    );
    assert.equal(ids.length, 2);
    const first = ids[0],
      second = ids[1];
    await route(first, "#sent");
    await command("nextAccount");
    assert.ok((await url(first)).endsWith("#sent"));
    await command("previousAccount");
    await button("設定").click();
    const toggle = ui.getByRole("checkbox", {
      name: "非表示になったら受信トレイへ戻す",
      exact: true,
    });
    assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    await until(
      async () => (await snapshot()).settings.returnToInboxOnHide === true,
      "Setting saves",
    );
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(profile, "settings.json")))
        .extensions["at365.gmail"].settings.returnToInboxOnHide,
      true,
    );
    await button("受信トレイ").click();
    const initialRequests = await app.evaluate(() => fixtureRequests);
    await app.evaluate(
      ({ webContents }, id) =>
        webContents
          .fromId(id)
          .executeJavaScript(
            "document.querySelector('#draft').value = 'keep typed input'; true",
          ),
      first,
    );
    await route(first, "#sent");
    await route(second, "#all");
    await command("nextAccount");
    await until(
      async () => (await url(first)).endsWith("#inbox"),
      "Shortcut returns old account",
    );
    assert.ok((await url(second)).endsWith("#all"));
    await ui.evaluate((id) => window.webAccounts.select(id), accounts[0].id);
    await until(
      async () => (await url(second)).endsWith("#inbox"),
      "UI selection returns old account",
    );
    await route(first, "#sent");
    await ui.evaluate((id) => window.webAccounts.select(id), accounts[0].id);
    assert.ok((await url(first)).endsWith("#sent"));
    checks.push(
      "OFF retains route; ON persists; shortcut and UI switches reset only the previous account; same-account selection preserves route",
    );
    await button("設定").click();
    await new Promise((r) => setTimeout(r, 250));
    assert.ok((await url(first)).endsWith("#sent"));
    await button("受信トレイ").click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL() === "appdock://host/index.html")
        .focus(),
    );
    await new Promise((r) => setTimeout(r, 250));
    assert.ok((await url(first)).endsWith("#sent"));
    checks.push("Gmail settings tab and focus transfer preserve route");
    await ribbon
      .locator(".activity-rail")
      .getByRole("button", { name: "ホーム", exact: true })
      .click();
    await until(
      async () => (await url(first)).endsWith("#inbox"),
      "Main-page hide returns inbox",
    );
    await command("open");
    await until(
      async () => (await snapshot()).selected === accounts[0].id,
      "Gmail reopens",
    );
    assert.equal(await app.evaluate(() => fixtureRequests), initialRequests);
    assert.equal(
      await app.evaluate(
        ({ webContents }, id) =>
          webContents
            .fromId(id)
            .executeJavaScript("document.querySelector('#draft').value"),
        first,
      ),
      "keep typed input",
    );
    checks.push(
      "Main page switch resets route without network reload or losing page input",
    );
    await route(first, "#sent");
    await hostSettings({ pages: { gmail: { display: "window" } } });
    await command("open");
    await until(
      () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some(
            (w) => w.getTitle() === "Gmail" && w.isVisible(),
          ),
        ),
      "Separate window opens",
    );
    assert.ok((await url(first)).endsWith("#sent"));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === "Gmail")
        .close(),
    );
    await until(
      async () => (await url(first)).endsWith("#inbox"),
      "Window close resets inbox",
    );
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === "Gmail")
          .isVisible(),
      ),
      false,
    );
    await command("open");
    await route(first, "#sent");
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === "Gmail")
        .minimize(),
    );
    await until(
      async () => (await url(first)).endsWith("#inbox"),
      "Minimized window resets inbox",
    );
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === "Gmail")
          .isMinimized(),
      ),
      true,
    );
    await command("open");
    await until(
      () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some(
            (w) =>
              w.getTitle() === "Gmail" && !w.isMinimized() && w.isVisible(),
          ),
        ),
      "Window restores",
    );
    checks.push("Minimize returns inbox without restoring the window");
    await button("設定").click();
    await ui
      .getByRole("checkbox", {
        name: "非表示になったら受信トレイへ戻す",
        exact: true,
      })
      .uncheck();
    await until(
      async () => (await snapshot()).settings.returnToInboxOnHide === false,
      "OFF saves",
    );
    await button("受信トレイ").click();
    await route(first, "#sent");
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === "Gmail")
        .close(),
    );
    assert.ok((await url(first)).endsWith("#sent"));
    checks.push(
      "Display transfer preserves route; separate-window close resets ON and preserves OFF without reopening window",
    );
    await command("open");
    await ui.evaluate(() =>
      window.webAccounts.setSetting("returnToInboxOnHide", true),
    );
    for (const reopenBeforeReady of [false, true]) {
      await app.evaluate(
        ({ webContents }, { id, visible }) => {
          globalThis.holdNextRequest = true;
          void webContents
            .fromId(id)
            .loadURL(
              "https://mail.google.com/mail/u/0/?fixture=" +
                (visible ? "visible" : "hidden") +
                "#sent",
            );
        },
        { id: first, visible: reopenBeforeReady },
      );
      await until(
        () => app.evaluate(() => !!releaseHeldRequest),
        "Delayed page request",
      );
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === "Gmail")
          .close(),
      );
      if (reopenBeforeReady) await command("open");
      await app.evaluate(() => releaseHeldRequest());
      await until(
        () =>
          app.evaluate(
            ({ webContents }, id) =>
              !webContents.fromId(id).isLoadingMainFrame(),
            first,
          ),
        "Delayed page completes",
      );
      if (reopenBeforeReady) {
        await new Promise((r) => setTimeout(r, 250));
        assert.ok((await url(first)).endsWith("#sent"));
      } else {
        await until(
          async () => (await url(first)).endsWith("#inbox"),
          "Deferred return completes",
        );
        await command("open");
      }
    }
    checks.push(
      "Loading documents return after completion only while still hidden; reopening cancels deferred return",
    );
    await app.evaluate(
      ({ webContents }, id) =>
        webContents
          .fromId(id)
          .loadURL("https://accounts.google.com/fixture-login"),
      first,
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === "Gmail")
        .close(),
    );
    assert.equal(await url(first), "https://accounts.google.com/fixture-login");
    checks.push("Authentication document remains unchanged");
    await app.close();
    app = undefined;
    await launch();
    assert.equal((await snapshot()).settings.returnToInboxOnHide, true);
    await button("設定").click();
    assert.equal(
      await ui
        .getByRole("checkbox", {
          name: "非表示になったら受信トレイへ戻す",
          exact: true,
        })
        .isChecked(),
      true,
    );
    await ui.screenshot({ path: path.join(profile, "setting.png") });
    checks.push(
      "Saved setting survives restart and appears in Gmail preferences",
    );
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(
        { ok: true, checks, executable: process.argv[2] || "source" },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ ok: true, checks, profile }, null, 2));
  } catch (error) {
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify({ ok: false, checks, error: error.stack }, null, 2),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (app) await app.close().catch(() => {});
  }
})();
