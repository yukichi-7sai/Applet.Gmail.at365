const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", "background-" + Date.now());
const accounts = [0, 1].map((i) => ({
  id: randomUUID(),
  name: "Background fixture " + (i + 1),
}));
const accountFile = path.join(
  profile,
  ".appdock/web-accounts/at365.gmail/accounts.json",
);
fs.mkdirSync(path.dirname(accountFile), { recursive: true });
fs.writeFileSync(
  accountFile,
  JSON.stringify({ version: 1, selected: accounts[0].id, accounts }),
);
const settings = hostRequire(
  "./out/main/shared/settings-schema",
).createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.extensions["at365.gmail"] = {
  pages: { gmail: { display: "window" } },
  enabled: false,
  settings: { notifications: false },
};
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
fs.cpSync(
  path.join(root, "publish/Applet.Gmail.at365"),
  path.join(profile, "extensions/Applet.Gmail.at365"),
  { recursive: true },
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app, ui;
async function until(fn, message) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
const snapshot = () => ui.evaluate(() => window.webAccounts.snapshot());
const remoteStates = () =>
  app.evaluate(async ({ webContents }) =>
    Promise.all(
      webContents
        .getAllWebContents()
        .filter((wc) => wc.getURL().startsWith("https://mail.google.com"))
        .map(async (wc) => ({
          id: pathId(wc.session.storagePath),
          ...(await wc.executeJavaScript(
            '({ frames:window.framesSeen, started:window.paintStarted, paints:performance.getEntriesByType("paint").map(e=>e.name), applied:window.applied, hidden:document.hidden, size:[innerWidth,innerHeight], unread:document.querySelector("tr").classList.contains("zE") })',
          )),
        })),
    ).catch((e) => {
      throw e;
    }),
  );
(async () => {
  try {
    app = await electron.launch({
      executablePath: process.argv[2] || hostRequire("electron"),
      args: process.argv[2]
        ? ["--test-profile=" + profile]
        : [host, "--test-profile=" + profile],
      env,
    });
    const dock = await app.firstWindow();
    await dock.waitForFunction(() => !!window.dock);
    await app.evaluate(({ app }) => {
      globalThis.fixtureStates = new Map();
      globalThis.pathId = (directory) => directory.split(/[\\/]/).at(-1);
      app.on("session-created", (ses) => {
        if (!ses.isPersistent()) return;
        const id = pathId(ses.storagePath);
        fixtureStates.set(id, { revision: 0, unread: true });
        ses.protocol.handle("https", (request) => {
          if (new URL(request.url).pathname === "/fixture/state")
            return new Response(JSON.stringify(fixtureStates.get(id)), {
              headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
              },
            });
          // The fixture's own rendering, not the test, applies remote updates in rAF.
          return new Response(
            '<!doctype html><title>Background Gmail fixture</title><main role="main"><table><tbody><tr class="zA zE"><td class="yW"><span email="fixture@example.test">Fixture sender</span></td><td><span class="bog" data-legacy-thread-id="thread-a">Background subject</span></td></tr></tbody></table></main><script>window.framesSeen=0;window.applied=0;function frame(){framesSeen++;requestAnimationFrame(frame)};frame();window.paintStarted=false;let busy=false;new PerformanceObserver(entries=>{if(window.paintStarted||!entries.getEntries().some(e=>e.name==="first-contentful-paint"))return;window.paintStarted=true;setInterval(async()=>{if(busy)return;busy=true;try{const value=await(await fetch("/fixture/state",{cache:"no-store"})).json();if(value.revision!==window.applied)requestAnimationFrame(()=>{document.querySelector("tr").className="zA "+(value.unread?"zE":"yO");window.applied=value.revision;});}finally{busy=false;}},250);}).observe({type:"paint",buffered:true});</script>',
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        });
      });
    });
    await dock.evaluate(() => window.dock.toggleExtension("at365.gmail", true));
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === "at365.gmail",
        )?.panel?.facts?.length === 2,
      "startup monitor reads both never-selected accounts",
    );
    await until(async () => {
      const states = await remoteStates();
      return (
        states.length === 2 &&
        states.every(
          (s) => s.started && s.frames > 1 && s.size[0] > 500 && !s.hidden,
        )
      );
    }, "background page layout and rendering before UI opens");
    const beforeOpen = await remoteStates();
    const helper = await app.evaluate(({ BrowserWindow, screen }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.webContents?.getURL().startsWith("https://mail.google.com"),
        ),
      );
      return {
        opacity: w.getOpacity(),
        focused: w.isFocused(),
        visible: w.isVisible(),
        outsideDisplays: screen
          .getAllDisplays()
          .every((d) => w.getBounds().x >= d.bounds.x + d.bounds.width),
      };
    });
    assert.deepEqual(helper, {
      opacity: 0,
      focused: false,
      visible: true,
      outsideDisplays: true,
    });
    const helperId = await app.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().find((w) => w.getOpacity() === 0).id,
    );
    assert.equal(beforeOpen.length, 2);
    assert.ok(
      beforeOpen.every(
        (s) =>
          s.started &&
          s.paints.includes("first-contentful-paint") &&
          s.frames > 1 &&
          s.size[0] > 500 &&
          !s.hidden,
      ),
    );
    await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
    await until(async () => {
      ui = app
        .context()
        .pages()
        .find((p) => p.url().includes("/web/index.html"));
      return !!ui;
    }, "Gmail UI");
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data?.pending === 1),
      "startup unread",
    );
    const change = (id, revision, unread) =>
      app.evaluate(
        (_electron, value) =>
          fixtureStates.set(value.id, {
            revision: value.revision,
            unread: value.unread,
          }),
        { id, revision, unread },
      );
    await change(accounts[1].id, 1, false);
    await until(
      async () => (await snapshot()).accounts[1].data.pending === 0,
      "unselected account receives remote read update without selection",
    );
    assert.equal((await snapshot()).selected, accounts[0].id);
    assert.equal((await snapshot()).accounts[0].data.pending, 1);
    await change(accounts[1].id, 2, true);
    await until(
      async () => (await snapshot()).accounts[1].data.pending === 1,
      "unselected account receives remote unread update",
    );
    assert.equal((await snapshot()).accounts[1].data.arrivals.length, 1);
    await ui.getByRole("button", { name: /^新着一覧/ }).click();
    await change(accounts[0].id, 1, false);
    await change(accounts[1].id, 3, false);
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data.pending === 0),
      "both accounts update while history is visible",
    );
    assert.equal(await ui.getByText("既読", { exact: true }).count(), 2);
    await ui.getByRole("button", { name: "受信トレイ", exact: true }).click();
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
              ).length === 1,
        ),
      "selected view returns to UI",
    );
    const hidden = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      w.close();
      return { destroyed: w.isDestroyed(), visible: w.isVisible() };
    });
    assert.deepEqual(hidden, { destroyed: false, visible: false });
    await app.evaluate(({ webContents }) => {
      for (const w of webContents.getAllWebContents()) {
        if (w.getURL().startsWith("https://mail.google.com")) w.reload();
      }
    });
    await until(async () => {
      const states = await remoteStates();
      return (
        states.length === 2 &&
        states.every(
          (s) => s.started && s.paints.includes("first-contentful-paint"),
        )
      );
    }, "first paint after reloading while UI is hidden");
    await change(accounts[0].id, 2, true);
    await change(accounts[1].id, 4, true);
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data.pending === 1),
      "both accounts update after Gmail window closes to tray",
    );
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.contentView.children.some((v) =>
          v.children.some((c) =>
            c.webContents?.getURL().includes("/web/index.html"),
          ),
        ),
      );
      w.show();
      w.minimize();
    });
    await change(accounts[1].id, 5, false);
    await change(accounts[0].id, 3, false);
    await until(
      async () =>
        (await snapshot()).accounts.every((a) => a.data.pending === 0),
      "minimized update",
    );
    const after = await remoteStates();
    assert.ok(
      after.every(
        (s) => s.frames > beforeOpen.find((a) => a.id === s.id).frames,
      ),
    );
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
    const backgroundWindows = await app.evaluate(
      ({ BrowserWindow }, helperId) =>
        BrowserWindow.getAllWindows().filter((w) => w.id === helperId).length,
      helperId,
    );
    assert.equal(backgroundWindows, 0);
    const result = {
      ok: true,
      checks: [
        "rAF updates before UI opens",
        "first contentful paint before UI opens and after hidden reload",
        "transparent offscreen helper never takes focus",
        "remote read/unread update in never-selected account",
        "selection remains unchanged",
        "history and tray-hidden updates",
        "minimized updates",
        "stop destroys background window",
      ],
      beforeOpen,
      helper,
      after,
    };
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify({ profile, ...result }));
  } catch (e) {
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify({ ok: false, error: e.stack }),
    );
    throw e;
  } finally {
    if (app) {
      await app.evaluate(({ app }) => app.quit()).catch(() => {});
      await app.close().catch(() => {});
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
