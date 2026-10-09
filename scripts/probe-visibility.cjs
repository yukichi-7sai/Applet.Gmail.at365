// Offline Electron experiment: no Gmail sessions or network requests.
const fs = require("node:fs"),
  path = require("node:path"),
  { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const { _electron: electron } = hostRequire("playwright");
const profile = path.join(root, ".artifacts", "visibility-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
const entry = path.join(profile, "main.cjs");
fs.writeFileSync(
  entry,
  `const { app, BrowserWindow, WebContentsView } = require('electron');
app.disableHardwareAcceleration();
app.setPath('userData', ${JSON.stringify(profile)});
app.whenReady().then(async () => {
  globalThis.probeWindow = new BrowserWindow({ width:900, height:640, webPreferences:{backgroundThrottling:false}, show:false });
  await probeWindow.loadURL('data:text/html,<h1>Offline visibility probe</h1>');
  globalThis.probeViews = [];
  for (let i=0;i<2;i++) {
    const view = new WebContentsView({webPreferences:{backgroundThrottling:false, sandbox:true, contextIsolation:true, nodeIntegration:false}});
    view.setBounds({x:100,y:100,width:700,height:400});
    view.setVisible(false);
    probeViews.push(view);
    await view.webContents.loadURL('data:text/html,<main id="box">Fixture '+i+'</main><script>window.framesSeen=0; window.intersecting=null; window.visibilityEvents=[]; function frame(){framesSeen++;requestAnimationFrame(frame)};frame(); document.addEventListener("visibilitychange",()=>visibilityEvents.push(document.visibilityState));new IntersectionObserver(e=>intersecting=e[0].isIntersecting).observe(document.querySelector("main"));</script>');
  }
  probeWindow.contentView.addChildView(probeViews[0]); probeViews[0].setVisible(true);
  probeWindow.show();
});`,
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
(async () => {
  const app = await electron.launch({
    executablePath: hostRequire("electron"),
    args: [entry],
    env,
  });
  const steps = [];
  try {
    await app.firstWindow();
    const sample = async (label) => {
      await new Promise((r) => setTimeout(r, 700));
      const pages = await app.evaluate(async () =>
        Promise.all(
          globalThis.probeViews.map(async (view) => ({
            nativeVisible: view.getVisible(),
            bounds: view.getBounds(),
            ...(await view.webContents.executeJavaScript(
              "({hidden:document.hidden, visibility:document.visibilityState, focus:document.hasFocus(), size:[innerWidth,innerHeight], framesSeen, intersecting, visibilityEvents, paints:performance.getEntriesByType('paint').map(e=>e.name)})",
            )),
          })),
        ),
      );
      steps.push({ label, pages });
    };
    await sample("initial: first attached, second detached and hidden");
    await app.evaluate(() => {
      probeWindow.contentView.removeChildView(probeViews[0]);
      probeViews[0].setVisible(false);
      probeWindow.contentView.addChildView(probeViews[1]);
      probeViews[1].setVisible(true);
    });
    await sample("second selected, first detached and hidden");
    await app.evaluate(() => {
      probeWindow.contentView.addChildView(probeViews[0], 0);
      probeViews[0].setVisible(true);
    });
    await sample("both attached and visible, second stacked above first");
    await app.evaluate(() => probeWindow.hide());
    await sample("both attached while parent hidden");
    await app.evaluate(() => {
      probeWindow.show();
      probeViews[0].setBounds({ x: 1000, y: 1000, width: 700, height: 400 });
    });
    await sample("first parked outside client area");
    await app.evaluate(async ({ BrowserWindow, WebContentsView }) => {
      globalThis.neverShownWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          backgroundThrottling: false,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      const view = new WebContentsView({
        webPreferences: {
          backgroundThrottling: false,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      view.setBounds({ x: 0, y: 0, width: 700, height: 400 });
      view.setVisible(true);
      neverShownWindow.contentView.addChildView(view);
      probeViews.push(view);
      await view.webContents.loadURL(
        'data:text/html,<main>Never shown fixture</main><script>window.framesSeen=0;window.intersecting=null;window.visibilityEvents=[];function frame(){framesSeen++;requestAnimationFrame(frame)};frame();new IntersectionObserver(e=>intersecting=e[0].isIntersecting).observe(document.querySelector("main"));</script>',
      );
    });
    await sample("third attached to never-shown background window");
    await app.evaluate(() => probeViews[2].webContents.focus());
    await sample("third native WebContents focused without showing parent");
    await app.evaluate(({ screen }) => {
      const right = Math.max(
        ...screen.getAllDisplays().map((d) => d.bounds.x + d.bounds.width),
      );
      neverShownWindow.setBounds({
        x: right + 100,
        y: 0,
        width: 800,
        height: 600,
      });
      neverShownWindow.setFocusable(false);
      neverShownWindow.setSkipTaskbar(true);
      neverShownWindow.showInactive();
    });
    await sample("third parent shown inactive outside displays");
    await app.evaluate(() => neverShownWindow.hide());
    await sample("third parent hidden after first native show");
    await app.evaluate(async ({ BrowserWindow, WebContentsView, screen }) => {
      const right = Math.max(
        ...screen.getAllDisplays().map((d) => d.bounds.x + d.bounds.width),
      );
      globalThis.transparentWindow = new BrowserWindow({
        x: right + 100,
        y: 0,
        width: 800,
        height: 600,
        opacity: 0,
        frame: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
        webPreferences: { backgroundThrottling: false },
      });
      const view = new WebContentsView({
        webPreferences: {
          backgroundThrottling: false,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      view.setBounds({ x: 0, y: 0, width: 700, height: 400 });
      transparentWindow.contentView.addChildView(view);
      probeViews.push(view);
      await view.webContents.loadURL(
        'data:text/html,<main>Transparent startup fixture</main><script>window.framesSeen=0;window.intersecting=null;window.visibilityEvents=[];function frame(){framesSeen++;requestAnimationFrame(frame)};frame();new IntersectionObserver(e=>intersecting=e[0].isIntersecting).observe(document.querySelector("main"));</script>',
      );
    });
    await sample("fourth attached to invisible never-shown window");
    await app.evaluate(() => transparentWindow.showInactive());
    await sample("fourth parent shown inactive at opacity zero");
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(steps, null, 2),
    );
    console.log(JSON.stringify({ profile, steps }));
  } finally {
    await app.evaluate(({ app }) => app.quit()).catch(() => {});
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
