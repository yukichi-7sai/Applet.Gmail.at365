const fs = require("node:fs"),
  path = require("node:path"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts/gmail-dev");
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
    let startupBeforeUi = null;
    if (process.argv.includes("--startup-paint")) {
      while (Date.now() < deadline) {
        startupBeforeUi = await app.evaluate(
          async ({ webContents, BrowserWindow, screen }) => {
            const pages = webContents
              .getAllWebContents()
              .filter((w) => w.getURL().startsWith("https://mail.google.com"));
            const helper = BrowserWindow.getAllWindows().find((w) =>
              w.contentView.children.some((v) => pages.includes(v.webContents)),
            );
            return {
              userUiOpened: BrowserWindow.getAllWindows().some((w) =>
                w.webContents.getURL().includes("/web/index.html"),
              ),
              helperFocused: helper?.isFocused() ?? false,
              helperOpacity: helper?.getOpacity(),
              pages: await Promise.all(
                pages.map(async (w) => ({
                  loading: w.isLoading(),
                  ...(await w.executeJavaScriptInIsolatedWorld(1002, [
                    {
                      code: '({painted:performance.getEntriesByType("paint").some(e=>e.name==="first-contentful-paint"),rows:document.querySelectorAll("tr.zA").length})',
                    },
                  ])),
                })),
              ),
            };
          },
        );
        if (
          startupBeforeUi.pages.length &&
          startupBeforeUi.pages.every(
            (p) => !p.loading && p.painted && p.rows > 0,
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
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
      if (data.accounts.some((a) => a.observation?.ready)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    let readItemCheck = null;
    if (process.argv.includes("--open-read-item")) {
      // Development-only: open an already-read row and immediately return.
      // Never select an unread row or extract the message body/URL identifier.
      const account = data.accounts.find(
        (a) => a.observation?.ready && a.observation.read?.length,
      );
      if (account) {
        const key = account.observation.read.find((key) =>
          account.observation.details?.some(
            (detail) => detail.key === key && detail.subject,
          ),
        );
        if (key) {
          const dispatched = await ui.evaluate(
            ({ id, key }) => window.webAccounts.openItem(id, key),
            { id: account.id, key },
          );
          let navigated = false;
          const openDeadline = Date.now() + 4000;
          while (Date.now() < openDeadline) {
            const current = await ui.evaluate(() =>
              window.webAccounts.snapshot(),
            );
            const selected = current.accounts.find((a) => a.id === account.id);
            if (
              selected &&
              new URL(selected.url).origin === "https://mail.google.com" &&
              new URL(selected.url).hash !== "#inbox"
            ) {
              navigated = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          readItemCheck = { dispatched, navigated, onlyAlreadyRead: true };
          await ui.evaluate(() => window.webAccounts.navigate("inbox"));
          const returnDeadline = Date.now() + 15000;
          while (Date.now() < returnDeadline) {
            data = await ui.evaluate(() => window.webAccounts.snapshot());
            if (
              data.accounts.some(
                (a) => a.id === account.id && a.observation?.ready,
              )
            )
              break;
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }
    }
    // Temporarily show the local history tab; Gmail itself stays in the background.
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    const diagnostics = await app.evaluate(async ({ webContents }) => {
      const pages = webContents
        .getAllWebContents()
        .filter((w) => w.getURL().startsWith("https://mail.google.com"));
      return Promise.all(
        pages.map(async (w) => ({
          origin: new URL(w.getURL()).origin,
          route: new URL(w.getURL()).hash,
          backgroundFrame: await w.executeJavaScriptInIsolatedWorld(1002, [
            {
              code: "new Promise(resolve => {const timer=setTimeout(()=>resolve(false),1000);requestAnimationFrame(()=>{clearTimeout(timer);resolve(true)})})",
            },
          ]),
          dom: await w.executeJavaScript(
            `({ mains: document.querySelectorAll('[role="main"]').length, rows: document.querySelectorAll('tr.zA').length, legacyIds: document.querySelectorAll('[data-legacy-thread-id]').length, threadIds: document.querySelectorAll('[data-thread-id]').length, lastMessageIds: document.querySelectorAll('[data-legacy-last-message-id]').length, tabs: document.querySelectorAll('[role="tab"][aria-selected="true"]').length, nodeExposed: typeof require !== 'undefined', bridgeExposed: typeof webAccounts !== 'undefined' })`,
          ),
        })),
      );
    });
    const result = {
      loginRetained: data.accounts.some((a) => a.observation?.ready === true),
      readItemCheck,
      startupBeforeUi,
      accounts: data.accounts.map((a) => ({
        accountNameDetected: !!a.observation?.accountName,
        loading: a.loading,
        error: a.error,
        status: a.status,
        rowIds: a.observation?.keys?.length ?? 0,
        senderRows:
          a.observation?.details?.filter((d) => !!d.sender).length ?? 0,
        subjectRows:
          a.observation?.details?.filter((d) => !!d.subject).length ?? 0,
        initialHistoryCount: a.data?.arrivals?.length ?? 0,
        unreadRows: a.observation?.unread?.length ?? 0,
        readRows: a.observation?.read?.length ?? 0,
        pendingUnread: a.data?.pending ?? 0,
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
