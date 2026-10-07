import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  WebAccountUi,
  WebAccountSnapshot,
  WebAccount,
} from "../../AppDock.at365/src/shared/web-accounts";
import type { Arrival } from "../src/monitor";
import "./style.css";
declare global {
  interface Window {
    webAccounts: WebAccountUi;
  }
}
type Page = "inbox" | "arrivals" | "settings";
type MailData = { pending: number; arrivals: Arrival[] };
const mailData = (a?: WebAccount): MailData => {
  const data = a?.data as MailData | null;
  return data && Array.isArray(data.arrivals)
    ? data
    : { pending: 0, arrivals: [] };
};
const time = (value: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
function App() {
  const [snapshot, setSnapshot] = useState<WebAccountSnapshot>();
  const [page, setPage] = useState<Page>("inbox");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const viewport = useRef<HTMLElement>(null);
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
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      const r = element.getBoundingClientRect();
      void window.webAccounts
        .viewport(
          page === "inbox"
            ? {
                x: Math.round(r.x),
                y: Math.round(r.y),
                width: Math.max(1, Math.round(r.width)),
                height: Math.max(1, Math.round(r.height)),
              }
            : null,
        )
        .catch((e) => setError(String(e)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [page]);
  async function run(action: () => Promise<unknown>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const accounts = snapshot?.accounts ?? [];
  const pending = accounts.reduce((total, a) => total + mailData(a).pending, 0);
  const arrivals = accounts
    .filter((a) => scope === "all" || a.id === account?.id)
    .flatMap((a) =>
      mailData(a).arrivals.map((mail) => ({ ...mail, account: a })),
    )
    .sort((a, b) => b.detectedAt - a.detectedAt);
  const clear = () =>
    run(async () => {
      for (const a of accounts.filter(
        (a) => scope === "all" || a.id === account?.id,
      ))
        await window.webAccounts.acknowledge(a.id);
    });
  return (
    <>
      <header>
        <div className="brand">
          <span className="mark" aria-hidden="true">
            M
          </span>
          <div>
            <strong>Gmail</strong>
            <small>AppDock</small>
          </div>
        </div>
        <nav className="pages" aria-label="Gmailの画面">
          <button
            aria-pressed={page === "inbox"}
            onClick={() => setPage("inbox")}
          >
            受信トレイ
          </button>
          <button
            aria-pressed={page === "arrivals"}
            onClick={() => setPage("arrivals")}
          >
            新着一覧 {pending > 0 && <span className="badge">{pending}</span>}
          </button>
          <button
            aria-pressed={page === "settings"}
            onClick={() => setPage("settings")}
          >
            アカウント設定
          </button>
        </nav>
        <span className="header-note">Gmail Web</span>
      </header>
      <aside>
        <div className="section">
          <span>アカウント</span>
          <span>{accounts.length} / 10</span>
        </div>
        <nav className="accounts" aria-label="アカウント一覧">
          {accounts.map((a, i) => (
            <button
              className={"account " + (a.id === account?.id ? "selected" : "")}
              key={a.id}
              aria-pressed={a.id === account?.id}
              disabled={busy}
              onClick={() => void run(() => window.webAccounts.select(a.id))}
            >
              <span className="avatar" aria-hidden="true">
                {i + 1}
              </span>
              <span className="account-text">
                <strong>{a.name}</strong>
                <small title={a.error || a.status}>
                  {a.error
                    ? "読み込みエラー"
                    : a.loading
                      ? "読み込み中…"
                      : a.status}
                </small>
              </span>
              {a.attention && (
                <span
                  className="account-count"
                  aria-label={"新着 " + mailData(a).pending + " 件"}
                >
                  {mailData(a).pending || "●"}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          className="add"
          disabled={busy || accounts.length >= 10}
          onClick={() =>
            void run(async () => {
              await window.webAccounts.add();
              setPage("inbox");
            })
          }
        >
          ＋ アカウントを追加
        </button>
        <div className="sidebar-bottom">
          <span className="privacy-mark" aria-hidden="true">
            ◈
          </span>
          <strong>ログイン状態を個別に保存</strong>
          <p>
            Googleの画面でログインできます。画面を閉じても、受信トレイの監視は続きます。
          </p>
          <button className="text-button" onClick={() => setPage("settings")}>
            アカウントを管理 →
          </button>
        </div>
      </aside>
      <section className="toolbar" aria-label="操作と状態">
        {page === "inbox" ? (
          <>
            <div className="navigation">
              <button
                aria-label="戻る"
                disabled={busy || !account?.canGoBack}
                onClick={() =>
                  void run(() => window.webAccounts.navigate("back"))
                }
              >
                ←
              </button>
              <button
                aria-label="進む"
                disabled={busy || !account?.canGoForward}
                onClick={() =>
                  void run(() => window.webAccounts.navigate("forward"))
                }
              >
                →
              </button>
              <button
                aria-label="再読み込み"
                disabled={busy || !account}
                onClick={() =>
                  void run(() => window.webAccounts.navigate("reload"))
                }
              >
                ↻
              </button>
              <button
                disabled={busy || !account}
                onClick={() =>
                  void run(() => window.webAccounts.navigate("inbox"))
                }
              >
                受信トレイへ
              </button>
              <input
                aria-label="現在のページURL"
                readOnly
                value={account?.url ?? ""}
              />
              <button
                className="clear"
                disabled={busy || !account?.attention}
                onClick={() =>
                  void run(() => window.webAccounts.acknowledge(account!.id))
                }
              >
                新着表示をクリア
              </button>
            </div>
            <div
              className={"status " + (error || account?.error ? "error" : "")}
              role="status"
            >
              <span
                className={
                  "status-dot " + (account?.attention ? "attention" : "")
                }
              />
              {error ||
                account?.error ||
                (account?.loading
                  ? "Googleのページを読み込んでいます…"
                  : account?.status || "Googleの画面でログインしてください。")}
            </div>
          </>
        ) : (
          <div className="page-heading">
            <div>
              <h1>{page === "arrivals" ? "新着一覧" : "アカウント設定"}</h1>
              <p>
                {page === "arrivals"
                  ? "受信トレイの更新から検知した新着を、まとめて確認できます。"
                  : "表示名と保存済みのログイン領域を管理します。"}
              </p>
            </div>
            {page === "arrivals" && (
              <button disabled={busy || !pending} onClick={() => void clear()}>
                新着表示をクリア
              </button>
            )}
          </div>
        )}
      </section>
      <main
        ref={viewport}
        className={page === "inbox" ? "web-viewport" : "content"}
        aria-label={
          page === "inbox"
            ? "Gmail表示領域"
            : page === "arrivals"
              ? "新着の履歴"
              : "アカウント管理"
        }
      >
        {page === "inbox" ? (
          <div className="empty">
            <span className="empty-icon">M</span>
            <p>Gmailを読み込んでいます…</p>
          </div>
        ) : (
          <div className="page-content">
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            {page === "arrivals" ? (
              <>
                <div className="list-summary">
                  <div className="filters" aria-label="新着の表示範囲">
                    <button
                      aria-pressed={scope === "all"}
                      onClick={() => setScope("all")}
                    >
                      すべてのアカウント
                    </button>
                    <button
                      aria-pressed={scope === "selected"}
                      onClick={() => setScope("selected")}
                    >
                      {account?.name || "選択中"}
                    </button>
                  </div>
                  <span>{arrivals.length} 件の履歴</span>
                </div>
                <p className="list-note">
                  件数は検知したスレッドの更新数です。履歴は起動中だけ、各アカウントの最大50件を保持します。
                </p>
                {arrivals.length === 0 ? (
                  <div className="empty history-empty">
                    <span className="empty-icon" aria-hidden="true">
                      ✉
                    </span>
                    <h2>新着を待っています</h2>
                    <p>
                      受信トレイを表示している間の新着が、ここに並びます。
                      <br />
                      初回表示や再読み込み時の既存メールは追加しません。
                    </p>
                    <button onClick={() => setPage("inbox")}>
                      受信トレイを開く
                    </button>
                  </div>
                ) : (
                  <ol className="arrival-list">
                    {arrivals.map((mail) => (
                      <li
                        key={mail.account.id + ":" + mail.key}
                        className={mail.acknowledged ? "acknowledged" : "new"}
                      >
                        <div className="arrival-meta">
                          <span className="account-tag">
                            {mail.account.name}
                          </span>
                          {!mail.acknowledged && (
                            <span className="new-label">新着</span>
                          )}
                          <time
                            dateTime={new Date(mail.detectedAt).toISOString()}
                          >
                            {time(mail.detectedAt)}
                          </time>
                        </div>
                        <div className="arrival-body">
                          <div>
                            <strong className="sender">
                              {mail.sender || "送信元を取得できません"}
                            </strong>
                            <h2>{mail.subject || "件名を取得できません"}</h2>
                          </div>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await window.webAccounts.select(
                                  mail.account.id,
                                );
                                await window.webAccounts.navigate("inbox");
                                setPage("inbox");
                              })
                            }
                          >
                            受信トレイへ →
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <>
                <section className="settings-card">
                  <div className="card-heading">
                    <span className="avatar large" aria-hidden="true">
                      {accounts.findIndex((a) => a.id === account?.id) + 1}
                    </span>
                    <div>
                      <h2>{account?.name}</h2>
                      <p>{account?.error || account?.status}</p>
                    </div>
                  </div>
                  <label htmlFor="account-name">このアカウントの表示名</label>
                  <div className="name-edit">
                    <input
                      id="account-name"
                      value={name}
                      maxLength={60}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !account ||
                        !name.trim() ||
                        name.trim() === account.name
                      }
                      onClick={() =>
                        void run(() =>
                          window.webAccounts.rename(account!.id, name),
                        )
                      }
                    >
                      名前を保存
                    </button>
                  </div>
                  <p className="hint">
                    一覧や通知に表示する名前です。Googleアカウントの名前は変更しません。
                  </p>
                  <div className="settings-row">
                    <div>
                      <h3>保存したアカウントを削除</h3>
                      <p>
                        この枠のログイン状態とサイトデータを削除します。
                        <br />
                        Googleアカウントとメールはそのまま残ります。
                      </p>
                    </div>
                    <button
                      className="delete"
                      disabled={busy || !account || accounts.length < 2}
                      onClick={() =>
                        void run(() => window.webAccounts.remove(account!.id))
                      }
                    >
                      保存したアカウントを削除
                    </button>
                  </div>
                  {accounts.length < 2 && (
                    <p className="hint">
                      最後の枠は残します。ログアウトはGmail画面から操作してください。
                    </p>
                  )}
                </section>
                <section className="settings-card">
                  <h2>監視と通知</h2>
                  <p>
                    新着の監視・通知・通知に件名を表示する設定は、AppDockの「設定
                    → Gmail」で変更できます。
                  </p>
                  <div className="info-grid">
                    <div>
                      <h3>新着一覧の扱い</h3>
                      <p>
                        送信元と件名を画面から読み取ります。本文は取得しません。履歴はファイルに保存せず、Applet停止時に消去します。
                      </p>
                    </div>
                    <div>
                      <h3>通知のプライバシー</h3>
                      <p>
                        初期設定では新着の検知件数だけを通知します。件名の表示は、設定で有効にした場合に限ります。
                      </p>
                    </div>
                  </div>
                </section>
                <section className="settings-help">
                  <h3>監視が止まっているとき</h3>
                  <p>
                    受信トレイの先頭ページを表示してください。別フォルダーやメール本文を開いている間は、そのアカウントの監視を休止します。ログインが必要な場合はGoogleの案内に従って操作できます。
                  </p>
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
