// No Playwright or test-tool focus overrides, real accounts, or external network.
const fs = require("node:fs"),
  path = require("node:path");
const { spawn } = require("node:child_process"),
  { createRequire } = require("node:module");
const { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const hostRequire = createRequire(path.join(host, "package.json"));
const before = process.argv.includes("--before");
const codeRoot = process.argv.includes("--packed-core")
  ? path.join(host, "publish/win-unpacked/resources/app.asar")
  : host;
const profile = path.join(root, "artifacts", "native-background-" + Date.now());
const ids = [randomUUID(), randomUUID()];
const dataRoot = path.join(profile, ".appdock");
const accountRoot = path.join(dataRoot, "web-accounts", "at365.gmail");
fs.mkdirSync(accountRoot, { recursive: true });
fs.writeFileSync(
  path.join(accountRoot, "accounts.json"),
  JSON.stringify({
    version: 1,
    selected: ids[0],
    accounts: ids.map((id, i) => ({ id, name: "Fixture " + i })),
  }),
);
const entry = path.join(profile, "main.cjs");
fs.writeFileSync(
  entry,
  `
const { app, BrowserWindow, webContents, session, screen } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const host = ${JSON.stringify(host)}, root = ${JSON.stringify(root)}, profile = ${JSON.stringify(profile)};
const codeRoot = ${JSON.stringify(codeRoot)};
const ids = ${JSON.stringify(ids)}, before = ${before};
process.on('uncaughtException',e=>{fs.writeFileSync(path.join(profile,'result.json'),JSON.stringify({ok:false,error:e.stack}));console.error(e);app.exit(1);});
app.on('window-all-closed',()=>{});
app.setPath('userData',path.join(profile,'chromium'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features','NativeFixtureSentinel');
if(!before)require(path.join(codeRoot,'out/main/main/core/window-rendering')).configureWindowRendering(app);
const states = new Map(ids.map(id=>[id,{revision:0,unread:true}]));
const markup='<main role="main"><table><tr class="zA zE"><td class="yW"><span email="fixture@example.test">Fixture</span></td><td><span class="bog" data-legacy-thread-id="thread-a">Subject</span></td></tr></table></main>';
const body = '<!doctype html><body><script>window.started=false;window.painted=false;window.applied=0;setTimeout(()=>document.body.insertAdjacentHTML("beforeend",'+JSON.stringify(markup)+'),1500);function start(){if(started||!painted||!document.hasFocus())return;started=true;setInterval(async()=>{const v=await(await fetch("/fixture/state",{cache:"no-store"})).json();if(v.revision===applied)return;requestAnimationFrame(()=>{document.querySelector("tr").className="zA "+(v.unread?"zE":"yO");applied=v.revision;});},250);}addEventListener("focus",start);new PerformanceObserver(entries=>{if(!entries.getEntries().some(e=>e.name==="first-contentful-paint"))return;painted=true;start();}).observe({type:"paint",buffered:true});</script>';
const wait = async(fn, label) => {const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error(label);};
app.whenReady().then(async()=>{
  let c, exitCode=0;
  try{
    for(const id of ids){const ses=session.fromPath(path.join(${JSON.stringify(accountRoot)},'sessions',id));ses.protocol.handle('https',r=>new Response(new URL(r.url).pathname==='/fixture/state'?JSON.stringify(states.get(id)):body,{headers:{'content-type':new URL(r.url).pathname==='/fixture/state'?'application/json':'text/html'}}));}
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension.json'),'utf8'));
    manifest.webAccounts.keepActive=!before;
    const { getWebAccounts }=require(path.join(codeRoot,'out/main/main/core/web-accounts'));
    const { InboxMonitor }=require(path.join(root,'publish/Applet.Gmail.at365/monitor'));
    c=getWebAccounts('at365.gmail','Native fixture',path.join(root,'publish/Applet.Gmail.at365'),${JSON.stringify(dataRoot)},manifest.webAccounts);
    await c.start();
    const pages=()=>webContents.getAllWebContents().filter(w=>w.getURL().startsWith('https://mail.google.com'));
    await wait(()=>pages().length===2&&pages().every(w=>!w.isLoading()),'fixture load');
    const sample=()=>Promise.all(pages().map(w=>w.executeJavaScript('({painted:performance.getEntriesByType("paint").some(e=>e.name==="first-contentful-paint"),started,focus:document.hasFocus(),hidden:document.hidden,unread:document.querySelector("tr").classList.contains("zE")})')));
    await new Promise(r=>setTimeout(r,2500));
    if(!before)await wait(async()=>{const s=await sample();return s.every(p=>p.painted&&p.started);},'background initialization');
    const initial=await sample();
    const background=BrowserWindow.getAllWindows()[0];
    assert.equal(background.getOpacity(),0);assert.equal(background.isFocused(),false);
    assert.ok(pages().every(w=>w.debugger.isAttached()===!before));
    assert.ok(initial.every(p=>p.focus===!before&&!p.hidden));
    if(before){assert.ok(initial.every(p=>!p.started));fs.writeFileSync(path.join(profile,'result.json'),JSON.stringify({ok:true,regressionReproduced:true,initial}));console.log(profile);return;}
    assert.ok(initial.every(p=>p.painted&&p.started));
    assert.ok(app.commandLine.getSwitchValue('disable-features').includes('NativeFixtureSentinel'));
    const monitors=new Map(ids.map(id=>[id,new InboxMonitor()]));
    const tick=async()=>{const value=await c.read();for(const a of value.accounts)monitors.get(a.id).observe(a.observation);return value;};
    await wait(async()=>{await tick();return [...monitors.values()].every(m=>m.pending===1);},'startup unread');
    states.set(ids[1],{revision:1,unread:false});
    await wait(async()=>{await tick();return monitors.get(ids[1]).pending===0;},'never-selected account remote read');
    states.set(ids[1],{revision:2,unread:true});
    await wait(async()=>{await tick();return monitors.get(ids[1]).pending===1;},'never-selected account remote unread');
    assert.equal(c.snapshot().selected,ids[0]);
    for(const w of pages())w.reload();
    await wait(async()=>{const s=await sample().catch(()=>[]);return s.length===2&&s.every(p=>p.painted&&p.started);},'reload first paint');
    states.set(ids[0],{revision:1,unread:false});
    await wait(async()=>{await tick();return monitors.get(ids[0]).pending===0;},'reload remote update');
    const after=await sample();
    const page=pages()[0];
    await page.loadURL('https://accounts.google.com/fixture-login');
    await wait(()=>!page.isLoading(),'auth page load');
    assert.equal(page.debugger.isAttached(),false);
    assert.equal(await page.executeJavaScript('document.hasFocus()'),false);
    await page.loadURL('https://mail.google.com/mail/u/0/#inbox');
    await wait(()=>page.debugger.isAttached(),'return to observation origin');
    await c.close();c=undefined;
    await new Promise(r=>setTimeout(r,500));
    assert.equal(BrowserWindow.getAllWindows().length,0);
    fs.writeFileSync(path.join(profile,'result.json'),JSON.stringify({ok:true,checks:['no test-tool focus override','product keepActive without OS focus','first paint and own remote updates before UI opens','two never-selected accounts','read/unread counts','unchanged selection','hidden reload','authentication resets active policy','cleanup','preserve existing feature switches'],packedCore:codeRoot!==host,initial,after},null,2));
    console.log(profile);
  }catch(e){fs.writeFileSync(path.join(profile,'result.json'),JSON.stringify({ok:false,error:e.stack}));console.error(e);exitCode=1;}
  finally{await c?.close();app.exit(exitCode);}
});
`,
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(hostRequire("electron"), [entry], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));
child.on("exit", (code) => {
  if (!fs.existsSync(path.join(profile, "result.json"))) {
    console.error("Native fixture exited without a result: " + code);
    process.exitCode = 1;
    return;
  }
  const result = JSON.parse(
    fs.readFileSync(path.join(profile, "result.json"), "utf8"),
  );
  process.exitCode = result.ok ? code : 1;
});
