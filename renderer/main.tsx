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
type Page = "inbox" | "arrivals" | "settings" | "preferences";
const preferences = [
  {
    key: "monitoring",
    title: "新着の監視",
    fallback: true,
    description:
      "すべてのアカウントの新着を監視します。OFFにすると新着履歴・件数を消去し、通知と音を止めます。ONへ戻すと、監視中のアカウントの未読を取り込み直します。",
  },
  {
    key: "notifications",
    title: "新着通知",
    fallback: true,
    description:
      "未読の新着をデスクトップ通知でお知らせします。AppDock本体とWindowsの通知設定も適用されます。アカウントごとの通知音は独立しています。",
  },
  {
    key: "notificationDetails",
    title: "通知に送信元と件名を表示",
    fallback: false,
    description:
      "ONにすると通知に送信元と件名を表示します。OFFでは新着の件数だけを表示します。",
  },
];
type MailData = { pending: number; arrivals: Arrival[]; monitoring?: boolean };
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
function Avatar({
  account,
  large = false,
}: {
  account?: WebAccount;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [account?.avatar]);
  return (
    <span className={"avatar" + (large ? " large" : "")} aria-hidden="true">
      {account?.avatar && !failed ? (
        <img src={account.avatar} alt="" onError={() => setFailed(true)} />
      ) : (
        Array.from(account?.name.trim() || "G")[0].toLocaleUpperCase("ja-JP")
      )}
    </span>
  );
}
function App() {
  const [snapshot, setSnapshot] = useState<WebAccountSnapshot>();
  const [page, setPage] = useState<Page>("inbox");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [preferenceValues, setPreferenceValues] = useState<
    Record<string, boolean | string>
  >({});
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
  useEffect(
    () => setPreferenceValues(snapshot?.settings ?? {}),
    [
      snapshot?.settings?.monitoring,
      snapshot?.settings?.notifications,
      snapshot?.settings?.notificationDetails,
      snapshot?.settings?.historyLimit,
    ],
  );
  const setPreference = (key: string, value: boolean | string) => {
    if (working.current) return;
    const previous = preferenceValues;
    setPreferenceValues({ ...previous, [key]: value });
    void run(() =>
      window.webAccounts.setSetting(key, value).catch((error) => {
        setPreferenceValues(previous);
        throw error;
      }),
    );
  };
  useEffect(() => {
    document.documentElement.dataset.theme =
      snapshot?.dark === false ? "light" : "dark";
  }, [snapshot?.dark]);
  useEffect(() => setName(account?.name ?? ""), [account?.id, account?.name]);
  useEffect(() => setNotice(""), [account?.id]);
  useEffect(
    () => setMonitoringEnabled(account?.monitoring !== false),
    [account?.id, account?.monitoring],
  );
  useEffect(
    () => setSoundEnabled(account?.sound.enabled ?? false),
    [account?.id, account?.sound.enabled],
  );
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
    setNotice("");
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
  const search = query.trim().normalize("NFKC").toLocaleLowerCase("ja-JP");
  const shown = arrivals.filter(
    (mail) =>
      (!unreadOnly || mail.unread === true) &&
      (!search ||
        [mail.sender, mail.subject, mail.account.name].some((text) =>
          text.normalize("NFKC").toLocaleLowerCase("ja-JP").includes(search),
        )),
  );
  const scopePending = accounts
    .filter((a) => scope === "all" || a.id === account?.id)
    .reduce((total, a) => total + mailData(a).pending, 0);
  const openMail = (id: string, key: string) =>
    run(async () => {
      await window.webAccounts.select(id);
      let opened = await window.webAccounts.openItem(id, key);
      if (!opened) {
        const currentSnapshot = await window.webAccounts.snapshot();
        if (currentSnapshot.selected !== id) return;
        const current = currentSnapshot.accounts.find((a) => a.id === id);
        const atInbox = current?.url.endsWith("#inbox");
        setPage("inbox");
        // A settled inbox has already answered "not found". Reloading it
        // cannot open a deleted row and needlessly adds network latency.
        if (!atInbox) await window.webAccounts.navigate("inbox");
        if (
          atInbox &&
          !current?.loading &&
          (current?.observation as { ready?: boolean } | null)?.ready
        ) {
          setNotice(
            "対象のメールが現在の受信トレイに見つからないため、受信トレイを開きました。",
          );
          return;
        }
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const currentSnapshot = await window.webAccounts.snapshot();
          if (currentSnapshot.selected !== id) return;
          const current = currentSnapshot.accounts.find((a) => a.id === id);
          if (
            current?.observation &&
            (current.observation as { ready?: boolean }).ready &&
            !current.loading
          ) {
            opened = await window.webAccounts.openItem(id, key);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      if ((await window.webAccounts.snapshot()).selected !== id) return;
      setPage("inbox");
      if (!opened)
        setNotice(
          "対象のメールが現在の受信トレイに見つからないため、受信トレイを開きました。",
        );
    });
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
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="m4 7 8 6 8-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
          <button
            aria-pressed={page === "preferences"}
            onClick={() => setPage("preferences")}
          >
            設定
          </button>
        </nav>
        <span className="header-note">{accounts.length} アカウント</span>
      </header>
      <aside>
        <div className="section">
          <span>アカウント</span>
          <span>{accounts.length} / 10</span>
        </div>
        <div className="account-switcher">
          <button
            aria-label="前のアカウント"
            title="前のアカウント（初期設定: Ctrl+Shift+Tab）"
            disabled={busy || accounts.length < 2}
            onClick={() => void run(() => window.webAccounts.cycle(-1))}
          >
            ←
          </button>
          <span>アカウント切替</span>
          <button
            aria-label="次のアカウント"
            title="次のアカウント（初期設定: Ctrl+Tab）"
            disabled={busy || accounts.length < 2}
            onClick={() => void run(() => window.webAccounts.cycle(1))}
          >
            →
          </button>
        </div>
        <nav className="accounts" aria-label="アカウント一覧">
          {accounts.map((a) => (
            <button
              className={"account " + (a.id === account?.id ? "selected" : "")}
              key={a.id}
              aria-pressed={a.id === account?.id}
              disabled={busy}
              onClick={() => void run(() => window.webAccounts.select(a.id))}
            >
              <Avatar account={a} />
              <span className="account-text">
                <strong>{a.name}</strong>
                <small title={a.error || a.status}>
                  {a.monitoring === false
                    ? "監視OFF"
                    : a.error
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
        {page === "settings" && (
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
        )}
        {page === "settings" && accounts.length >= 10 && (
          <p className="account-limit">10アカウントまで追加できます。</p>
        )}
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
                notice ||
                account?.error ||
                (account?.loading
                  ? "Googleのページを読み込んでいます…"
                  : account?.status || "Googleの画面でログインしてください。")}
            </div>
          </>
        ) : (
          <div className="page-heading">
            <div>
              <h1>
                {page === "arrivals"
                  ? "新着一覧"
                  : page === "preferences"
                    ? "設定"
                    : "アカウント設定"}
              </h1>
              <p>
                {page === "arrivals"
                  ? "受信トレイの更新から検知した新着を、まとめて確認できます。"
                  : page === "preferences"
                    ? "Gmail全体の新着監視と通知を設定します。"
                    : "順番・表示名・新着の監視と通知音を管理します。"}
              </p>
            </div>
            {page === "arrivals" && (
              <button
                disabled={busy || !scopePending}
                onClick={() => void clear()}
              >
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
              : page === "preferences"
                ? "Gmail全体の設定"
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
            {page === "preferences" ? (
              <section className="settings-card preferences-card">
                <h2>新着の監視と通知</h2>
                <p>
                  すべてのアカウントに共通の設定です。変更はその場で保存され、AppDockの「設定
                  → Gmail」と連動します。
                </p>
                {preferences.map((preference) => (
                  <div className="preference-row" key={preference.key}>
                    <label className="sound-toggle">
                      <input
                        type="checkbox"
                        aria-label={preference.title}
                        disabled={busy || !snapshot?.settings}
                        checked={
                          (preferenceValues[preference.key] ??
                            preference.fallback) === true
                        }
                        onChange={(e) =>
                          setPreference(preference.key, e.currentTarget.checked)
                        }
                      />
                      {preference.title}
                    </label>
                    <p>{preference.description}</p>
                  </div>
                ))}
                <div className="preference-row">
                  <label className="history-limit">
                    <span>新着履歴の保存件数</span>
                    <select
                      aria-label="新着履歴の保存件数"
                      disabled={busy || !snapshot?.settings}
                      value={Number(preferenceValues.historyLimit ?? 50)}
                      onChange={(e) =>
                        setPreference("historyLimit", e.currentTarget.value)
                      }
                    >
                      {[10, 20, 30, 40, 50].map((limit) => (
                        <option key={limit} value={limit}>
                          {limit} 件 / アカウント
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    各アカウントの新しい履歴を、この件数まで残します。件数を減らすと古い履歴は消え、増やしても元には戻りません。未読件数の集計は変わりません。履歴はアプリの起動中だけ保持します。
                  </p>
                </div>
                <p className="hint">
                  アカウントごとの監視と通知音は「アカウント設定」で変更できます。
                </p>
              </section>
            ) : page === "arrivals" ? (
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
                  <span>{scopePending} 件の未読新着</span>
                </div>
                <div className="list-controls">
                  <label className="unread-filter">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                    />
                    未読だけ
                  </label>
                  <div className="history-search">
                    <input
                      type="search"
                      aria-label="新着履歴を検索"
                      placeholder="送信元・件名・アカウント名で検索"
                      value={query}
                      maxLength={200}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        aria-label="検索をクリア"
                        onClick={() => setQuery("")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <span className="history-count" role="status">
                    {shown.length} / {arrivals.length} 件の履歴
                  </span>
                </div>
                <p className="list-note">
                  件数は未読の新着スレッド数です。起動時の未読も含みます。履歴は各アカウントの最大
                  {Number(snapshot?.settings?.historyLimit ?? 50)}
                  件を保持します。
                </p>
                {shown.length === 0 ? (
                  <div className="empty history-empty">
                    <span className="empty-icon" aria-hidden="true">
                      ✉
                    </span>
                    <h2>
                      {arrivals.length
                        ? "一致する履歴はありません"
                        : "新着を待っています"}
                    </h2>
                    <p>
                      {arrivals.length ? (
                        "検索条件や未読の絞り込みを変更してください。"
                      ) : (
                        <>
                          受信トレイを表示している間の新着が、ここに並びます。
                          <br />
                          起動時に確認できた未読も新着として取り込みます。
                        </>
                      )}
                    </p>
                    {arrivals.length > 0 && (
                      <button
                        onClick={() => {
                          setQuery("");
                          setUnreadOnly(false);
                        }}
                      >
                        絞り込みを解除
                      </button>
                    )}
                    <button onClick={() => setPage("inbox")}>
                      受信トレイを開く
                    </button>
                  </div>
                ) : (
                  <ol className="arrival-list">
                    {shown.map((mail) => (
                      <li
                        key={mail.account.id + ":" + mail.key}
                        className={
                          !mail.acknowledged && mail.unread === true
                            ? "new"
                            : "acknowledged"
                        }
                      >
                        <div className="arrival-meta">
                          <span className="account-tag">
                            {mail.account.name}
                          </span>
                          {!mail.acknowledged && mail.unread === true && (
                            <span className="new-label">新着</span>
                          )}
                          <span
                            className={
                              "read-state " +
                              (mail.unread === true ? "unread" : "")
                            }
                          >
                            {mail.unread === true
                              ? "未読"
                              : mail.unread === false
                                ? "既読"
                                : "状態未確認"}
                          </span>
                          {mail.initial && (
                            <span className="initial-label">起動時の未読</span>
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
                              void openMail(mail.account.id, mail.key)
                            }
                          >
                            メールを開く →
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <>
                <section className="settings-card account-order">
                  <h2>アカウントの順番</h2>
                  <p>
                    上下のボタンで並べ替えます。一覧と切替キーに同じ順番が反映されます。
                  </p>
                  <ol className="order-list">
                    {accounts.map((a, i) => (
                      <li
                        key={a.id}
                        className={a.id === account?.id ? "current" : ""}
                      >
                        <button
                          className="order-account"
                          disabled={busy}
                          aria-pressed={a.id === account?.id}
                          onClick={() =>
                            void run(() => window.webAccounts.select(a.id))
                          }
                        >
                          <Avatar account={a} />
                          <span>
                            <strong>{a.name}</strong>
                            <small>
                              {a.monitoring === false ? "監視OFF" : "監視ON"}
                            </small>
                          </span>
                        </button>
                        <div className="order-actions">
                          <button
                            disabled={busy || i === 0}
                            aria-label={a.name + "を上へ移動"}
                            title="上へ移動"
                            onClick={() =>
                              void run(() => window.webAccounts.move(a.id, -1))
                            }
                          >
                            ↑
                          </button>
                          <button
                            disabled={busy || i === accounts.length - 1}
                            aria-label={a.name + "を下へ移動"}
                            title="下へ移動"
                            onClick={() =>
                              void run(() => window.webAccounts.move(a.id, 1))
                            }
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                <section className="settings-card">
                  <div className="card-heading">
                    <Avatar account={account} large />
                    <div>
                      <h2>{account?.name}</h2>
                      <p>{account?.error || account?.status}</p>
                    </div>
                  </div>
                  <label htmlFor="account-name">このアカウントの表示名</label>
                  <form
                    className="name-edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (
                        account &&
                        name.trim() &&
                        name.trim() !== account.name
                      )
                        void run(() =>
                          window.webAccounts.rename(account.id, name),
                        );
                    }}
                  >
                    <input
                      id="account-name"
                      value={name}
                      maxLength={60}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="primary"
                      disabled={
                        busy ||
                        !account ||
                        !name.trim() ||
                        name.trim() === account.name
                      }
                    >
                      名前を保存
                    </button>
                    {account && name !== account.name && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setName(account.name)}
                      >
                        元に戻す
                      </button>
                    )}
                  </form>
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
                  <h2>このアカウントの新着監視</h2>
                  <label className="sound-toggle">
                    <input
                      type="checkbox"
                      aria-label="このアカウントの新着を監視する"
                      disabled={busy || !account}
                      checked={monitoringEnabled}
                      onChange={(e) => {
                        const enabled = e.currentTarget.checked;
                        setMonitoringEnabled(enabled);
                        void run(() =>
                          window.webAccounts
                            .setMonitoring(account!.id, enabled)
                            .catch((error) => {
                              setMonitoringEnabled(
                                account!.monitoring !== false,
                              );
                              throw error;
                            }),
                        );
                      }}
                    />
                    このアカウントの新着を監視する
                    <span className="monitor-pill">
                      {account?.monitoring === false ? "OFF" : "ON"}
                    </span>
                  </label>
                  <p>
                    OFFにすると、このアカウントの新着履歴・件数を消去し、通知と音を止めます。ログイン状態は保持し、Gmailは引き続き操作できます。ONへ戻すと、確認できる未読を新着として取り込み直します。
                  </p>
                  {account?.monitoring !== false &&
                    mailData(account).monitoring === false && (
                      <p className="monitor-note" role="status">
                        「設定」タブで全体の新着監視がOFFになっています。
                      </p>
                    )}
                  <button
                    className="inbox-setting"
                    disabled={busy || !account}
                    onClick={() =>
                      void run(async () => {
                        await window.webAccounts.navigate("inbox");
                        setPage("inbox");
                      })
                    }
                  >
                    このアカウントの受信トレイを開く →
                  </button>
                </section>
                <section className="settings-card">
                  <h2>このアカウントの通知音</h2>
                  <p>
                    未読の新着を検知したときの音です。Windowsの通知設定やAppDockの新着通知がOFFでも、ここでONにすると鳴ります。
                  </p>
                  <label className="sound-toggle">
                    <input
                      type="checkbox"
                      aria-label="このアカウントの通知音を鳴らす"
                      disabled={busy || !account}
                      checked={soundEnabled}
                      onChange={(e) => {
                        const enabled = e.currentTarget.checked;
                        setSoundEnabled(enabled);
                        void run(async () => {
                          try {
                            await window.webAccounts.setSound(account!.id, {
                              ...account!.sound,
                              enabled,
                            });
                          } catch (error) {
                            setSoundEnabled(account!.sound.enabled);
                            throw error;
                          }
                        });
                      }}
                    />
                    このアカウントの通知音を鳴らす
                  </label>
                  <div className="sound-file">
                    <span title={account?.sound.file || "標準のビープ音"}>
                      {account?.sound.file
                        ? account.sound.name ||
                          account.sound.file.split(/[\\/]/).at(-1)
                        : "標準のビープ音"}
                    </span>
                    <button
                      disabled={busy || !account}
                      onClick={() =>
                        void run(() =>
                          window.webAccounts.pickSound(account!.id),
                        )
                      }
                    >
                      WAVを選択
                    </button>
                    <button
                      disabled={busy || !account?.sound.file}
                      onClick={() =>
                        void run(() =>
                          window.webAccounts.setSound(account!.id, {
                            ...account!.sound,
                            file: "",
                          }),
                        )
                      }
                    >
                      標準音に戻す
                    </button>
                    <button
                      disabled={busy || !account}
                      onClick={() =>
                        void run(() =>
                          window.webAccounts.testSound(account!.id),
                        )
                      }
                    >
                      試聴
                    </button>
                  </div>
                  <p className="hint">
                    通知音はAppDockの保存領域へコピーします。元のWAVを移動・削除しても利用できます。試聴は通知音がOFFでも再生できます。
                  </p>
                  {account?.soundError && (
                    <p className="error-banner" role="alert">
                      {account.soundError}
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
