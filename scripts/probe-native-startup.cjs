// Native launch + main-process inspector only: no Playwright focus emulation.
// Logs counts/booleans, never messages, IDs, credentials or request URLs.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const profile = path.join(root, "artifacts/gmail-dev");
const actionFile = path.join(profile, "startup-action.json");
const resultFile = path.join(profile, "startup-native-probe.json");
const endpointFile = path.join(profile, "startup-inspector.txt");
const manual = process.argv.includes("--manual");
const env = { ...process.env };
const duration = Number(
  process.argv
    .find((a) => a.startsWith("--duration="))
    ?.slice("--duration=".length) || 600000,
);
delete env.ELECTRON_RUN_AS_NODE;
fs.writeFileSync(actionFile, '""');
const actions = {
  "on-screen": `for(const w of backgroundWindows()){w.setIgnoreMouseEvents(true);const a=electron.screen.getPrimaryDisplay().workArea;w.setPosition(a.x+40,a.y+40);}`,
  capture: `for(const w of mailPages())await w.capturePage();`,
  visible: `for(const w of backgroundWindows()){w.setOpacity(1);w.showInactive();}`,
  focusable: `for(const w of backgroundWindows())w.setFocusable(true);for(const w of mailPages())w.focus();`,
  emulation: `for(const w of mailPages()){w.debugger.attach('1.3');await w.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});}`,
  open: `const dock=electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('appdock://host'));await dock.webContents.executeJavaScript('window.dock.executeCommand("at365.gmail.open")');`,
  focus: `for(const w of mailPages())w.focus();`,
  reload: `for(const w of mailPages())w.reload();`,
  quit: `electron.app.quit();`,
};
(async () => {
  const flags = process.argv.includes("--disable-occlusion")
    ? ["--disable-features=CalculateNativeWinOcclusion"]
    : [];
  const child = spawn(
    hostRequire("electron"),
    ["--inspect=0", ...flags, host, "--test-profile=" + profile],
    { env, stdio: ["ignore", "ignore", "pipe"] },
  );
  let ws;
  const samples = [];
  try {
    const endpoint = await new Promise((resolve, reject) => {
      child.stderr.on("data", (d) => {
        const m = String(d).match(
          /Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/,
        );
        if (m) resolve(m[1]);
      });
      child.on("error", reject);
      child.on("exit", () => reject(Error("Electron exited before inspector")));
    });
    fs.writeFileSync(endpointFile, endpoint);
    ws = new WebSocket(endpoint);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let sequence = 0;
    const pending = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error || m.result.exceptionDetails)
          p.reject(Error("Native probe evaluation failed"));
        else p.resolve(m.result.result.value);
      }
    });
    const evaluate = (expression) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        ws.send(
          JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: { expression, awaitPromise: true, returnByValue: true },
          }),
        );
      });
    await new Promise((r) => setTimeout(r, 200));
    await evaluate(
      `(()=>{globalThis.electron=process.mainModule.require('electron');globalThis.mailPages=()=>electron.webContents.getAllWebContents().filter(w=>w.getURL().startsWith('https://mail.google.com'));globalThis.backgroundWindows=()=>electron.BrowserWindow.getAllWindows().filter(w=>w.contentView.children.some(v=>mailPages().includes(v.webContents)));globalThis.liveNetwork=new Map();const watch=ses=>{if(!ses.storagePath?.includes('web-accounts')||liveNetwork.has(ses.storagePath))return;const count={completed:0,failed:0,sync:0,xhr:0};liveNetwork.set(ses.storagePath,count);ses.webRequest.onCompleted({urls:['https://mail.google.com/*']},d=>{count.completed++;if(d.resourceType==='xhr')count.xhr++;if(new URL(d.url).pathname.includes('/sync/'))count.sync++;});ses.webRequest.onErrorOccurred({urls:['https://mail.google.com/*']},()=>count.failed++);};electron.app.on('session-created',watch);for(const w of electron.webContents.getAllWebContents())watch(w.session);return true;})()`,
    );
    let phase = "startup";
    let lastAction = "";
    for (
      let i = 0;
      (manual || i < Math.ceil(duration / 5000)) && child.exitCode === null;
      i++
    ) {
      const action = JSON.parse(fs.readFileSync(actionFile, "utf8"));
      if (action && action !== lastAction && actions[action]) {
        lastAction = action;
        phase = action;
        await evaluate(`(async()=>{${actions[action]}return true;})()`);
        if (action === "quit") break;
      }
      await new Promise((r) => setTimeout(r, 5000));
      const pages = await evaluate(
        `(async()=>Promise.all(mailPages().map(async(w,index)=>{const owner=backgroundWindows().find(b=>b.contentView.children.some(v=>v.webContents===w));return {index,loading:w.isLoading(),debuggerAttached:w.debugger.isAttached(),nativeFocus:w.isFocused(),ownerFocused:owner?.isFocused(),ownerOpacity:owner?.getOpacity(),network:liveNetwork.get(w.session.storagePath),dom:await w.executeJavaScriptInIsolatedWorld(1002,[{code:"({hidden:document.hidden,focus:document.hasFocus(),inbox:location.hash==='#inbox',painted:performance.getEntriesByType('paint').some(e=>e.name==='first-contentful-paint'),rows:document.querySelectorAll('tr.zA').length,unread:document.querySelectorAll('tr.zA.zE').length,resources:performance.getEntriesByType('resource').length})"}])};})))()`,
      );
      const summary = await evaluate(
        `(()=>{try{const c=process.mainModule.require(${JSON.stringify(path.join(host, "out/main/main/core/web-accounts"))}).getWebAccounts('at365.gmail');return {pending:c.snapshot().accounts.map(a=>a.data?.pending??0),avatars:c.snapshot().accounts.map(a=>a.avatar.startsWith('data:image/png;base64,')),monitoring:c.snapshot().accounts.map(a=>a.monitoring),uiOpened:electron.BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().includes('/web/index.html')),hardwareAcceleration:electron.app.isHardwareAccelerationEnabled()};}catch{return null;}})()`,
      );
      if (process.argv.includes("--avatar-match") && i === 2) {
        const matches = await evaluate(
          `(async()=>{const c=process.mainModule.require(${JSON.stringify(path.join(host, "out/main/main/core/web-accounts"))}).getWebAccounts('at365.gmail');return process.mainModule.require(${JSON.stringify(path.join(root, "scripts/avatar-match.cjs"))})(electron,c,${JSON.stringify(path.join(root, "artifacts/avatar-match-live"))});})()`,
        );
        console.log(JSON.stringify({ avatarMatch: matches }));
      }
      const value = { elapsedSeconds: (i + 1) * 5, phase, pages, summary };
      samples.push(value);
      fs.writeFileSync(resultFile, JSON.stringify(samples, null, 2));
      if (
        i % 3 === 0 ||
        phase !== samples.at(-2)?.phase ||
        JSON.stringify(
          pages.map((p) => [p.dom.rows, p.dom.unread, p.dom.focus]),
        ) !==
          JSON.stringify(
            samples
              .at(-2)
              ?.pages.map((p) => [p.dom.rows, p.dom.unread, p.dom.focus]),
          )
      )
        console.log(JSON.stringify(value));
    }
    await evaluate("electron.app.quit()").catch(() => {});
  } finally {
    fs.rmSync(endpointFile, { force: true });
    ws?.close();
    if (child.exitCode === null)
      await new Promise((r) => {
        child.once("exit", r);
        setTimeout(() => {
          child.kill();
          r();
        }, 5000).unref();
      });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
