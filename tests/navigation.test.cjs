const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const manifest = require("../extension.json");
const { allowedWebNavigation } = require(
  path.resolve(
    __dirname,
    "../../AppDock.at365/out/main/main/core/web-accounts",
  ),
);
test("Gmail allows the Google sign-in chain through accounts.youtube.com", () => {
  const origins = manifest.webAccounts.origins;
  for (const url of [
    "https://accounts.google.com/fixture-login",
    "https://accounts.google.co.jp/fixture-localized",
    "https://accounts.youtube.com/fixture-check?continue=https%3A%2F%2Fmail.google.com",
    "https://accounts.google.com/fixture-return",
    "https://mail.google.com/mail/u/0/#inbox",
    "https://workspace.google.com/intl/ja/gmail/",
  ])
    assert.equal(allowedWebNavigation(url, origins), true);
  assert.equal(manifest.webAccounts.observeOrigin, "https://mail.google.com");
  for (const url of [
    "https://www.youtube.com/watch?v=fixture",
    "https://accounts.youtube.com.evil.test/",
    "https://evil.test/?next=accounts.youtube.com",
    "http://accounts.youtube.com/",
    "https://accounts.youtube.com:8443/",
    "https://user:password@accounts.youtube.com/",
    "https://workspace.google.com.evil.test/",
    "http://workspace.google.com/",
    "https://user:password@workspace.google.com/",
    "https://accounts.google.co.jp.evil.test/",
    "http://accounts.google.co.jp/",
    "https://user:password@accounts.google.co.jp/",
    "https://accounts.google.co.jp:8443/",
  ])
    assert.equal(allowedWebNavigation(url, origins), false);
});
