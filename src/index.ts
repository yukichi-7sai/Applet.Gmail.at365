import { InboxMonitor } from "./monitor";
interface Account {
  id: string;
  name: string;
  observation: unknown;
  error: string;
  monitoring?: boolean;
  enabled?: boolean;
  sound?: { enabled: boolean; file: string };
}
interface Context {
  ribbon: {
    setBadge(
      target: { pageId: string },
      badge: { kind: "count"; count: number; label: string } | null,
    ): Promise<unknown>;
  };
  commands: {
    register(id: string, title: string, handler: () => unknown): void;
  };
  webAccounts: {
    start(): Promise<unknown>;
    open(): Promise<unknown>;
    cycle(direction: 1 | -1): Promise<unknown>;
    navigate(action: "back" | "forward" | "reload" | "inbox"): Promise<unknown>;
    read(): Promise<{
      accounts: Account[];
      acknowledged: string[];
      monitoringResets?: string[];
    }>;
    report(
      id: string,
      status: string,
      attention: boolean,
      data?: unknown,
    ): Promise<unknown>;
  };
  tray: {
    add(title: string, command: string): void;
    attention(value: boolean): Promise<unknown>;
  };
  notifications: {
    publish(request: {
      typeId: string;
      title: string;
      body: string;
      silent: boolean;
      historyText: { title: string; body: string };
      actions: {
        key: string;
        label: string;
        command: string;
        primary: boolean;
      }[];
    }): Promise<
      | { status: "accepted"; notificationId: string }
      | { status: "suppressed"; reason: string }
    >;
    end(id: string, status: "resolved" | "withdrawn"): Promise<unknown>;
  };
  audio: { play(file?: string): Promise<unknown> };
  ui: { showPanel(panel: unknown): Promise<unknown> };
  settings: {
    get<T>(key: string, fallback: T): T;
    onChanged(handler: () => unknown): () => void;
  };
  scheduler: { every(ms: number, handler: () => unknown): () => void };
  log: { error(message: string): Promise<unknown> };
}
const ID = "at365.gmail";
const monitors = new Map<string, InboxMonitor>();
const notices = new Map<string, string>();
let latestAccounts: Account[] = [];
let badgeChain = Promise.resolve();
let lastBadgeCount: number | undefined;
let badgeFailure = false;
function updateBadge() {
  badgeChain = badgeChain.then(async () => {
    if (!active) return;
    const count = context.settings.get("monitoring", true)
      ? latestAccounts
          .filter(
            (account) =>
              account.enabled !== false && account.monitoring !== false,
          )
          .reduce(
            (sum, account) => sum + (monitors.get(account.id)?.pending ?? 0),
            0,
          )
      : 0;
    if (count === lastBadgeCount) return;
    try {
      await context.ribbon.setBadge(
        { pageId: "gmail" },
        count ? { kind: "count", count, label: "未読の新着スレッド" } : null,
      );
      lastBadgeCount = count;
      badgeFailure = false;
    } catch {
      if (!badgeFailure) {
        badgeFailure = true;
        await context.log
          .error(
            "Gmailのリボンバッジを更新できませんでした。次の定期更新で再確認します。",
          )
          .catch(() => {});
      }
    }
  });
  return badgeChain;
}
async function endNotice(accountId: string, status: "resolved" | "withdrawn") {
  const id = notices.get(accountId);
  if (!id) return;
  notices.delete(accountId);
  // The host may already have expired/dismissed the notification.
  await context.notifications.end(id, status).catch(() => {});
}
let context: Context,
  active = false,
  busy = false,
  lastPanel = "",
  cancel: (() => void) | undefined;
