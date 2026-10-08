// Offline account-management UI regression. No real login or email operations.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, "artifacts", "accounts-" + Date.now());
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
  enabled: false,
  settings: { notifications: false },
};
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app, dock, ui;
const snapshot = () => ui.evaluate(() => window.webAccounts.snapshot());
async function cycleCommand(direction) {
  // Let Windows release the previous atomic save before another fixture write.
  await new Promise((resolve) => setTimeout(resolve, 200));
  await dock.evaluate(
    (direction) =>
      window.dock.executeCommand(
        direction === 1
          ? "at365.gmail.nextAccount"
          : "at365.gmail.previousAccount",
      ),
    direction,
  );
}
async function until(fn, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
async function launch() {
  const saved = JSON.parse(
    fs.readFileSync(path.join(profile, "settings.json"), "utf8"),
  );
  saved.extensions["at365.gmail"].enabled = false;
  fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(saved));
  app = await electron.launch({
    executablePath: process.argv[2]
      ? path.resolve(process.argv[2])
      : hostRequire("electron"),
    args: process.argv[2]
      ? ["--test-profile=" + profile]
      : [host, "--test-profile=" + profile],
    env,
  });
  dock = await app.firstWindow();
  await dock.waitForFunction(() => !!window.dock);
  await app.evaluate(({ app, nativeImage, net }, accounts) => {
    globalThis.accountFixtureReads = 0;
    // Electron's custom protocol Request omits Cookie headers. Record the
    // native request's policy and combine it with that session's cookie jar.
    const authenticatedRequests = new WeakMap();
    const originalRequest = net.request;
    net.request = (options) => {
      if (
        typeof options === "object" &&
        /^https:\/\/lh3\.(google|googleusercontent)\.com\//.test(options.url)
      )
        authenticatedRequests.set(
          options.session,
          options.credentials === "include",
        );
      return originalRequest(options);
    };
    app.on("session-created", (ses) => {
      if (!ses.isPersistent()) return;
      const index = accounts.findIndex((a) => ses.storagePath.endsWith(a.id));
      const pixels = Buffer.alloc(4 * 16 * 16);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i + (index === 1 ? 0 : 2)] = 230;
        pixels[i + 3] = 255;
      }
      const png = nativeImage
        .createFromBitmap(pixels, { width: 16, height: 16 })
        .toPNG();
      const anonymous = nativeImage
        .createFromBitmap(Buffer.alloc(4 * 16 * 16, 127), {
          width: 16,
          height: 16,
        })
        .toPNG();
      const cookiesReady = Promise.all(
        ["https://lh3.google.com", "https://lh3.googleusercontent.com"].map(
          (url) =>
            ses.cookies.set({
              url,
              name: "avatar_scope",
              value: String(index),
              secure: true,
              sameSite: "no_restriction",
            }),
        ),
      );
      ses.protocol.handle("https", async (req) => {
        await cookiesReady;
        const u = new URL(req.url);
        if (u.hostname === "lh3.google.com")
          return new Response(null, {
            status: 302,
            headers: {
              location:
                "https://lh3.googleusercontent.com/a/fixture-redirect=s64-c",
            },
          });
        if (u.hostname === "lh3.googleusercontent.com")
          return new Response(
            authenticatedRequests.get(ses) &&
              (await ses.cookies.get({ url: req.url })).some(
                (c) => c.name === "avatar_scope" && c.value === String(index),
              )
              ? png
              : anonymous,
            {
              headers: { "content-type": "image/png" },
            },
          );
        return new Response(
          `<!doctype html><html><body><header><a href="https://accounts.google.com/SignOutOptions?fixture=1" aria-label="Google アカウント: Fixture"><img width="32" height="32" src="https://${index === 1 ? "lh3.google.com" : "lh3.googleusercontent.com"}/a/fixture-${index}=s64-c"></a></header>
        <main role="main"><table><tbody><tr class="zA zE"><td><span class="bog" data-legacy-thread-id="seed">Fixture unread</span></td></tr></tbody></table></main></body></html>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      });
    });
  }, accounts);
  await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
  await until(
    async () =>
      (await dock.evaluate(() => window.dock.snapshot())).extensions.some(
        (e) => e.id === "at365.gmail" && e.state === "running",
      ),
    "activation",
  );
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.focusSentinel = new BrowserWindow({
      width: 320,
      height: 160,
      title: "Account focus fixture",
      show: true,
    });
    focusSentinel.focus();
  });
  await until(
    () => app.evaluate(() => focusSentinel.isFocused()),
    "foreground sentinel",
  );
  await cycleCommand(1);
  await cycleCommand(-1);
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) =>
        !BrowserWindow.getAllWindows().some((w) =>
          w.webContents.getURL().includes("/web/index.html"),
        ) && focusSentinel.isFocused(),
    ),
    true,
    "cycling before first open preserves foreground and creates no Gmail window",
  );
  await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
  await until(() => {
    ui = app.windows().find((p) => p.url().includes("/web/index.html"));
    return !!ui;
  }, "Gmail UI");
  await ui.waitForFunction(() => !!window.webAccounts);
  await until(
    async () =>
      (await snapshot()).accounts.every(
        (a) => a.avatar && (a.monitoring === false || a.data?.pending === 1),
      ),
    "avatars and initial unread",
  );
}
async function close() {
  await app.evaluate(({ app }) => app.quit());
  await app.close();
  app = undefined;
}
async function remote(id, code) {
  return app.evaluate(
    async ({ webContents }, { id, code }) => {
      const wc = webContents
        .getAllWebContents()
        .find(
          (w) =>
            w.session.storagePath?.endsWith(id) &&
            w.getURL().startsWith("https://mail.google.com"),
        );
      return wc.executeJavaScript(code);
    },
    { id, code },
  );
}
(async () => {
  try {
    await launch();
    const color = await app.evaluate(
      ({ nativeImage }, images) =>
        images.map((a) => {
          const p = nativeImage.createFromDataURL(a.avatar).toBitmap();
          return [...p.subarray(0, 4)];
        }),
      (await snapshot()).accounts,
    );
    assert.deepEqual(
      color,
      [
        [0, 0, 230, 255],
        [230, 0, 0, 255],
      ],
      "avatars use the correct session cookies, not anonymous/default images",
    );
    assert.ok(
      (await snapshot()).accounts.every((a) => a.monitoring),
      "old account files default to ON",
    );
    let add = ui.getByRole("button", {
      name: "＋ アカウントを追加",
      exact: true,
    });
    assert.equal(await add.count(), 0, "add hidden in inbox");
    assert.equal(await ui.locator(".accounts .avatar img").count(), 2);
    assert.ok(
      await ui
        .locator(".accounts .avatar img")
        .evaluateAll((images) =>
          images.every(
            (i) =>
              i.src.startsWith("data:image/png;") &&
              i.complete &&
              i.naturalWidth === 64,
          ),
        ),
    );
    for (const state of ["visible", "minimized", "hidden"]) {
      const initial = (await snapshot()).selected;
      await app.evaluate(({ BrowserWindow }, state) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("/web/index.html"),
        );
        if (state === "minimized") w.minimize();
        if (state === "hidden") w.hide();
        focusSentinel.focus();
      }, state);
      await until(
        () => app.evaluate(() => focusSentinel.isFocused()),
        "foreground sentinel for " + state,
      );
      await cycleCommand(1);
      await until(
        async () => (await snapshot()).selected !== initial,
        "background cycle " + state,
      );
      assert.equal(
        await app.evaluate(({ BrowserWindow }, state) => {
          const w = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes("/web/index.html"),
          );
          return (
            focusSentinel.isFocused() &&
            !w.isFocused() &&
            (state !== "minimized" || w.isMinimized()) &&
            (state !== "hidden" || !w.isVisible())
          );
        }, state),
        true,
        "cycle preserves " + state + " and foreground",
      );
      await cycleCommand(-1);
    }
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("/web/index.html"),
      );
      w.restore();
      w.show();
    });
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    assert.equal(await add.count(), 0, "add hidden in arrivals");
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await add.waitFor();
    await ui
      .getByRole("button", { name: "個人用を下へ移動", exact: true })
      .click();
    await until(
      async () => (await snapshot()).accounts[0].id === accounts[1].id,
      "reordered",
    );
    assert.equal((await snapshot()).selected, accounts[0].id);
    assert.equal(
      (await snapshot()).accounts.find((a) => a.id === accounts[0].id).data
        .pending,
      1,
    );
    await ui
      .getByRole("button", { name: "仕事用を上へ移動", exact: true })
      .isDisabled()
      .then((v) => assert.equal(v, true));
    await ui.evaluate(() => window.webAccounts.cycle(1));
    await until(
      async () => (await snapshot()).selected === accounts[1].id,
      "cycle follows saved order",
    );
    await ui.evaluate((id) => window.webAccounts.select(id), accounts[0].id);
    let monitoring = ui.getByLabel("このアカウントの新着を監視する");
    await monitoring.uncheck();
    await until(async () => {
      const a = (await snapshot()).accounts.find(
        (a) => a.id === accounts[0].id,
      );
      return !a.monitoring && !a.attention && !a.data?.pending;
    }, "paused account cleared immediately");
    await remote(
      accounts[0].id,
      `document.querySelector('tbody').insertAdjacentHTML('afterbegin','<tr class="zA zE"><td><span class="bog" data-legacy-thread-id="paused">Paused new</span></td></tr>')`,
    );
    await remote(
      accounts[1].id,
      `document.querySelector('tbody').insertAdjacentHTML('afterbegin','<tr class="zA zE"><td><span class="bog" data-legacy-thread-id="active">Active new</span></td></tr>')`,
    );
    await until(
      async () =>
        (await snapshot()).accounts.find((a) => a.id === accounts[1].id).data
          ?.pending === 2,
      "other account continues monitoring",
    );
    assert.equal(
      (await snapshot()).accounts.find((a) => a.id === accounts[0].id).data,
      null,
    );
    await monitoring.check();
    await until(
      async () =>
        (await snapshot()).accounts.find((a) => a.id === accounts[0].id).data
          ?.pending === 2,
      "resume imports current unread",
    );
    await monitoring.uncheck();
    await ui.getByLabel("このアカウントの表示名").fill("個人用の名前");
    await new Promise((r) => setTimeout(r, 2200));
    assert.equal(
      await ui.getByLabel("このアカウントの表示名").inputValue(),
      "個人用の名前",
      "polling preserves unsaved draft",
    );
    await ui.getByLabel("このアカウントの表示名").press("Enter");
    await until(
      async () =>
        (await snapshot()).accounts.find((a) => a.id === accounts[0].id)
          .name === "個人用の名前",
      "save by Enter",
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes("/web/index.html"))
        .setContentSize(900, 640),
    );
    await ui.locator(".account-order").scrollIntoViewIfNeeded();
    assert.equal(
      await ui.evaluate(
        () =>
          document.querySelector("main").scrollWidth <=
          document.querySelector("main").clientWidth,
      ),
      true,
    );
    await ui.screenshot({ path: path.join(profile, "accounts-dark.png") });
    await dock.evaluate(async () => {
      const { settings } = await window.dock.snapshot();
      settings.value.host.theme = "light";
      await window.dock.saveSettings(settings.value, settings.revision);
    });
    await ui.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await new Promise((r) => setTimeout(r, 200)); // Let the background-color transition finish.
    await ui.screenshot({ path: path.join(profile, "accounts-light.png") });
    await close();
    const saved = JSON.parse(
      fs.readFileSync(path.join(webRoot, "accounts.json"), "utf8"),
    );
    assert.deepEqual(
      saved.accounts.map((a) => a.id),
      [accounts[1].id, accounts[0].id],
    );
    assert.equal(saved.accounts[1].monitoring, false);
    await launch();
    const restored = await snapshot();
    add = ui.getByRole("button", { name: "＋ アカウントを追加", exact: true });
    monitoring = ui.getByLabel("このアカウントの新着を監視する");
    assert.deepEqual(
      restored.accounts.map((a) => a.id),
      [accounts[1].id, accounts[0].id],
    );
    assert.equal(restored.accounts[1].monitoring, false);
    assert.equal(restored.accounts[1].name, "個人用の名前");
    assert.equal(restored.selected, accounts[0].id);
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await monitoring.check();
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data?.pending === 1),
      "resume after restart",
    );
    await remote(
      accounts[0].id,
      `document.querySelector('header img').remove()`,
    );
    await until(
      async () => !(await snapshot()).accounts[1].avatar,
      "missing image falls back",
    );
    assert.equal(await ui.locator(".accounts .avatar img").count(), 1);
    await remote(
      accounts[0].id,
      `document.querySelector('header a').innerHTML='<img width="32" height="32" src="https://lh3.googleusercontent.com/a/replacement=s64-c">'`,
    );
    await until(
      async () => !!(await snapshot()).accounts[1].avatar,
      "avatar updates on header change",
    );
    await add.click();
    await until(
      async () => (await snapshot()).accounts.length === 3,
      "add account",
    );
    assert.equal(await add.count(), 0, "addition opens login/inbox");
    for (let i = 3; i < 10; i++)
      await ui.evaluate(() => window.webAccounts.add());
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await until(
      async () => (await snapshot()).accounts.length === 10,
      "ten account limit",
    );
    assert.equal(await add.isDisabled(), true);
    await assert.rejects(
      ui.evaluate(() => window.webAccounts.add()),
      /10アカウント/,
    );
    await dock.evaluate(() =>
      window.dock.toggleExtension("at365.gmail", false),
    );
    await close();
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(
        {
          ok: true,
          checks: [
            "legacy default ON",
            "header avatars and fallback",
            "authenticated avatar requests in isolated account sessions",
            "cycle preserves foreground and never opens/restores Gmail",
            "settings-only add",
            "reorder and cycle",
            "per-account OFF/resume and isolation",
            "name draft/Enter",
            "restart persistence",
            "900x640 dark/light",
            "ten account limit",
            "normal shutdown",
          ],
        },
        null,
        2,
      ),
    );
    console.log(profile);
  } finally {
    if (app) await close().catch(() => {});
  }
})().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(profile, "failure.txt"), String(e));
  process.exitCode = 1;
});
