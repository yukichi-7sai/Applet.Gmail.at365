export interface InboxObservation {
  ready: boolean;
  context: string;
  document: string;
  revision: number;
  keys: string[];
  unread?: string[];
  reason?: string;
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
        v.unread.some((k) => !v.keys.includes(k))))
  )
    return null;
  return v;
}
// New rows above an existing anchor and unread-thread message IDs provide evidence.
// Reordering, paging, initial load, login, and returning from another folder rebaseline.
export class InboxMonitor {
  private previous?: InboxObservation;
  private seen = new Set<string>();
  attention = false;
  status = "受信トレイの表示を待っています";
  observe(raw: unknown): boolean {
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
    let arrived = false;
    if (
      old &&
      old.context === next.context &&
      old.document === next.document &&
      !old.keys.length
    )
      arrived = next.keys.some((k) => !this.seen.has(k));
    if (
      old &&
      old.context === next.context &&
      old.document === next.document &&
      old.keys.length
    ) {
      const anchor = next.keys.indexOf(old.keys[0]);
      if (anchor > 0) {
        // Keep existing shared rows in order. Sorting must not create arrivals.
        const shared = next.keys.filter((k) => old.keys.includes(k));
        const ordered = old.keys.filter((k) => next.keys.includes(k));
        if (JSON.stringify(shared) === JSON.stringify(ordered))
          arrived = next.keys.slice(0, anchor).some((k) => !this.seen.has(k));
      }
    }
    if (old && old.context === next.context && old.document === next.document) {
      // Gmail supplies immutable last-message IDs. A changed ID in an existing
      // unread thread is reply evidence; toggling unread alone cannot trigger it.
      arrived ||= (next.unread ?? []).some(
        (key) =>
          key.includes("~") &&
          !this.seen.has(key) &&
          old.keys.some(
            (prior) =>
              prior.includes("~") &&
              prior !== key &&
              prior.split("~")[0] === key.split("~")[0],
          ),
      );
    }
    for (const key of next.keys) this.seen.add(key);
    // Session-only bounded history. Keep current rows when trimming.
    if (this.seen.size > 4096) this.seen = new Set([...this.seen].slice(-2048));
    if (arrived) this.attention = true;
    this.status = this.attention
      ? "新着メールがあります"
      : "受信トレイを監視中";
    return arrived;
  }
  acknowledge() {
    this.attention = false;
    this.status = this.previous
      ? "受信トレイを監視中"
      : "受信トレイの表示を待っています";
  }
  reset() {
    this.previous = undefined;
    this.seen.clear();
    this.attention = false;
    this.status = "監視を停止しています";
  }
}
