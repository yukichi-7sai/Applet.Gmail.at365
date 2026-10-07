const fs = require("node:fs"),
  path = require("node:path");
const assert = require("node:assert/strict"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, "artifacts", "auth-redirect-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.cpSync(
  path.join(root, "publish/Applet.Gmail.at365"),
  path.join(profile, "extensions/Applet.Gmail.at365"),
  { recursive: true },
);
const settings = hostRequire(
  "./out/main/shared/settings-schema",
).createDefaultSettings();
settings.extensions["at365.gmail"] = {
  enabled: false,
  settings: { notifications: false },
};
fs.writeFileSync(path.join(profile, "settings.json"), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
async function until(fn, message) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
(async () => {
  const application = await electron.launch({
    executablePath: process.argv[2] || hostRequire("electron"),
    args: process.argv[2]
      ? ["--test-profile=" + profile]
      : [host, "--test-profile=" + profile],
    env,
  });
  try {
    const dock = await application.firstWindow();
    await dock.waitForFunction(() => !!window.dock);
    await application.evaluate(({ app }) => {
      globalThis.__authFixtureOrigins = [];
      app.on("web-contents-created", (_event, wc) =>
        wc.on("will-redirect", (event) => {
          if (event.isMainFrame)
            globalThis.__authFixtureOrigins.push(new URL(event.url).origin);
        }),
      );
      app.on("session-created", (ses) => {
        if (!ses.isPersistent()) return;
        ses.protocol.handle("https", (request) => {
          const u = new URL(request.url);
          if (
            u.hostname === "mail.google.com" &&
            !u.searchParams.has("fixture-complete")
          )
            return Response.redirect(
              "https://accounts.google.com/fixture-login?token=fixture-secret",
            );
          if (
            u.hostname === "accounts.google.com" &&
            u.pathname === "/fixture-login"
          )
            return Response.redirect(
              "https://accounts.youtube.com/fixture-check?token=fixture-secret",
            );
          if (u.hostname === "accounts.youtube.com")
            return Response.redirect(
              "https://accounts.google.com/fixture-return?token=fixture-secret",
            );
          if (
            u.hostname === "accounts.google.com" &&
            u.pathname === "/fixture-return"
          )
            return Response.redirect(
              "https://mail.google.com/mail/u/0/?fixture-complete=1#inbox",
            );
          if (
            u.hostname === "accounts.google.com" &&
            u.pathname === "/fixture-blocked"
          )
            return Response.redirect(
              "https://accounts.youtube.com.evil.test/fixture-check?token=fixture-secret",
            );
          return new Response(
            '<!doctype html><title>Auth redirect fixture</title><main role="main"><table><tr class="zA"><td data-legacy-thread-id="fixture-mail">Offline fixture</td></tr></table></main>',
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        });
      });
    });
    await dock.evaluate(() => window.dock.executeCommand("at365.gmail.open"));
    let ui;
    await until(async () => {
      ui = application
        .windows()
        .find((p) => p.url().includes("/web/index.html"));
      return !!ui;
    }, "Gmail controller");
    await ui.waitForFunction(() => !!window.webAccounts);
    const snap = () => ui.evaluate(() => window.webAccounts.snapshot());
    await until(
      async () => (await snap()).accounts[0].status === "受信トレイを監視中",
      "Google/YouTube authentication redirect did not return to Gmail",
    );
    const successful = await snap();
    assert.equal(successful.accounts[0].error, "");
    assert.equal(successful.accounts[0].attention, false);
    assert.equal(
      successful.accounts[0].url,
      "https://mail.google.com/mail/u/0/#inbox",
    );
    const chain = await application.evaluate(
      () => globalThis.__authFixtureOrigins,
    );
    assert.deepEqual(chain.slice(0, 4), [
      "https://accounts.google.com",
      "https://accounts.youtube.com",
      "https://accounts.google.com",
      "https://mail.google.com",
    ]);
    await application.evaluate(async ({ webContents }) => {
      const wc = webContents
        .getAllWebContents()
        .find((w) => w.getURL().startsWith("https://mail.google.com"));
      await wc
        .loadURL("https://accounts.google.com/fixture-blocked")
        .catch(() => {});
    });
    await until(
      async () =>
        (await snap()).accounts[0].error.includes(
          "https://accounts.youtube.com.evil.test",
        ),
      "lookalike origin must be blocked",
    );
    const blocked = await snap();
    assert.ok(
      !JSON.stringify(blocked).includes("fixture-secret"),
      "authentication token must not appear in local UI",
    );
    await ui.evaluate(() => window.webAccounts.navigate("inbox"));
    await until(
      async () => (await snap()).accounts[0].status === "受信トレイを監視中",
      "reload recovery",
    );
    assert.equal((await snap()).accounts[0].error, "");
    const result = {
      ok: true,
      chain,
      checks: [
        "accounts.youtube.com redirect returns to Gmail",
        "lookalike origin blocked",
        "auth token absent from local UI",
        "error clears on recovery",
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
    await application.evaluate(({ app }) => app.quit()).catch(() => {});
    await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
