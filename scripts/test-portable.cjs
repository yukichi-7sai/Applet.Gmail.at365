const {
  getPublishDirectory,
} = require("../../AppDock.at365/scripts/publish-paths.cjs");
const fs = require("node:fs"),
  path = require("node:path"),
  net = require("node:net");
const assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { chromium } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", "portable-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
const executable =
  require("../../AppDock.at365/scripts/copy-host.cjs").prepareTestHost(
    path.join(getPublishDirectory(host), "win-unpacked", "AppDock.at365.exe"),
    profile,
    path.join(root, ".artifacts"),
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
settings.extensions["at365.gmail"] = {
  enabled: false,
  settings: { notifications: false },
};
fs.writeFileSync(
  require("../../AppDock.at365/scripts/test-settings.cjs").file(profile),
  JSON.stringify(settings),
);
const originalAccounts = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "移行元アカウントA",
    sound: { enabled: true, file: "bell.wav" },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "移行元アカウントB",
    sound: { enabled: false, file: "other.wav" },
  },
];
const legacySounds = path.join(
  profile,
  "data/assets/applets/at365.gmail/sounds",
);
const previousState = path.join(profile, "local/web-accounts/at365.gmail");
const { wave } = hostRequire("./scripts/sound-library-fixture.cjs");
fs.mkdirSync(legacySounds, { recursive: true });
fs.mkdirSync(previousState, { recursive: true });
for (const [name, length] of [
  ["bell.wav", 100],
  ["other.wav", 200],
  ["unused.wav", 300],
])
  fs.writeFileSync(path.join(legacySounds, name), wave(length));
fs.writeFileSync(
  path.join(previousState, "accounts.json"),
  JSON.stringify({
    version: 1,
    selected: originalAccounts[0].id,
    accounts: originalAccounts,
  }),
);
const libraryOriginal = path.join(profile, "data/assets/sounds/current.wav");
fs.mkdirSync(path.dirname(libraryOriginal), { recursive: true });
fs.writeFileSync(libraryOriginal, wave(400));
const assignedFile = (file) =>
  path.join(
    profile,
    "data/assets/assigned-sounds",
    file.slice("@library/@assigned/".length),
  );
let retainedSelection;

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let child,
  browser,
  output = "";
