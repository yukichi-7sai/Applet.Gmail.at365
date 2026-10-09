// Offline fixtures only. The WAV is silent; real accounts and notification settings are untouched.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", "ui-features-" + Date.now());
const webRoot = path.join(profile, ".appdock/web-accounts/at365.gmail");
const accounts = ["個人用", "仕事用"].map((name) => ({
  id: randomUUID(),
  name,
}));
fs.mkdirSync(webRoot, { recursive: true });
fs.writeFileSync(
  path.join(webRoot, "accounts.json"),
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
settings.host.notifications = false;
settings.extensions["at365.gmail"] = {
  pages: { gmail: { display: "window" } },
  enabled: false,
  settings: { notifications: false },
};
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
const wave = Buffer.alloc(44 + 1600);
wave.write("RIFF");
wave.writeUInt32LE(wave.length - 8, 4);
wave.write("WAVEfmt ", 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(8000, 24);
wave.writeUInt32LE(16000, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write("data", 36);
wave.writeUInt32LE(1600, 40);
const soundFile = path.join(profile, "silent.wav");
fs.writeFileSync(soundFile, wave);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const executable = process.argv[2]
  ? path.resolve(process.argv[2])
  : hostRequire("electron");
let app, dock, ui, importedSound;
async function until(fn, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(message);
}
const snapshot = () => ui.evaluate(() => window.webAccounts.snapshot());
async function remote(id, code) {
  return app.evaluate(
    async ({ webContents }, { id, code }) => {
      const wc = webContents
        .getAllWebContents()
        .find(
          (w) =>
            w.getURL().startsWith("https://mail.google.com") &&
            w.session.storagePath.endsWith(id),
        );
      return wc.executeJavaScript(code);
    },
    { id, code },
  );
}
async function key(id, shift = false, keyCode = "Tab") {
  await app.evaluate(
    ({ webContents }, { id, shift, keyCode }) => {
      const wc = id
        ? webContents
            .getAllWebContents()
            .find(
              (w) =>
                w.getURL().startsWith("https://mail.google.com") &&
                w.session.storagePath.endsWith(id),
            )
        : webContents
            .getAllWebContents()
            .find((w) => w.getURL().includes("/web/index.html"));
      wc.focus();
      for (const type of ["keyDown", "keyUp"])
        wc.sendInputEvent({
          type,
          keyCode,
          modifiers: shift ? ["control", "shift"] : ["control"],
        });
    },
    { id, shift, keyCode },
  );
}
async function launch() {
  // Prevent startup activation before protocol fixtures are installed on restart.
  const current = JSON.parse(
    fs.readFileSync(path.join(profile, "settings.json"), "utf8"),
  );
  current.extensions["at365.gmail"].enabled = false;
  fs.writeFileSync(
    path.join(profile, "settings.json"),
    JSON.stringify(current),
  );
  app = await electron.launch({
    executablePath: executable,
    args: process.argv[2]
      ? ["--test-profile=" + profile]
      : [host, "--test-profile=" + profile],
    env,
  });
  dock = await app.firstWindow();
  await dock.waitForFunction(() => !!window.dock);
  await app.evaluate(
    ({ app, dialog }, { soundFile, accounts }) => {
      globalThis.fixtureSounds = [];
      globalThis.fixtureLoads = 0;
      app.on("web-contents-created", (_event, wc) =>
        wc.on("did-finish-load", () => {
          if (wc.getTitle() === "AppDock Audio")
            fixtureSounds.push(wc.getTitle());
        }),
      );
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [soundFile],
      });
      app.on("session-created", (ses) => {
        if (!ses.isPersistent()) return;
        const index = accounts.findIndex((a) => ses.storagePath.endsWith(a.id));
        const html = `<!doctype html><html><body><main role="main"><table><tbody>
        <tr class="zA zE"><td class="yW"><span name="Alice Fixture">Alice Fixture</span></td><td><span class="bog" data-legacy-thread-id="shared" data-legacy-last-message-id="v1">${index === 1 ? "仕事専用メール" : "個人専用メール"}</span></td></tr>
        <tr class="zA zE"><td class="yW"><span name="開発チーム">開発チーム</span></td><td><span class="bog" data-legacy-thread-id="seed">起動時の確認</span></td></tr>
        </tbody></table><span class="Dj"><span class="ts">1</span>–<span class="ts">2</span> / <span class="ts">2</span></span></main><script>
        document.addEventListener('click', event => {
          const subject = event.target.closest('.bog'); if (!subject) return;
          const row = subject.closest('tr'); row.classList.remove('zE'); row.classList.add('yO');
          location.hash = '#inbox/' + subject.getAttribute('data-legacy-thread-id');
        });
        </script></body></html>`;
        ses.protocol.handle("https", () => {
          fixtureLoads++;
          return new Response(html, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        });
      });
    },
    { soundFile, accounts },
  );
  await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
  await until(
    async () =>
      (await dock.evaluate(() => window.dock.snapshot())).extensions.some(
        (e) => e.id === "at365.gmail" && e.state === "running",
      ),
    "startup",
  );
  await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
  await until(() => {
    ui = app
      .context()
      .pages()
      .find((p) => p.url().includes("/web/index.html"));
    return !!ui;
  }, "Gmail window");
  await ui.waitForFunction(() => !!window.webAccounts);
  await until(
    async () => (await snapshot()).accounts.every((a) => a.data?.pending === 2),
    "startup unread",
  );
  assert.ok(
    (await snapshot()).accounts.every((a) => a.observation.complete),
    "Gmail range confirms full row coverage",
  );
}
async function close() {
  await app.evaluate(({ app }) => app.quit());
  await app.close();
}
(async () => {
  try {
    await launch();
    await app.evaluate(({ net }) => {
      globalThis.updateChecks = 0;
      globalThis.updateMode = "available";
      net.fetch = async () => {
        updateChecks++;
        if (updateMode === "unpublished")
          return new Response("", { status: 404 });
        if (updateMode === "error") return new Response("", { status: 503 });
        return new Response(
          JSON.stringify({
            tag_name: updateMode === "available" ? "v9.0.0" : "v0.1.0",
            draft: false,
            prerelease: false,
          }),
        );
      };
    });
    await dock.getByRole("button", { name: "設定", exact: true }).click();
    await dock
      .getByRole("button", { name: "バージョン情報・更新", exact: true })
      .click();
    await dock
      .getByRole("heading", { name: /^AppDock\.at365 v\d+\.\d+\.\d+$/ })
      .waitFor();
    assert.equal(await app.evaluate(() => updateChecks), 0);
    const hostAbout = dock.locator(".about-host");
    await hostAbout
      .getByRole("button", { name: "更新を確認", exact: true })
      .click();
    await hostAbout
      .getByRole("status")
      .filter({ hasText: "v9.0.0 が公開されています" })
      .waitFor();
    await hostAbout.getByRole("button", { name: "リリースを開く" }).waitFor();
    await dock.screenshot({ path: path.join(profile, "about-dark.png") });
    for (const [mode, message] of [
      ["current", "最新版です。"],
      ["unpublished", "公開リリースが見つかりません。"],
      ["error", "GitHub HTTP 503"],
    ]) {
      await app.evaluate((_electron, mode) => {
        updateMode = mode;
      }, mode);
      await hostAbout
        .getByRole("button", { name: "更新を確認", exact: true })
        .click();
      await hostAbout.getByText(message, { exact: mode !== "error" }).waitFor();
    }
    await dock
      .locator(".about-applets")
      .getByRole("button", { name: "更新を確認", exact: true })
      .click();
    await dock
      .locator(".about-applets")
      .getByText("更新確認先が設定されていません。", { exact: true })
      .waitFor();
    const theme = async (value) => {
      await dock.evaluate(async (value) => {
        const { settings } = await window.dock.snapshot();
        settings.value.host.theme = value;
        await window.dock.saveSettings(settings.value, settings.revision);
      }, value);
      const expected = await app.evaluate(({ nativeTheme }) =>
        nativeTheme.shouldUseDarkColors ? "dark" : "light",
      );
      await ui.waitForFunction(
        (expected) => document.documentElement.dataset.theme === expected,
        expected,
      );
      await dock.waitForFunction(
        (expected) => document.documentElement.dataset.theme === expected,
        expected,
      );
      assert.equal(
        await ui.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        ),
        await dock.evaluate(
          () => getComputedStyle(document.documentElement).backgroundColor,
        ),
      );
    };
    await theme("system");
    await theme("light");
    assert.equal(
      await hostAbout
        .getByRole("alert")
        .textContent()
        .then((text) => text.includes("dock:checkUpdates")),
      false,
    );
    await dock.screenshot({ path: path.join(profile, "about-light.png") });
    assert.ok((await snapshot()).accounts.every((a) => !a.sound.enabled));
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    assert.equal(await ui.locator(".arrival-list li").count(), 4);
    await ui.screenshot({ path: path.join(profile, "arrivals-light.png") });
    await theme("dark");
    await ui.getByLabel("新着履歴を検索").fill("ＡＬＩＣＥ");
    await until(
      async () => (await ui.locator(".arrival-list li").count()) === 2,
      "normalized sender search",
    );
    await ui.getByLabel("新着履歴を検索").fill("仕事専用");
    await until(
      async () => (await ui.locator(".arrival-list li").count()) === 1,
      "subject search",
    );
    await remote(
      accounts[1].id,
      "document.querySelector('tr').classList.replace('zE','yO')",
    );
    await until(
      async () => (await snapshot()).accounts[1].data.pending === 1,
      "read sync",
    );
    await ui.getByLabel("未読だけ", { exact: true }).check();
    await ui
      .getByRole("heading", { name: "一致する履歴はありません" })
      .waitFor();
    await ui.getByRole("button", { name: "絞り込みを解除" }).click();
    await ui.getByLabel("新着履歴を検索").fill("仕事用");
    assert.equal(await ui.locator(".arrival-list li").count(), 2);
    await ui.getByLabel("検索をクリア").click();
    await ui.screenshot({ path: path.join(profile, "arrivals-wide.png") });
    // The same thread ID exists in both accounts. Opening one must select its own session.
    const target = ui
      .locator(".arrival-list li")
      .filter({ has: ui.getByRole("heading", { name: "仕事専用メール" }) });
    await target.getByRole("button", { name: "メールを開く →" }).click();
    await until(
      async () =>
        (await snapshot()).selected === accounts[1].id &&
        (await snapshot()).accounts[1].url.endsWith("#inbox/shared"),
      "open exact account thread",
    );
    assert.equal(await remote(accounts[0].id, "location.hash"), "#inbox");
    await remote(accounts[1].id, "location.hash = '#inbox'");
    await until(
      async () => (await snapshot()).accounts[1].observation?.ready,
      "return inbox",
    );
    await key(accounts[1].id);
    await until(
      async () => (await snapshot()).selected === accounts[0].id,
      "Ctrl+Tab inside Gmail",
    );
    // The former fixture focused each destination before sending a key. That
    // masked the loss of input focus after the first account switch.
    async function focusedKey(shift = false) {
      await app.evaluate(({ webContents }, shift) => {
        const wc = webContents.getFocusedWebContents();
        if (!wc?.getURL().startsWith("https://mail.google.com"))
          throw Error("Account switch lost Gmail input focus");
        for (const type of ["keyDown", "keyUp"])
          wc.sendInputEvent({
            type,
            keyCode: "Tab",
            modifiers: shift ? ["control", "shift"] : ["control"],
          });
      }, shift);
    }
    for (const expected of [
      accounts[1].id,
      accounts[0].id,
      accounts[1].id,
      accounts[0].id,
    ]) {
      assert.equal(
        await app.evaluate(({ webContents }) =>
          webContents
            .getFocusedWebContents()
            ?.session.storagePath.split(/[\\/]/)
            .at(-1),
        ),
        (await snapshot()).selected,
      );
      await focusedKey();
      await until(
        async () => (await snapshot()).selected === expected,
        "Repeated Ctrl+Tab without clicking",
      );
    }
    await focusedKey(true);
    await until(
      async () => (await snapshot()).selected === accounts[1].id,
      "Ctrl+Shift+Tab inside Gmail",
    );
    await focusedKey(true);
    await until(
      async () => (await snapshot()).selected === accounts[0].id,
      "Repeated previous without clicking",
    );
    await focusedKey();
    await until(
      async () => (await snapshot()).selected === accounts[1].id,
      "Restore account after repeated keys",
    );
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await key(null);
    await until(
      async () => (await snapshot()).selected === accounts[0].id,
      "Ctrl+Tab local history",
    );
    await dock.evaluate(() =>
      window.dock.executeCommand("at365.gmail.previousAccount"),
    );
    await until(
      async () => (await snapshot()).selected === accounts[1].id,
      "previous command",
    );
    await dock.evaluate(() =>
      window.dock.executeCommand("at365.gmail.nextAccount"),
    );
    await until(
      async () => (await snapshot()).selected === accounts[0].id,
      "next command",
    );
    await dock.evaluate(async () => {
      const { settings } = await window.dock.snapshot();
      settings.value.shortcuts["at365.gmail.nextAccount"] = ["Ctrl+PageDown"];
      await window.dock.saveSettings(settings.value, settings.revision);
    });
    await key(null);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await snapshot()).selected, accounts[0].id);
    await key(null, false, "PageDown");
    await until(
      async () => (await snapshot()).selected === accounts[1].id,
      "custom shortcut",
    );
    await dock.evaluate(() =>
      window.dock.executeCommand("at365.gmail.nextAccount"),
    );
    await until(
      async () => (await snapshot()).selected === accounts[0].id,
      "return account one",
    );
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await ui.getByLabel("このアカウントの通知音を鳴らす").check();
    await ui.getByRole("button", { name: "WAVを選択", exact: true }).click();
    await until(
      async () =>
        (await snapshot()).accounts[0].sound.name === "silent.wav" &&
        (await snapshot()).accounts[0].sound.file !== soundFile,
      "pick WAV",
    );
    importedSound = (await snapshot()).accounts[0].sound.file;
    assert.ok(importedSound.startsWith(path.join(webRoot, "sounds")));
    assert.deepEqual(fs.readFileSync(importedSound), wave);
    fs.unlinkSync(soundFile);
    await ui.getByRole("button", { name: "試聴", exact: true }).click();
    await until(
      () => app.evaluate(() => fixtureSounds.length === 1),
      "preview sound",
    );
    await ui.screenshot({ path: path.join(profile, "sound-wide.png") });
    await theme("light");
    await ui.screenshot({ path: path.join(profile, "sound-light.png") });
    await theme("dark");
    // Both host and Applet desktop notifications are OFF. Only account one's sound is ON.
    for (const a of accounts)
      await remote(
        a.id,
        'document.querySelector(\'tbody\').insertAdjacentHTML(\'afterbegin\', \'<tr class="zA zE"><td class="yW"><span name="Fixture">Fixture</span></td><td><span class="bog" data-legacy-thread-id="later">後からの新着</span></td></tr>\')',
      );
    await until(
      async () =>
        (await snapshot()).accounts.every((a) =>
          a.data.arrivals.some((m) => m.key === "later"),
        ),
      "both arrivals",
    );
    await until(
      () => app.evaluate(() => fixtureSounds.length === 2),
      "sound despite desktop notifications off",
    );
    assert.deepEqual(await app.evaluate(() => fixtureSounds), [
      "AppDock Audio",
      "AppDock Audio",
    ]);
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await ui.getByLabel("新着履歴を検索").fill("後からの新着");
    await remote(
      accounts[0].id,
      "document.querySelector('[data-legacy-thread-id=\"later\"]').closest('tr').remove()",
    );
    const loadsBeforeMissing = await app.evaluate(() => fixtureLoads);
    const missingStarted = Date.now();
    await ui
      .locator(".arrival-list li")
      .filter({ hasText: "個人用" })
      .getByRole("button", { name: "メールを開く →" })
      .click();
    await ui
      .getByRole("status")
      .filter({ hasText: "対象のメールが現在の受信トレイに見つからない" })
      .waitFor();
    const missingWaitMs = Date.now() - missingStarted;
    assert.ok(missingWaitMs < 2500, "missing row returns promptly");
    assert.equal(
      await app.evaluate(() => fixtureLoads),
      loadsBeforeMissing,
      "no redundant inbox reload",
    );
    assert.ok((await snapshot()).accounts[0].url.endsWith("#inbox"));
    await until(
      async () =>
        !(await snapshot()).accounts[0].data.arrivals.some(
          (a) => a.key === "later",
        ),
      "deleted row leaves history",
    );
    // An explicit empty state is needed even after deleting the final row.
    await remote(
      accounts[0].id,
      `document.querySelector('[role="main"]').innerHTML = '<div class="ae4"><table class="F" role="grid"><tbody></tbody></table><table class="TB"><tbody><tr class="TD"><td class="TC">新着メールはありません。</td></tr></tbody></table></div>'`,
    );
    await until(async () => {
      const account = (await snapshot()).accounts[0];
      return (
        account.observation?.ready &&
        account.observation.complete &&
        account.data.pending === 0 &&
        account.data.arrivals.length === 0
      );
    }, "last deletion clears badge and history in empty inbox");
    // Neither a paginated inbox nor an unidentified row proves full coverage.
    await remote(
      accounts[0].id,
      `document.querySelector('[role="main"]').innerHTML = '<table><tbody><tr class="zA yO"><td><span class="bog" data-legacy-thread-id="range">Range fixture</span></td></tr></tbody></table><span class="Dj"><span class="ts">1</span>–<span class="ts">1</span> / <span class="ts">99</span></span>'`,
    );
    await until(async () => {
      const observation = (await snapshot()).accounts[0].observation;
      return (
        observation?.ready &&
        observation.keys.includes("range") &&
        !observation.complete
      );
    }, "pagination cannot prove absence from whole inbox");
    await remote(
      accounts[0].id,
      `document.querySelector('.Dj .ts:last-child').textContent = '1'`,
    );
    await until(
      async () => (await snapshot()).accounts[0].observation?.complete,
      "full numeric range recognized",
    );
    await remote(
      accounts[0].id,
      `document.querySelector('tbody').insertAdjacentHTML('beforeend','<tr class="zA yO"><td>Unidentified fixture row</td></tr>');document.querySelector('.Dj').innerHTML='<span class="ts">1</span>–<span class="ts">2</span> / <span class="ts">2</span>'`,
    );
    await until(async () => {
      const observation = (await snapshot()).accounts[0].observation;
      return observation?.ready && !observation.complete;
    }, "unidentified row prevents full coverage");
    await remote(
      accounts[0].id,
      `document.querySelector('[role="main"]').innerHTML='<table class="TB"><tbody><tr class="TD"><td class="TC">Unknown fixture state</td></tr></tbody></table>'`,
    );
    await until(
      async () =>
        (await snapshot()).accounts[0].observation?.reason === "no-row-ids",
      "unknown empty markup cannot clear history",
    );
    assert.ok(
      (await snapshot()).accounts[0].data.arrivals.some(
        (a) => a.key === "range",
      ),
    );
    await remote(
      accounts[0].id,
      `document.querySelector('.TC').textContent='No new mail!'`,
    );
    await until(async () => {
      const account = (await snapshot()).accounts[0];
      return (
        account.observation?.complete && account.data.arrivals.length === 0
      );
    }, "English empty marker reconciles history");
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      w.setContentSize(900, 640);
    });
    await ui.locator(".sound-file").scrollIntoViewIfNeeded();
    assert.equal(
      await ui.evaluate(
        () =>
          document.querySelector("main").scrollWidth <=
          document.querySelector("main").clientWidth,
      ),
      true,
    );
    await ui.screenshot({ path: path.join(profile, "sound-minimum.png") });
    const normalGeometry = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      w.setBounds({ x: 80, y: 90, width: 1050, height: 760 });
      return w.getNormalBounds();
    });
    await ui.screenshot({ path: path.join(profile, "sound-compact.png") });
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      w.maximize();
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await close();
    const saved = JSON.parse(
      fs.readFileSync(path.join(webRoot, "window-state.json"), "utf8"),
    );
    assert.deepEqual(saved.bounds, normalGeometry);
    assert.equal(saved.maximized, true);
    const legacyFile = path.join(profile, "legacy.wav");
    fs.writeFileSync(legacyFile, wave);
    const savedAccounts = JSON.parse(
      fs.readFileSync(path.join(webRoot, "accounts.json"), "utf8"),
    );
    savedAccounts.accounts[1].sound = { enabled: true, file: legacyFile };
    fs.writeFileSync(
      path.join(webRoot, "accounts.json"),
      JSON.stringify(savedAccounts),
    );
    // Restart reuses only the fixture profile; accounts and sound must survive.
    await launch();
    const restored = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      return { bounds: w.getNormalBounds(), maximized: w.isMaximized() };
    });
    assert.deepEqual(restored.bounds, normalGeometry);
    assert.equal(restored.maximized, true);
    const restoredAccounts = (await snapshot()).accounts;
    assert.deepEqual(restoredAccounts[0].sound, {
      enabled: true,
      file: importedSound,
      name: "silent.wav",
    });
    assert.deepEqual(restoredAccounts[1].sound, {
      enabled: true,
      file: importedSound,
      name: "legacy.wav",
    });
    assert.deepEqual(fs.readFileSync(importedSound), wave);
    assert.ok(fs.existsSync(legacyFile));
    fs.unlinkSync(legacyFile);
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await ui.getByRole("button", { name: "標準音に戻す", exact: true }).click();
    await until(
      async () => !(await snapshot()).accounts[0].sound.file,
      "reset sound",
    );
    await ui.getByLabel("このアカウントの通知音を鳴らす").uncheck();
    await until(
      async () => !(await snapshot()).accounts[0].sound.enabled,
      "sound off",
    );
    await close();
    app = undefined;
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(
        {
          ok: true,
          checks: [
            "search and unread filters",
            "thread opening uses correct session",
            "local and remote account shortcuts and custom binding",
            "missing thread falls back to inbox",
            "missing thread returns promptly without reloading",
            "deleted row and last empty inbox clear history and badge",
            "pagination and unknown rows cannot prove whole-inbox absence",
            "Japanese and English explicit empty states",
            "cycle commands and configurable shortcuts",
            "independent account sound with desktop notifications off",
            "WAV preview/reset/OFF",
            "sound persistence",
            "normal geometry and maximized restart",
            "host theme dark/light/system and live synchronization",
            "settings version page and manual update states",
            "managed sound survives deleting original WAV",
            "legacy sound migration preserves ON and deduplicates copies",
          ],
          geometry: normalGeometry,
          missingWaitMs,
        },
        null,
        2,
      ),
    );
    console.log(profile);
  } finally {
    if (app) await close().catch(() => {});
  }
})().catch((error) => {
  fs.writeFileSync(path.join(profile, "failure.txt"), String(error));
  console.error(error);
  process.exitCode = 1;
});
