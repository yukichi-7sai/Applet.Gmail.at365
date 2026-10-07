const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  host = path.resolve(root, "../AppDock.at365");
const run = (args) =>
  execFileSync(process.execPath, args, { stdio: "inherit", windowsHide: true });
for (const config of ["tsconfig.json", "tsconfig.renderer.json"])
  run([
    path.join(host, "node_modules/typescript/bin/tsc"),
    "-p",
    path.join(root, config),
  ]);
run([
  path.join(host, "node_modules/vite/bin/vite.js"),
  "build",
  "--config",
  path.join(root, "vite.config.mjs"),
]);
if (process.argv.includes("--test"))
  run([
    "--test",
    ...fs
      .readdirSync(path.join(root, "tests"))
      .filter((f) => f.endsWith(".test.cjs"))
      .map((f) => path.join(root, "tests", f)),
  ]);
const target = path.join(root, "publish", "Applet.Gmail.at365");
fs.mkdirSync(target, { recursive: true });
for (const name of fs
  .readdirSync(path.join(root, "out"))
  .filter((f) => f.endsWith(".js")))
  fs.copyFileSync(path.join(root, "out", name), path.join(target, name));
fs.copyFileSync(
  path.join(root, "extension.json"),
  path.join(target, "extension.json"),
);
const webTarget = path.resolve(target, "web");
const relativeWeb = path.relative(root, webTarget);
if (
  path.isAbsolute(relativeWeb) ||
  relativeWeb.startsWith("..") ||
  relativeWeb !== path.join("publish", "Applet.Gmail.at365", "web")
)
  throw Error("Unexpected generated Web output path");
// This directory contains generated UI assets only, never settings or sessions.
fs.rmSync(webTarget, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist"), webTarget, {
  recursive: true,
});
for (const name of ["observer.js", "open-item.js"])
  fs.copyFileSync(path.join(root, "web", name), path.join(target, "web", name));
console.log("Published: " + target);
