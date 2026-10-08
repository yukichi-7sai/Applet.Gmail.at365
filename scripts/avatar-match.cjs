// Development-only, main-process diagnostic. Only the header avatar is captured;
// report scalars, never URLs, account names, cookie values or message contents.
module.exports = async function avatarMatch(electron, controller, directory) {
  const fs = require("node:fs"),
    path = require("node:path");
  const host = path.resolve(__dirname, "../../AppDock.at365");
  const { fetchWebAvatar, webAvatarResponse } = require(
    path.join(host, "out/main/main/core/web-account-avatar"),
  );
  fs.mkdirSync(directory, { recursive: true });
  const results = [];
  const normalize = (image) => image.resize({ width: 32, height: 32 });
  const difference = (first, second) => {
    const a = normalize(first).toBitmap(),
      b = normalize(second).toBitmap();
    let sum = 0,
      count = 0;
    // Ignore the circular mask around Gmail's image; compare only its centre.
    for (let y = 8; y < 24; y++)
      for (let x = 8; x < 24; x++)
        for (let ch = 0; ch < 3; ch++) {
          const offset = (y * 32 + x) * 4 + ch;
          sum += Math.abs(a[offset] - b[offset]);
          count++;
        }
    return Math.round((sum / count) * 100) / 100;
  };
  for (const [index, account] of controller.snapshot().accounts.entries()) {
    const wc = electron.webContents
      .getAllWebContents()
      .find(
        (w) =>
          w.session.storagePath?.endsWith(account.id) &&
          w.getURL().startsWith("https://mail.google.com"),
      );
    if (!wc || wc.isLoadingMainFrame()) {
      results.push({ index, ready: false });
      continue;
    }
    const target = await wc.executeJavaScriptInIsolatedWorld(1002, [
      {
        code: `(()=>{
      const img=[...document.querySelectorAll('a[href^="https://accounts.google.com/SignOutOptions"] img,a[aria-label^="Google アカウント"] img,a[aria-label^="Google Account"] img')].find(i=>i.getClientRects().length>0&&getComputedStyle(i).visibility!=='hidden');
      if(!img||!img.complete||!img.naturalWidth)return null;
      const r=img.getBoundingClientRect();return {url:img.currentSrc||img.src,rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
    })()`,
      },
    ]);
    if (!target || target.rect.width > 256 || target.rect.height > 256) {
      results.push({ index, ready: false });
      continue;
    }
    const displayed = await wc.capturePage(target.rect, { stayHidden: true });
    fs.writeFileSync(
      path.join(directory, `header-${index}.png`),
      displayed.toPNG(),
    );
    const entry = {
      index,
      ready: true,
      currentError: account.avatar
        ? difference(
            displayed,
            electron.nativeImage.createFromDataURL(account.avatar),
          )
        : null,
    };
    for (const credentials of ["omit", "include"]) {
      try {
        const signal = AbortSignal.timeout(5000);
        const bytes = await fetchWebAvatar(
          target.url,
          controller.definition.avatarOrigins,
          (url) =>
            webAvatarResponse(signal, () =>
              electron.net.request({
                url,
                session: wc.session,
                credentials,
                redirect: "manual",
              }),
            ),
          signal,
        );
        const image = electron.nativeImage.createFromBuffer(bytes);
        fs.writeFileSync(
          path.join(directory, `${credentials}-${index}.png`),
          image.toPNG(),
        );
        entry[credentials] = {
          bytes: bytes.length,
          error: difference(displayed, image),
        };
      } catch {
        entry[credentials] = { failed: true };
      }
    }
    results.push(entry);
  }
  fs.writeFileSync(
    path.join(directory, "result.json"),
    JSON.stringify(results, null, 2),
  );
  return results;
};
