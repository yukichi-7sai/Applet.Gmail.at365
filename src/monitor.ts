export interface InboxObservation {
  ready: boolean;
  context: string;
  document: string;
  revision: number;
  keys: string[];
  unread?: string[];
  read?: string[];
  reason?: string;
  details?: { key: string; sender: string; subject: string }[];
}
export interface Arrival {
  key: string;
  sender: string;
  subject: string;
  detectedAt: number;
  acknowledged: boolean;
  unread: boolean | null;
  initial: boolean;
}
export function parseObservation(raw: unknown): InboxObservation | null {
  const v = raw as InboxObservation | null;
  if (
    !v ||
    typeof v !== "object" ||
    typeof v.ready !== "boolean" ||
    typeof v.context !== "string" ||
    typeof v.document !== "string" ||
    !Number.isSafeInteger(v.revision) ||
    !Array.isArray(v.keys) ||
    v.keys.length > 200 ||
    v.keys.some((k) => typeof k !== "string" || !k || k.length > 200) ||
    new Set(v.keys).size !== v.keys.length ||
    (v.unread !== undefined &&
      (!Array.isArray(v.unread) ||
        v.unread.length > 200 ||
        v.unread.some((k) => !v.keys.includes(k)))) ||
    (v.read !== undefined &&
      (!Array.isArray(v.read) ||
        v.read.length > 200 ||
        v.read.some((k) => !v.keys.includes(k) || v.unread?.includes(k)))) ||
    (v.details !== undefined &&
      (!Array.isArray(v.details) ||
        v.details.length > 40 ||
        new Set(v.details.map((d) => d?.key)).size !== v.details.length ||
        v.details.some(
          (d) =>
            !d ||
            !v.keys.includes(d.key) ||
            typeof d.sender !== "string" ||
            d.sender.length > 120 ||
            typeof d.subject !== "string" ||
            d.subject.length > 200,
        )))
  )
    return null;
  return v;
}
// New rows above an existing anchor and unread-thread message IDs provide evidence.
// Startup imports unread rows. Later reload/folder changes rebaseline without
// duplicate notifications, while confirmed read-state changes update the count.
export class InboxMonitor {
  private previous?: InboxObservation;
  private seen = new Set<string>();
  private initialized = false;
  private pendingThreads = new Map<string, boolean | null>();
  attention = false;
  pending = 0;
  history: Arrival[] = [];
  lastArrivals: Arrival[] = [];
  get notificationArrivals() {
    return this.lastArrivals.filter((mail) => mail.unread === true);
  }
  status = "受信トレイの表示を待っています";
  observe(raw: unknown): boolean {
    this.lastArrivals = [];
    const next = parseObservation(raw);
    if (!next?.ready) {
      if (next?.reason !== "settling") this.previous = undefined;
      this.status =
        next?.reason === "settling"
          ? "画面の更新を確認しています"
          : "受信トレイを表示すると監視します";
      return false;
    }
    const old = this.previous;
    this.previous = next;
    const arrivals = new Set<string>();
    const initial = !this.initialized;
    this.initialized = true;
    if (initial) for (const key of next.unread ?? []) arrivals.add(key);
    if (
      old &&
      old.context === next.context &&
      old.document === next.document &&
      !old.keys.length
    )
      for (const k of next.keys) if (!this.seen.has(k)) arrivals.add(k);
    if (
      old &&
      old.context === next.context &&
      old.document === next.document &&
      old.keys.length
    ) {
      const thread = (key: string) => key.split("~")[0];
      const previousThreads = old.keys.map(thread);
      const nextThreads = next.keys.map(thread);
      // Message IDs can change in the anchor thread during the same update.
      const anchor = nextThreads.indexOf(previousThreads[0]);
      if (anchor > 0) {
        // Keep existing shared rows in order. Sorting must not create arrivals.
        const shared = nextThreads.filter((k) => previousThreads.includes(k));
        const ordered = previousThreads.filter((k) => nextThreads.includes(k));
        if (JSON.stringify(shared) === JSON.stringify(ordered))
          for (const k of next.keys.slice(0, anchor))
            if (!this.seen.has(k)) arrivals.add(k);
      }
    }
    if (old && old.context === next.context && old.document === next.document) {
      // Gmail supplies immutable last-message IDs. A changed ID in an existing
      // unread thread is reply evidence; toggling unread alone cannot trigger it.
      for (const key of next.unread ?? []) {
        if (
          key.includes("~") &&
          !this.seen.has(key) &&
          old.keys.some(
            (prior) =>
              prior.includes("~") &&
              prior !== key &&
              prior.split("~")[0] === key.split("~")[0],
          )
        )
          arrivals.add(key);
      }
    }
    for (const key of next.keys) this.seen.add(key);
    // Session-only bounded history. Keep current rows when trimming.
    if (this.seen.size > 4096) this.seen = new Set([...this.seen].slice(-2048));
    const states = new Map(
      next.keys.map((key) => [
        key.split("~")[0],
        next.unread?.includes(key)
          ? true
          : next.read?.includes(key)
            ? false
            : null,
      ]),
    );
    for (const thread of this.pendingThreads.keys())
      this.pendingThreads.set(thread, states.get(thread) ?? null);
    this.history = this.history.map((entry) => ({
      ...entry,
      unread: states.get(entry.key.split("~")[0]) ?? null,
    }));
    if (arrivals.size) {
      const detectedAt = Date.now();
      this.lastArrivals = next.keys
        .filter((key) => arrivals.has(key))
        .map((key) => ({
          key,
          sender: next.details?.find((d) => d.key === key)?.sender ?? "",
          subject: next.details?.find((d) => d.key === key)?.subject ?? "",
          detectedAt,
          acknowledged: false,
          unread: states.get(key.split("~")[0]) ?? null,
          initial,
        }));
      for (const mail of this.lastArrivals)
        this.pendingThreads.set(mail.key.split("~")[0], mail.unread);
      this.history = [...this.lastArrivals, ...this.history].slice(0, 50);
    }
    if (this.pendingThreads.size > 4096) {
      for (const [thread, unread] of this.pendingThreads) {
        if (unread !== true) this.pendingThreads.delete(thread);
        if (this.pendingThreads.size <= 2048) break;
      }
    }
    this.pending = [...this.pendingThreads.values()].filter(
      (unread) => unread === true,
    ).length;
    while (
      new TextEncoder().encode(
        JSON.stringify({ pending: this.pending, arrivals: this.history }),
      ).length > 48000
    )
      this.history.pop();
    this.attention = this.pending > 0;
    this.status = this.attention
      ? "新着メールがあります"
      : "受信トレイを監視中";
    // State changes update badges without notifying the same mail again.
    return this.lastArrivals.some((mail) => mail.unread === true);
  }
  acknowledge() {
    this.attention = false;
    this.pending = 0;
    this.pendingThreads.clear();
    this.history = this.history.map((entry) => ({
      ...entry,
      acknowledged: true,
    }));
    this.status = this.previous
      ? "受信トレイを監視中"
      : "受信トレイの表示を待っています";
  }
  reset() {
    this.previous = undefined;
    this.initialized = false;
    this.pendingThreads.clear();
    this.seen.clear();
    this.attention = false;
    this.pending = 0;
    this.history = [];
    this.lastArrivals = [];
    this.status = "監視を停止しています";
  }
}
