const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", "gui-" + Date.now());
const executable = process.argv[2]
  ? path.resolve(process.argv[2])
  : hostRequire("electron");
const settings = hostRequire(
  "./out/main/shared/settings-schema",
).createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.extensions["at365.gmail"] = {
  pages: { gmail: { display: "window" } },
  enabled: false,
  settings: { notifications: false },
};
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
fs.cpSync(
  path.join(root, "publish/Applet.Gmail.at365"),
  path.join(profile, "extensions/Applet.Gmail.at365"),
  { recursive: true },
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app, dock, ui;
async function until(fn, message) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
const snapshot = () => ui.evaluate(() => window.webAccounts.snapshot());
async function remote(id, action) {
  return app.evaluate(
    async ({ webContents }, { id, action }) => {
      const wc = webContents
        .getAllWebContents()
        .find(
          (w) =>
            w.getURL().startsWith("https://mail.google.com") &&
            w.session.storagePath.endsWith(id),
        );
      if (!wc) throw Error("Missing remote WebContents");
      return wc.executeJavaScript(action);
    },
    { id, action },
  );
}
async function launch(startupUnread = false) {
  app = await electron.launch({
    executablePath: executable,
    args: process.argv[2]
      ? ["--test-profile=" + profile]
      : [host, "--test-profile=" + profile],
    env,
  });
  dock = await app.firstWindow();
  await dock.waitForFunction(() => !!window.dock);
  await app.evaluate(({ app }, startupUnread) => {
    const html =
      '<!doctype html><html><body style="font:18px sans-serif;background:#fff;color:#222"><h1>Gmail offline fixture</h1><main role="main"><table><tbody>' +
      ["a", "b", "c"]
        .map(
          (id) =>
            `<tr class="zA ${startupUnread && id === "a" ? "zE" : "yO"}"><td><span data-legacy-thread-id="${id}">${id}: fixture message</span></td></tr>`,
        )
        .join("") +
      '</tbody></table><input aria-label="mail input"></main></body></html>';
    const install = (ses) => {
      if (!ses.isPersistent()) return;
      ses.protocol.handle(
        "https",
        () =>
          new Response(html, {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      );
    };
    app.on("session-created", install);
    // Existing persistent sessions are created only by the default UI at this point.
  }, startupUnread);
  await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
  await until(
    async () =>
      (await dock.evaluate(() => window.dock.snapshot())).extensions.some(
        (e) => e.id === "at365.gmail" && e.state === "running",
      ),
    "Applet startup",
  );
  await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
  await until(async () => {
    ui = app
      .context()
      .pages()
      .find((p) => p.url().includes("/web/index.html"));
    return !!ui;
  }, "local Gmail UI window");
  await ui.waitForFunction(() => !!window.webAccounts);
  await until(
    async () =>
      (await snapshot()).accounts.every((a) =>
        startupUnread
          ? a.data?.pending === 1
          : a.status === "受信トレイを監視中",
      ),
    "observer baseline",
  );
}
(async () => {
  try {
    await launch();
    const first = (await snapshot()).selected;
    assert.deepEqual(
      await remote(
        first,
        "({node: typeof require, bridge: typeof webAccounts})",
      ),
      { node: "undefined", bridge: "undefined" },
    );
    await remote(
      first,
      'document.querySelector("tbody").insertAdjacentHTML("afterbegin", `<tr class="zA zE"><td class="yW"><span email="fixture@example.test" name="Fixture sender">Fixture sender</span></td><td><span class="bog" data-legacy-thread-id="new-one">新しい確認メール</span><span class="y2">PRIVATE BODY SNIPPET</span></td></tr>`)',
    );
    await until(
      async () => (await snapshot()).accounts[0].attention,
      "DOM arrival detection",
    );
    assert.equal(
      (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
        (e) => e.id === "at365.gmail",
      ).panel.facts[0].value,
      "新着メールがあります",
    );
    await ui.screenshot({ path: path.join(profile, "gmail.png") });
    assert.equal((await snapshot()).accounts[0].data.pending, 1);
    assert.equal(
      (await snapshot()).accounts[0].data.arrivals[0].subject,
      "新しい確認メール",
    );
    assert.ok(
      !JSON.stringify((await snapshot()).accounts[0].observation).includes(
        "PRIVATE BODY SNIPPET",
      ),
    );
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await ui.getByRole("heading", { name: "新しい確認メール" }).waitFor();
    await until(
      () =>
        app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) =>
                w.contentView.children.some((v) =>
                  v.children.some((c) =>
                    c.webContents?.getURL().includes("/web/index.html"),
                  ),
                ),
              )
              .contentView.children.flatMap((v) => v.children)
              .filter((v) =>
                v.webContents?.getURL().startsWith("https://mail.google.com"),
              ).length === 0,
        ),
      "history hides native Gmail view",
    );
    await remote(
      first,
      'document.querySelector("tbody").insertAdjacentHTML("afterbegin", `<tr class="zA zE"><td class="yW"><span email="team@example.test" name="開発チーム">開発チーム</span></td><td><span class="bog" data-legacy-thread-id="while-history">一覧を開いたまま届いたメール</span></td></tr>`)',
    );
    await ui
      .getByRole("heading", { name: "一覧を開いたまま届いたメール" })
      .waitFor({ timeout: 15000 });
    assert.equal((await snapshot()).accounts[0].data.pending, 2);
    await ui.screenshot({ path: path.join(profile, "arrivals.png") });
    await ui
      .getByRole("button", { name: "新着表示をクリア", exact: true })
      .click();
    await until(
      async () => (await snapshot()).accounts[0].data.pending === 0,
      "history acknowledgement",
    );
    assert.equal(await ui.locator(".arrival-list li").count(), 2);
    await ui.getByRole("button", { name: "受信トレイ", exact: true }).click();
    await until(
      () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) =>
              w.contentView.children.some((v) =>
                v.children.some((c) =>
                  c.webContents?.getURL().includes("/web/index.html"),
                ),
              ),
            )
            .contentView.children.flatMap((v) => v.children)
            .find((v) =>
              v.webContents?.getURL().startsWith("https://mail.google.com"),
            )
            .getVisible(),
        ),
      "return shows native Gmail view",
    );
    await ui.evaluate((id) => window.webAccounts.acknowledge(id), first);
    await until(
      async () => !(await snapshot()).accounts[0].attention,
      "acknowledgement",
    );
    await remote(first, 'document.querySelector("tr").classList.add("read")');
    await new Promise((r) => setTimeout(r, 2400));
    assert.equal((await snapshot()).accounts[0].attention, false);
    await remote(
      first,
      'document.querySelector("tr td").setAttribute("data-legacy-last-message-id", "v1")',
    );
    await until(
      async () =>
        (await snapshot()).accounts[0].observation?.keys[0]?.endsWith("~v1"),
      "reply baseline",
    );
    await remote(
      first,
      'document.querySelector("tr").classList.add("zE"); document.querySelector("tr td").setAttribute("data-legacy-last-message-id", "v2")',
    );
    await until(
      async () => (await snapshot()).accounts[0].attention,
      "unread-thread reply detection",
    );
    await ui.evaluate((id) => window.webAccounts.acknowledge(id), first);
    await until(
      async () => !(await snapshot()).accounts[0].attention,
      "reply acknowledgement",
    );
    await remote(first, 'location.hash = "#sent"');
    await until(
      async () =>
        (await snapshot()).accounts[0].status ===
        "受信トレイを表示すると監視します",
      "folder suspension",
    );
    await remote(
      first,
      'document.querySelector("tbody").insertAdjacentHTML("afterbegin", `<tr class="zA zE"><td data-legacy-thread-id="while-away">fixture</td></tr>`); location.hash = "#inbox"',
    );
    await until(
      async () =>
        (await snapshot()).accounts[0].status === "受信トレイを監視中",
      "return rebaseline",
    );
    assert.equal((await snapshot()).accounts[0].attention, false);
    const bounds = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      w.setContentSize(900, 640);
      return {
        window: w.getContentSize(),
        view: w.contentView.children
          .flatMap((v) => v.children)
          .find((v) =>
            v.webContents?.getURL().startsWith("https://mail.google.com"),
          )
          .getBounds(),
      };
    });
    assert.deepEqual(bounds, {
      window: [900, 640],
      view: { x: 236, y: 130, width: 664, height: 510 },
    });
    // Page screenshots capture the local controller separately from native child views.
    const remoteImage = await app.evaluate(async ({ webContents }, id) => {
      const wc = webContents
        .getAllWebContents()
        .find(
          (w) =>
            w.getURL().startsWith("https://mail.google.com") &&
            w.session.storagePath.endsWith(id),
        );
      return (await wc.capturePage()).toPNG().toString("base64");
    }, first);
    fs.writeFileSync(
      path.join(profile, "remote-fixture.png"),
      Buffer.from(remoteImage, "base64"),
    );
    await app.evaluate(async ({ webContents }, id) => {
      const wc = webContents
        .getAllWebContents()
        .find((w) => w.session.storagePath?.endsWith(id));
      await wc.session.cookies.set({
        url: "https://mail.google.com",
        name: "fixture-login",
        value: "account-one",
        secure: true,
        expirationDate: Date.now() / 1000 + 86400,
      });
    }, first);
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    await ui.getByLabel("このアカウントの表示名").fill("Fixture account 1");
    await ui.getByRole("button", { name: "名前を保存", exact: true }).click();
    await ui.screenshot({ path: path.join(profile, "settings.png") });
    await ui.getByRole("button", { name: "＋ アカウントを追加" }).click();
    await until(
      async () =>
        (await snapshot()).accounts.length === 2 &&
        (await snapshot()).accounts[1].status === "受信トレイを監視中",
      "second account",
    );
    const second = (await snapshot()).selected;
    assert.notEqual(second, first);
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await ui
      .locator(".filters")
      .getByRole("button", { name: "新しいアカウント", exact: true })
      .click();
    await ui.getByRole("heading", { name: "新着を待っています" }).waitFor();
    await remote(
      first,
      'document.querySelector("tbody").insertAdjacentHTML("afterbegin", `<tr class="zA zE"><td data-legacy-thread-id="first-filter">first-account filtered arrival</td></tr>`)',
    );
    await remote(
      second,
      'document.querySelector("tbody").insertAdjacentHTML("afterbegin", `<tr class="zA zE"><td><span class="bog" data-legacy-thread-id="second-filter">別アカウントの新着</span></td></tr>`)',
    );
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data.pending === 1),
      "independent pending counts",
    );
    assert.equal(await ui.locator(".arrival-list li").count(), 1);
    await ui
      .getByRole("button", { name: "新着表示をクリア", exact: true })
      .click();
    await until(
      async () => (await snapshot()).accounts[1].data.pending === 0,
      "selected account clear",
    );
    assert.equal((await snapshot()).accounts[0].data.pending, 1);
    await ui
      .locator(".filters")
      .getByRole("button", { name: "すべてのアカウント", exact: true })
      .click();
    assert.ok((await ui.locator(".arrival-list li").count()) > 1);
    await ui
      .getByRole("button", { name: "新着表示をクリア", exact: true })
      .click();
    await until(
      async () => (await snapshot()).accounts.every((a) => !a.attention),
      "all accounts clear",
    );
    await ui
      .locator(".arrival-list li")
      .filter({
        has: ui.getByRole("heading", {
          name: "別アカウントの新着",
          exact: true,
        }),
      })
      .getByRole("button", { name: "メールを開く →", exact: true })
      .click();
    await until(
      async () =>
        (await snapshot()).selected === second &&
        (await ui
          .getByRole("button", { name: "受信トレイ", exact: true })
          .getAttribute("aria-pressed")) === "true",
      "history selects matching account",
    );
    await until(
      async () =>
        (await snapshot()).accounts[1].status === "受信トレイを監視中",
      "history action inbox baseline",
    );
    const cookieCount = await app.evaluate(async ({ webContents }, id) => {
      const wc = webContents
        .getAllWebContents()
        .find((w) => w.session.storagePath?.endsWith(id));
      return (await wc.session.cookies.get({ name: "fixture-login" })).length;
    }, second);
    assert.equal(cookieCount, 0);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) =>
          w.contentView.children.some((v) =>
            v.children.some((c) =>
              c.webContents?.getURL().includes("/web/index.html"),
            ),
          ),
        )
        .close(),
    );
    await remote(
      second,
      'document.querySelector("tbody").insertAdjacentHTML("afterbegin", `<tr class="zA zE"><td data-legacy-thread-id="background-new">background arrival</td></tr>`)',
    );
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === "at365.gmail",
        ).panel.facts[1].value === "新着メールがあります",
      "hidden-window arrival",
    );
    await app.evaluate(({ app }) => app.quit());
    await app.close();
    app = undefined;
    // Prevent a reload baseline from inheriting fixture attention.
    const saved = JSON.parse(
      fs.readFileSync(path.join(profile, "settings.json")),
    );
    saved.extensions["at365.gmail"].enabled = false;
    fs.writeFileSync(
      path.join(profile, "settings.json"),
      JSON.stringify(saved),
    );
    await launch(true);
    assert.equal((await snapshot()).accounts[0].name, "Fixture account 1");
    const persisted = await app.evaluate(async ({ webContents }, id) => {
      const wc = webContents
        .getAllWebContents()
        .find((w) => w.session.storagePath?.endsWith(id));
      return (await wc.session.cookies.get({ name: "fixture-login" }))[0]
        ?.value;
    }, first);
    assert.equal(persisted, "account-one");
    assert.ok(
      (await snapshot()).accounts.every(
        (a) => a.attention && a.data.pending === 1,
      ),
    );
    assert.ok(
      (await snapshot()).accounts.every(
        (a) =>
          a.data.arrivals.length === 1 &&
          a.data.arrivals[0].initial &&
          a.data.arrivals[0].unread,
      ),
    );
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await remote(first, 'document.querySelector("tr").className = "zA yO"');
    await until(
      async () => (await snapshot()).accounts[0].data.pending === 0,
      "startup unread becomes read",
    );
    assert.equal((await snapshot()).accounts[0].data.arrivals[0].unread, false);
    assert.equal((await snapshot()).accounts[1].data.pending, 1);
    await ui.getByText("既読", { exact: true }).waitFor();
    await ui.screenshot({ path: path.join(profile, "read-state.png") });
    await remote(first, 'document.querySelector("tr").className = "zA zE"');
    await until(
      async () => (await snapshot()).accounts[0].data.pending === 1,
      "unread state returns",
    );
    assert.equal((await snapshot()).accounts[0].data.arrivals.length, 1);
    // The UI bounds are trusted-local only, clipped to the client area, and invalid input rejects.
    await assert.rejects(
      ui.evaluate(() =>
        window.webAccounts.viewport({ x: -1, y: 0, width: 1, height: 1 }),
      ),
      /viewport/,
    );
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    });
    await ui.evaluate((id) => window.webAccounts.remove(id), first);
    await until(
      async () => (await snapshot()).accounts.length === 1,
      "account deletion",
    );
    const deleted = await app.evaluate(
      async ({ session }, directory) =>
        (
          await session
            .fromPath(directory)
            .cookies.get({ name: "fixture-login" })
        ).length,
      path.join(profile, "data/web-accounts/at365.gmail/sessions", first),
    );
    assert.equal(deleted, 0);
    await dock.evaluate(() =>
      window.dock.toggleExtension("at365.gmail", false),
    );
    assert.equal(
      await app.evaluate(
        ({ webContents }) =>
          webContents
            .getAllWebContents()
            .filter((w) => w.getURL().startsWith("https:")).length,
      ),
      0,
    );
    await app.evaluate(({ app }) => app.quit());
    await app.close();
    app = undefined;
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(
        {
          ok: true,
          checks: [
            "DOM arrival",
            "sender and subject without body snippet",
            "history tab hides view and continues observing",
            "arrival counts, acknowledgement and transient history",
            "account settings UI",
            "multi-account history filters and scoped clearing",
            "startup imports unread only",
            "read state updates counts and history without duplicate arrivals",
            "read-state ignored",
            "per-account isolation",
            "background monitoring",
            "persistent login",
            "initial baseline",
            "deletion clears cookies",
            "stop closes views",
            "remote has no Node/host bridge",
          ],
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ ok: true, profile }));
  } catch (error) {
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify({ ok: false, error: error.stack }),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (app) {
      await app.evaluate(({ app }) => app.quit()).catch(() => {});
      await app.close().catch(() => {});
    }
  }
})();
