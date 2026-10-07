import { InboxMonitor } from "./monitor";
interface Account {
  id: string;
  name: string;
  observation: unknown;
  error: string;
  sound?: { enabled: boolean; file: string };
}
interface Context {
  commands: {
    register(id: string, title: string, handler: () => unknown): void;
  };
  webAccounts: {
    start(): Promise<unknown>;
    open(): Promise<unknown>;
    cycle(direction: 1 | -1): Promise<unknown>;
    read(): Promise<{ accounts: Account[]; acknowledged: string[] }>;
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
    show(
      title: string,
      body: string,
      options?: { silent?: boolean; command?: string },
    ): Promise<unknown>;
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
      value: a.error || monitors.get(a.id)?.status || "ログインを待っています",
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
    for (const id of monitors.keys())
      if (!data.accounts.some((a) => a.id === id)) monitors.delete(id);
    const enabled = context.settings.get("monitoring", true);
    for (const a of data.accounts) {
      let monitor = monitors.get(a.id);
      if (!monitor) {
        monitor = new InboxMonitor();
        monitors.set(a.id, monitor);
      }
      if (data.acknowledged.includes(a.id)) monitor.acknowledge();
      if (!enabled) monitor.reset();
      else {
        const arrived = monitor.observe(a.observation);
        if (arrived && a.sound?.enabled) {
          try {
            await context.audio.play(a.sound.file);
          } catch {
            await context.log.error(
              "通知音を再生できません。WAVファイルを確認してください。",
            );
          }
        }
        if (arrived && context.settings.get("notifications", true))
          await context.notifications.show(
            "Gmail — " + a.name,
            context.settings.get("notificationDetails", false)
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
              : `未読の新着を ${monitor.notificationArrivals.length} 件検知しました。`,
            { command: ID + ".open", silent: true },
          );
      }
      if (!active) return;
      await context.webAccounts.report(
        a.id,
        a.error || monitor.status,
        monitor.attention,
        { pending: monitor.pending, arrivals: monitor.history },
      );
    }
    if (!active) return;
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
  c.commands.register(ID + ".open", "Gmailを開く", () => c.webAccounts.open());
  c.commands.register(ID + ".nextAccount", "次のアカウント", () =>
    c.webAccounts.cycle(1),
  );
  c.commands.register(ID + ".previousAccount", "前のアカウント", () =>
    c.webAccounts.cycle(-1),
  );
  c.commands.register(ID + ".acknowledge", "新着表示をクリア", async () => {
    for (const monitor of monitors.values()) monitor.acknowledge();
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
}
