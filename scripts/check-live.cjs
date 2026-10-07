const fs = require("node:fs"),
  path = require("node:path"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, "artifacts/gmail-dev");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
(async () => {
  const app = await electron.launch({
    executablePath: hostRequire("electron"),
    args: [host, "--test-profile=" + profile],
    env,
  });
  try {
    const dock = await app.firstWindow();
    await dock.waitForFunction(() => !!window.dock);
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const snap = await dock.evaluate(() => window.dock.snapshot());
      const gmail = snap.extensions.find((e) => e.id === "at365.gmail");
      if (gmail?.state === "error") throw Error(gmail.error);
      if (gmail?.state === "running") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
    let ui;
    while (Date.now() < deadline) {
      ui = app.windows().find((p) => p.url().includes("/web/index.html"));
      if (ui) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ui) throw Error("Gmail window is missing");
    await ui.waitForFunction(() => !!window.webAccounts);
    let data;
    while (Date.now() < deadline) {
      data = await ui.evaluate(() => window.webAccounts.snapshot());
      if (data.accounts.some((a) => a.status === "受信トレイを監視中")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const diagnostics = await app.evaluate(async ({ webContents }) => {
      const pages = webContents
        .getAllWebContents()
        .filter((w) => w.getURL().startsWith("https://mail.google.com"));
      return Promise.all(
        pages.map(async (w) => ({
          origin: new URL(w.getURL()).origin,
          route: new URL(w.getURL()).hash,
          dom: await w.executeJavaScript(
            `({ mains: document.querySelectorAll('[role="main"]').length, rows: document.querySelectorAll('tr.zA').length, legacyIds: document.querySelectorAll('[data-legacy-thread-id]').length, threadIds: document.querySelectorAll('[data-thread-id]').length, lastMessageIds: document.querySelectorAll('[data-legacy-last-message-id]').length, tabs: document.querySelectorAll('[role="tab"][aria-selected="true"]').length, nodeExposed: typeof require !== 'undefined', bridgeExposed: typeof webAccounts !== 'undefined' })`,
          ),
        })),
      );
    });
    const result = {
      loginRetained: data.accounts.some(
        (a) => a.status === "受信トレイを監視中",
      ),
      accounts: data.accounts.map((a) => ({
        loading: a.loading,
        error: a.error,
        status: a.status,
        rowIds: a.observation?.keys?.length ?? 0,
        senderRows:
          a.observation?.details?.filter((d) => !!d.sender).length ?? 0,
        subjectRows:
          a.observation?.details?.filter((d) => !!d.subject).length ?? 0,
        initialHistoryCount: a.data?.arrivals?.length ?? 0,
      })),
      hardwareAcceleration: await app.evaluate(({ app }) =>
        app.isHardwareAccelerationEnabled(),
      ),
      diagnostics,
    };
    fs.writeFileSync(
      path.join(profile, "live-result.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await app.evaluate(({ app }) => app.quit()).catch(() => {});
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