async function panel(accounts: Account[]) {
  const value = {
    title: "Gmail",
    description:
      "GmailのWeb画面をアカウントごとに表示し、受信トレイの更新を監視します。",
    facts: accounts.map((a) => ({
      label: a.name,
      value: !context.settings.get("monitoring", true)
        ? "全体の新着監視はOFFです"
        : a.monitoring === false
          ? "このアカウントの監視はOFFです"
          : a.error || monitors.get(a.id)?.status || "ログインを待っています",
    })),
    actions: [
      { title: "Gmailを開く", command: ID + ".open" },
      { title: "新着表示をクリア", command: ID + ".acknowledge" },
    ],
  };
  const json = JSON.stringify(value);
  if (json !== lastPanel) {
    await context.ui.showPanel(value);
    lastPanel = json;
  }
}
async function tick() {
  if (!active || busy) return;
  busy = true;
  try {
    const data = await context.webAccounts.read();
    if (!active) return;
    latestAccounts = data.accounts;
    for (const id of monitors.keys())
      if (!data.accounts.some((a) => a.id === id)) {
        monitors.delete(id);
        await endNotice(id, "withdrawn");
      }
    const enabled = context.settings.get("monitoring", true);
    for (const a of data.accounts) {
      let monitor = monitors.get(a.id);
      if (!monitor) {
        monitor = new InboxMonitor();
        monitors.set(a.id, monitor);
      }
      if (data.acknowledged.includes(a.id)) {
        monitor.acknowledge();
        await endNotice(a.id, "resolved");
      }
      monitor.setHistoryLimit(
        Number(context.settings.get("historyLimit", "50")),
      );
      if (data.monitoringResets?.includes(a.id)) {
        monitor.reset();
        await endNotice(a.id, "withdrawn");
      }
      if (!context.settings.get("notifications", true))
        await endNotice(a.id, "withdrawn");
      if (!enabled || a.monitoring === false) {
        monitor.reset();
        await endNotice(a.id, "withdrawn");
      } else {
        const arrived = monitor.observe(a.observation);
        if (arrived && a.sound?.enabled && a.sound.file) {
          try {
            await context.audio.play(a.sound.file);
          } catch {
            await context.log.error(
              "通知音を再生できません。WAVファイルを確認してください。",
            );
          }
        }
        if (arrived && context.settings.get("notifications", true)) {
          await endNotice(a.id, "withdrawn");
          const body = context.settings.get("notificationDetails", false)
            ? monitor.notificationArrivals
                .slice(0, 3)
                .map(
                  (mail) =>
                    `${mail.sender || "送信元を取得できません"}：${mail.subject || "件名を取得できません"}`,
                )
                .join("\n") +
              (monitor.notificationArrivals.length > 3
                ? `\nほか ${monitor.notificationArrivals.length - 3} 件`
                : "")
            : `未読の新着を ${monitor.notificationArrivals.length} 件検知しました。`;
          const result = await context.notifications.publish({
            typeId: "new-mail",
            title: ("Gmail — " + a.name).slice(0, 200),
            body: body.slice(0, 2000),
            silent: true,
            historyText: {
              title: "Gmailの新着メール",
              body: "未読の新着メールを検知しました。",
            },
            actions: [
              {
                key: "open",
                label: "Gmailを開く",
                command: ID + ".open",
                primary: true,
              },
            ],
          });
          if (active && result.status === "accepted")
            notices.set(a.id, result.notificationId);
        }
        if (!monitor.attention) await endNotice(a.id, "resolved");
      }
      if (!active) return;
      await context.webAccounts.report(
        a.id,
        !enabled
          ? "全体の新着監視はOFFです"
          : a.monitoring === false
            ? "このアカウントの監視はOFFです"
            : a.error || monitor.status,
        monitor.attention,
        {
          pending: monitor.pending,
          arrivals: monitor.history,
          monitoring: enabled && a.monitoring !== false,
        },
      );
    }
    if (!active) return;
    await updateBadge();
    await context.tray.attention(
      [...monitors.values()].some((m) => m.attention),
    );
    await panel(data.accounts);
  } catch {
    if (active)
      await context.log.error(
        "Gmailの画面状態を確認できませんでした。次の更新で再確認します。",
      );
  } finally {
    busy = false;
  }
}
export async function activate(c: Context) {
  context = c;
  active = true;
  latestAccounts = [];
  lastBadgeCount = undefined;
  badgeFailure = false;
  c.commands.register(ID + ".open", "Gmailを開く", () => c.webAccounts.open());
  for (const [action, title] of [
    ["back", "戻る"],
    ["forward", "進む"],
    ["reload", "リロード"],
    ["inbox", "受信トレイへ"],
  ] as const)
    c.commands.register(ID + "." + action, title, () =>
      c.webAccounts.navigate(action),
    );
  c.commands.register(ID + ".nextAccount", "次のアカウント", () =>
    c.webAccounts.cycle(1),
  );
  c.commands.register(ID + ".previousAccount", "前のアカウント", () =>
    c.webAccounts.cycle(-1),
  );
  c.commands.register(ID + ".acknowledge", "新着表示をクリア", async () => {
    for (const monitor of monitors.values()) monitor.acknowledge();
    await updateBadge();
    for (const id of [...notices.keys()]) await endNotice(id, "resolved");
    await tick();
  });
  c.tray.add("Gmailを開く", ID + ".open");
  await c.webAccounts.start();
  await tick();
  c.settings.onChanged(async () => {
    await tick();
  });
  cancel = c.scheduler.every(2000, tick);
}
export async function deactivate() {
  active = false;
  cancel?.();
  monitors.clear();
  latestAccounts = [];
  // The host withdraws this Applet generation's notifications on stop.
  notices.clear();
}