async function until(fn, message) {
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
(async () => {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  child = spawn(
    executable,
    [
      "--test-profile=" + profile,
      "--test-local-state=" + path.join(profile, "local"),
      "--remote-debugging-port=" + port,
    ],
    { env, windowsHide: true, stdio: "pipe" },
  );
  child.stdout.on("data", (data) => (output += data));
  child.stderr.on("data", (data) => (output += data));
  try {
    await until(async () => {
      try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:" + port);
        return true;
      } catch {
        return false;
      }
    }, "portable debugger");
    const context = browser.contexts()[0];
    await context.route("https://**/*", (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: '<!doctype html><title>Portable Gmail fixture</title><main role="main"><table><tbody><tr class="zA"><td data-legacy-thread-id="fixture-a">First fixture</td></tr><tr class="zA"><td data-legacy-thread-id="fixture-b">Second fixture</td></tr></tbody></table></main>',
      }),
    );
    let dock, ui, remote;
    await until(async () => {
      dock = context.pages().find((p) => p.url().startsWith("appdock://"));
      return !!dock;
    }, "portable host UI");
    await dock.waitForFunction(() => !!window.dock);
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).startupReady,
      "host startup ready",
    );
    assert.equal(
      (await dock.evaluate(() => window.dock.snapshot())).version,
      hostRequire("./package.json").version,
    );
    // The Applet manifest grants publication; the host has no Gmail allowlist.
    await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === "at365.gmail",
        )?.state === "running",
      "Gmail running before external execution",
    );
    const configFile = path.join(profile, "codex", "config.toml");
    await dock.evaluate(
      (file) => window.dock.automation({ kind: "selectConfig", file }),
      configFile,
    );
    await dock.evaluate(() =>
      window.dock.automation({
        kind: "configure",
        receiver: "codex",
        enabled: true,
        port: 0,
      }),
    );
    await dock.evaluate(() =>
      window.dock.automation({ kind: "setWrite", allowed: true }),
    );
    await dock.evaluate(() =>
      window.dock.automation({ kind: "setExecution", allowed: true }),
    );
    const registration = await dock.evaluate(() =>
      window.dock.automation({ kind: "register" }),
    );
    const receiver = registration.state.codex;
    assert.equal(receiver.registration, "registered");
    const { Client } = hostRequire("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } = hostRequire(
      "@modelcontextprotocol/sdk/client/streamableHttp.js",
    );
    const headers = hostRequire("smol-toml").parse(
      fs.readFileSync(configFile, "utf8"),
    ).mcp_servers[receiver.serverId].http_headers;
    const mcp = new Client({ name: "gmail-portable-test", version: "1" });
    try {
      await mcp.connect(
        new StreamableHTTPClientTransport(new URL(receiver.endpoint), {
          requestInit: { headers },
        }),
      );
      const listed = await mcp.callTool({
        name: "appdock_list_commands",
        arguments: {},
      });
      const published = listed.structuredContent.commands.filter(
        (c) => c.appletId === "at365.gmail",
      );
      assert.deepEqual(
        published.map((c) => c.id).sort(),
        [
          "at365.gmail.open",
          "at365.gmail.settings.update",
          ...["enable", "disable", "restart"].map(
            (action) => `appdock.applets.at365.gmail.${action}`,
          ),
          ...[
            "unreadOnly",
            "showToolbar",
            "monitoring",
            "notifications",
          ].flatMap((key) =>
            ["on", "off", "toggle"].map(
              (action) => `at365.gmail.settings.${key}.${action}`,
            ),
          ),
        ].sort(),
      );
      assert(published.some((c) => c.id === "at365.gmail.settings.update"));
      assert(
        published.some(
          (c) => c.id === "at365.gmail.settings.monitoring.toggle",
        ),
      );
      const opened = await mcp.callTool({
        name: "appdock_execute_command",
        arguments: { id: "at365.gmail.open" },
      });
      assert.equal(opened.isError, undefined);
      assert.equal(opened.structuredContent.completion, "handlerReturned");
      await until(async () => {
        ui = context.pages().find((p) => p.url().includes("/web/index.html"));
        return !!ui;
      }, "Gmail UI for settings");
      await ui.waitForFunction(() => !!window.webAccounts);
      const run = async (id, args) => {
        const result = await mcp.callTool({
          name: "appdock_execute_command",
          arguments: { id, ...(args ? { args } : {}) },
        });
        assert.equal(result.isError, undefined);
        return result.structuredContent;
      };
      const current = (
        await mcp.callTool({
          name: "appdock_get_settings",
          arguments: { appletId: "at365.gmail" },
        })
      ).structuredContent;
      assert.deepEqual(Object.keys(current.values).sort(), [
        "historyLimit",
        "monitoring",
        "notificationDetails",
        "notifications",
        "openExternalWithoutConfirmation",
        "returnToInboxOnHide",
        "showToolbar",
        "unreadOnly",
      ]);
      await run("at365.gmail.settings.update", {
        changes: { historyLimit: "30" },
        expectedRevision: current.revision,
        dryRun: true,
      });
      await run("at365.gmail.settings.monitoring.off");
      await until(
        async () =>
          (await ui.evaluate(() => window.webAccounts.snapshot())).settings
            .monitoring === false,
        "Gmail saved monitoring OFF",
      );
      await until(
        async () =>
          (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
            .status === "全体の新着監視はOFFです",
        "Gmail runtime observes monitoring OFF",
      );
      await run("at365.gmail.settings.monitoring.toggle");
      await until(
        async () =>
          (await ui.evaluate(() => window.webAccounts.snapshot())).settings
            .monitoring === true,
        "Gmail saved monitoring toggle",
      );
      await run("at365.gmail.settings.showToolbar.off");
      await until(
        async () =>
          (await ui.evaluate(() => window.webAccounts.snapshot())).settings
            .showToolbar === false,
        "Gmail toolbar OFF",
      );
      await dock.evaluate(() =>
        window.dock.executeCommand("at365.gmail.settings.showToolbar.on"),
      );
      await until(
        async () =>
          (await ui.evaluate(() => window.webAccounts.snapshot())).settings
            .showToolbar === true,
        "Gmail local toolbar ON",
      );
      const saved = JSON.parse(
        fs.readFileSync(
          require("../../AppDock.at365/scripts/test-settings.cjs").file(
            profile,
          ),
        ),
      ).extensions["at365.gmail"].settings;
      assert.equal(saved.monitoring ?? true, true);
      assert.equal(saved.showToolbar ?? true, true);
      assert.equal(saved.notifications, false);
    } finally {
      await mcp.close();
    }
    await dock.evaluate(() => window.dock.automation({ kind: "unregister" }));
    const migrated = await ui.evaluate(() => window.webAccounts.snapshot());
    assert.deepEqual(
      migrated.accounts.map((a) => a.id),
      originalAccounts.map((a) => a.id),
    );
    assert.deepEqual(
      migrated.accounts.map((a) => a.name),
      originalAccounts.map((a) => a.name),
    );
    assert.deepEqual(
      migrated.accounts.map((a) => a.sound.enabled),
      [true, false],
    );
    for (const [index, length] of [
      [0, 100],
      [1, 200],
    ]) {
      assert(
        migrated.accounts[index].sound.file.startsWith("@library/@assigned/"),
      );
      assert.deepEqual(
        fs.readFileSync(assignedFile(migrated.accounts[index].sound.file)),
        wave(length),
      );
    }
    assert.deepEqual(
      fs.readFileSync(
        path.join(
          profile,
          "data/assets/sounds/Imported notification sounds/at365.gmail/unused.wav",
        ),
      ),
      wave(300),
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(
          path.join(previousState, "sound-library-migration.json"),
          "utf8",
        ),
      ).completed,
      true,
    );
    assert.equal(migrated.selected, originalAccounts[0].id);
    await ui
      .getByRole("button", { name: "アカウント設定", exact: true })
      .click();
    const picker = () =>
      dock.getByRole("dialog", { name: "音を選択", exact: true });
    const choose = async () => {
      await ui
        .getByRole("button", { name: "音ライブラリーから選ぶ", exact: true })
        .click();
      await picker().waitFor();
      await picker()
        .getByRole("button", { name: "current.wavを選択", exact: true })
        .click();
    };
    await choose();
    await picker()
      .getByRole("button", { name: "キャンセル", exact: true })
      .click();
    await picker().waitFor({ state: "hidden" });
    assert.equal(
      (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0].sound
        .file,
      migrated.accounts[0].sound.file,
    );
    await choose();
    await picker()
      .getByRole("button", { name: "音を使う", exact: true })
      .click();
    await picker().waitFor({ state: "hidden" });
    await until(
      async () =>
        (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .sound.name === "current.wav",
      "shared sound selected",
    );
    retainedSelection = (await ui.evaluate(() => window.webAccounts.snapshot()))
      .accounts[0].sound;
    assert.equal(retainedSelection.enabled, true);
    assert.equal(
      (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[1].sound
        .enabled,
      false,
    );
    await ui
      .getByLabel("このアカウントの通知音を鳴らす", { exact: true })
      .uncheck();
    await until(
      async () =>
        !(await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .sound.enabled,
      "independent sound off",
    );
    await ui.getByRole("button", { name: "試聴", exact: true }).click();
    assert.equal(
      (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0].sound
        .enabled,
      false,
    );
    await ui
      .getByLabel("このアカウントの通知音を鳴らす", { exact: true })
      .check();
    await until(
      async () =>
        (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .sound.enabled,
      "sound restored ON",
    );
    fs.writeFileSync(libraryOriginal, wave(500));
    fs.unlinkSync(libraryOriginal);
    assert.deepEqual(
      fs.readFileSync(assignedFile(retainedSelection.file)),
      wave(400),
    );
    assert.equal(
      await ui.getByText("（同期待ち・未登録）", { exact: true }).count(),
      0,
    );
    for (const account of originalAccounts)
      assert(fs.existsSync(path.join(legacySounds, account.sound.file)));
    await ui.screenshot({ path: path.join(profile, "sound-library.png") });

    const logs = (await dock.evaluate(() => window.dock.snapshot())).logs;
    assert.ok(
      logs.some(
        (l) =>
          l.source === "automation" &&
          l.message.includes("target=at365.gmail.settings.monitoring.toggle") &&
          l.message.includes("completion=settingsSaved"),
      ),
    );
    assert.ok(
      logs.some(
        (l) =>
          l.source === "automation" &&
          l.message.includes("target=at365.gmail.open") &&
          l.message.includes("result=success"),
      ),
    );
    await until(async () => {
      ui = context.pages().find((p) => p.url().includes("/web/index.html"));
      remote = context
        .pages()
        .find((p) => p.url().startsWith("https://mail.google.com"));
      return !!ui && !!remote;
    }, "portable Gmail UI");
    await ui.waitForFunction(() => !!window.webAccounts);
    await until(
      async () =>
        (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .status === "受信トレイを監視中",
      "portable observer",
    );
    assert.equal(
      await remote.locator('[data-legacy-thread-id="fixture-a"]').count(),
      1,
      "offline fixture must be loaded",
    );
    assert.deepEqual(
      await remote.evaluate(() => ({
        node: typeof require,
        bridge: typeof webAccounts,
      })),
      { node: "undefined", bridge: "undefined" },
    );
    await until(
      async () =>
        (await ui.evaluate(() => window.webAccounts.snapshot())).accounts.every(
          (a) => a.status === "受信トレイを監視中",
        ),
      "both account observers ready",
    );
    for (const accountPage of context
      .pages()
      .filter((p) => p.url().startsWith("https://mail.google.com"))) {
      await accountPage.evaluate(() =>
        document
          .querySelector("tbody")
          .insertAdjacentHTML(
            "afterbegin",
            '<tr class="zA zE"><td class="yW"><span email="fixture@example.test" name="Portable sender">Portable sender</span></td><td><span class="bog" data-legacy-thread-id="portable-arrival">Portable arrival subject</span><span class="y2">private preview</span></td></tr>',
          ),
      );
    }
    await until(
      async () =>
        (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .attention,
      "portable DOM arrival",
    );
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await ui
      .getByRole("heading", { name: "Portable arrival subject" })
      .first()
      .waitFor();
    const arrivalData = (await ui.evaluate(() => window.webAccounts.snapshot()))
      .accounts[0].data;
    assert.equal(arrivalData.pending, 1);
    assert.equal(arrivalData.arrivals[0].sender, "Portable sender");
    assert.ok(!JSON.stringify(arrivalData).includes("private preview"));
    await ui.screenshot({ path: path.join(profile, "arrivals.png") });
    await dock.evaluate(() =>
      window.dock.executeCommand("at365.gmail.acknowledge"),
    );
    await until(
      async () =>
        !(await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .attention,
      "portable acknowledgement",
    );
    await dock.evaluate(() =>
      window.dock.toggleExtension("at365.gmail", false),
    );
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === "at365.gmail",
        ).state === "stopped",
      "portable stop",
    );
    await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === "at365.gmail",
        ).state === "running",
      "portable restart",
    );
    await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
    ui = await until(
      () => context.pages().find((p) => p.url().includes("/web/index.html")),
      "restarted UI",
    );
    await ui.waitForFunction(() => !!window.webAccounts);
    const restored = await ui.evaluate(() => window.webAccounts.snapshot());
    assert.deepEqual(
      restored.accounts.map((a) => a.id),
      originalAccounts.map((a) => a.id),
    );
    assert.deepEqual(restored.accounts[0].sound, retainedSelection);
    assert.equal(restored.accounts[1].sound.enabled, false);
    const final = await dock.evaluate(() => window.dock.snapshot());
    assert.equal(final.logs.filter((l) => l.level === "error").length, 0);
    await dock.evaluate(() => window.dock.windowAction("quit")).catch(() => {});
    await until(async () => child.exitCode !== null, "portable clean exit");
    assert.equal(child.exitCode, 0);
    const result = {
      ok: true,
      version: final.version,
      exitCode: child.exitCode,
      checks: [
        "legacy sounds including unused audio and enabled/disabled account assignments migrate without deleting originals",
        "Gmail common sound picker cancel/apply, preview while off and retained copies survive source deletion and restart",
        "published Applet manifest discovery, MCP open/settings commands and local generated switches with audit log",
        "actual portable EXE",
        "offline WebContentsView",
        "remote isolation",
        "DOM arrival",
        "metadata and history UI without preview",
        "acknowledge",
        "stop/restart",
        "clean exit",
      ],
    };
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify({ profile, ...result }));
  } catch (error) {
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify({ ok: false, error: error.stack }),
    );
    throw error;
  } finally {
    if (browser) await browser.close();
    if (child?.exitCode === null) child.kill();
    fs.writeFileSync(path.join(profile, "process.log"), output);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
