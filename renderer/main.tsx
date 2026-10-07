import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  WebAccountUi,
  WebAccountSnapshot,
} from "../../AppDock.at365/src/shared/web-accounts";
import "./style.css";
declare global {
  interface Window {
    webAccounts: WebAccountUi;
  }
}
function App() {
  const [snapshot, setSnapshot] = useState<WebAccountSnapshot>();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    window.webAccounts
      .snapshot()
      .then(setSnapshot)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
    return window.webAccounts.onChanged(() => void load());
  }, []);
  const account = snapshot?.accounts.find((a) => a.id === snapshot.selected);
  useEffect(() => setName(account?.name ?? ""), [account?.id, account?.name]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <div className="brand">
          <span className="mark">M</span>
          <div>
            <strong>Gmail</strong>
            <small>受信トレイ</small>
          </div>
        </div>
        <div className="intro">
          Googleの画面で、そのままログインして使えます。
          <span>
            アカウントごとにログイン状態を保存し、受信トレイの新着をお知らせします
          </span>
        </div>
      </header>
      <aside>
        <div className="section">アカウント</div>
        <nav>
          {snapshot?.accounts.map((a, i) => (
            <button
              className={
                "account " + (a.id === snapshot.selected ? "selected" : "")
              }
              key={a.id}
              aria-pressed={a.id === snapshot.selected}
              disabled={busy}
              onClick={() => void run(() => window.webAccounts.select(a.id))}
            >
              <span className="avatar">{i + 1}</span>
              <span>
                {a.name}
                {a.attention ? " ● 新着" : ""}
              </span>
            </button>
          ))}
        </nav>
        <button
          className="add"
          disabled={busy}
          onClick={() => void run(() => window.webAccounts.add())}
        >
          ＋ アカウントを追加
        </button>
        <button
          disabled={busy || !account}
          onClick={() =>
            void run(() => window.webAccounts.acknowledge(account!.id))
          }
        >
          新着表示をクリア
        </button>
        <div className="account-settings">
          <label htmlFor="account-name">このアカウントの表示名</label>
          <input
            id="account-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={busy || !account || !name.trim()}
            onClick={() =>
              void run(() => window.webAccounts.rename(account!.id, name))
            }
          >
            名前を保存
          </button>
          <button
            className="delete"
            disabled={busy || !account || snapshot!.accounts.length < 2}
            onClick={() =>
              void run(() => window.webAccounts.remove(account!.id))
            }
          >
            保存したアカウントを削除
          </button>
        </div>
        <div className="note">
          各アカウントは別のブラウザー領域です。ログイン状態は終了後も保存されます。
          <br />
          <br />
          ログインできない場合は、Googleの画面に表示された案内を確認してください。
        </div>
        <div className="profile">
          アカウント別のログイン保存
          <br />
          Gmail Web
        </div>
      </aside>
      <section className="toolbar">
        <div className="navigation">
          <button
            aria-label="戻る"
            disabled={!account?.canGoBack}
            onClick={() => void run(() => window.webAccounts.navigate("back"))}
          >
            ←
          </button>
          <button
            aria-label="進む"
            disabled={!account?.canGoForward}
            onClick={() =>
              void run(() => window.webAccounts.navigate("forward"))
            }
          >
            →
          </button>
          <button
            aria-label="再読み込み"
            onClick={() =>
              void run(() => window.webAccounts.navigate("reload"))
            }
          >
            ↻
          </button>
          <button
            className="inbox"
            onClick={() => void run(() => window.webAccounts.navigate("inbox"))}
          >
            受信トレイ
          </button>
          <input
            aria-label="現在のページURL"
            readOnly
            value={account?.url ?? ""}
          />
        </div>
        <div
          className={"status " + (error || account?.error ? "error" : "")}
          role="status"
        >
          {error ||
            account?.error ||
            (account?.loading
              ? "Googleのページを読み込んでいます…"
              : account?.status || "Googleの画面でログインしてください。")}
        </div>
      </section>
      <main aria-label="Gmail表示領域">
        <p>Gmailの表示を準備しています…</p>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
