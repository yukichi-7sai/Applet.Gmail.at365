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
const profile = path.join(root, "artifacts", "portable-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.copyFileSync(
  path.join(host, "publish/AppDock.at365.exe"),
  path.join(profile, "AppDock.at365.exe"),
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
settings.extensions["at365.gmail"] = {
  enabled: false,
  settings: { notifications: false },
};
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let child,
  browser,
  output = "";
async function until(fn, message) {
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    if (await fn()) return;
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
    path.join(profile, "AppDock.at365.exe"),
    ["--test-profile=" + profile, "--remote-debugging-port=" + port],
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
    assert.equal(
      (await dock.evaluate(() => window.dock.snapshot())).version,
      "0.13.0",
    );
    await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
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
    await remote.evaluate(() =>
      document
        .querySelector("tbody")
        .insertAdjacentHTML(
          "afterbegin",
          '<tr class="zA zE"><td class="yW"><span email="fixture@example.test" name="Portable sender">Portable sender</span></td><td><span class="bog" data-legacy-thread-id="portable-arrival">Portable arrival subject</span><span class="y2">private preview</span></td></tr>',
        ),
    );
    await until(
      async () =>
        (await ui.evaluate(() => window.webAccounts.snapshot())).accounts[0]
          .attention,
      "portable DOM arrival",
    );
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await ui
      .getByRole("heading", { name: "Portable arrival subject" })
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
        (await dock.evaluate(() => window.dock.snapshot())).extensions[0]
          .state === "stopped",
      "portable stop",
    );
    await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions[0]
          .state === "running",
      "portable restart",
    );
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
        "unmodified Applet",
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
