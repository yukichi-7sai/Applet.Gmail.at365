const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const host = path.resolve(root, "../AppDock.at365");
const profile = path.join(root, ".artifacts", "gmail-dev");
const webRoot = path.join(profile, ".appdock/web-accounts/at365.gmail");
fs.mkdirSync(profile, { recursive: true });
fs.cpSync(
  path.join(root, "publish/Applet.Gmail.at365"),
  path.join(profile, "extensions/Applet.Gmail.at365"),
  { recursive: true },
);
const settingsFile = path.join(profile, "settings.json");
const firstLaunch = !fs.existsSync(settingsFile);
const { SettingsStore } = require(
  path.join(host, "out/main/main/core/settings"),
);
const store = new SettingsStore(settingsFile);
const savedSettings = store.load();
const settings = savedSettings.value;
if (firstLaunch) {
  settings.extensions["at365.gmail"] = {
    enabled: true,
    settings: { notifications: true },
  };
}
// This profile is dedicated to Gmail testing; honor the requested software rendering.
if (firstLaunch || settings.host.hardwareAcceleration !== false) {
  settings.host.hardwareAcceleration = false;
  store.save(settings, savedSettings.revision);
}
// Explicit opt-in, development-only import. The source stays intact. Stop the old
// test app first; never merge live Chromium databases or overwrite existing accounts.
if (
  process.argv.includes("--import-test-profile") &&
  !fs.existsSync(path.join(webRoot, "accounts.json"))
) {
  const source = path.resolve(
    root,
    "../Applet.GmailChecker.at365/artifacts/gmail-web-test",
  );
  const file = path.join(source, "accounts.json");
  if (!fs.existsSync(file)) throw Error("Existing test profile was not found");
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    !Array.isArray(saved.accounts) ||
    !saved.accounts.length ||
    saved.accounts.some((a) => !/^[a-f0-9-]{36}$/.test(a.id))
  )
    throw Error("Invalid test profile");
  for (const a of saved.accounts) {
    const partition = path.join(
      source,
      "chromium/Partitions",
      "at365-gmail-web-" + a.id,
    );
    if (!fs.existsSync(partition))
      throw Error("Test account partition is missing");
    fs.cpSync(partition, path.join(webRoot, "sessions", a.id), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
  // Chromium cookie encryption may depend on userData's Local State on Windows.
  const localState = path.join(source, "chromium/Local State");
  if (fs.existsSync(localState)) {
    const destination = path.join(profile, ".appdock/chromium/Local State");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(localState, destination, fs.constants.COPYFILE_EXCL);
  }
  fs.copyFileSync(
    file,
    path.join(webRoot, "accounts.json"),
    fs.constants.COPYFILE_EXCL,
  );
  console.log("Imported test login profile locally; original retained.");
}
console.log("Development profile: " + profile);
