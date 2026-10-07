(() => {
  // Isolated world 1001: no Electron/Node APIs, no IPC, and no authentication code.
  const slot = "__at365GmailObserverV5";
  let state = globalThis[slot];
  if (!state) {
    state = {
      document: crypto.randomUUID(),
      revision: 0,
      changed: performance.now(),
      cache: null,
    };
    state.observer = new MutationObserver(() => {
      state.revision++;
      state.changed = performance.now();
      state.cache = null;
    });
    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-thread-id",
        "data-legacy-thread-id",
        "data-legacy-last-message-id",
        "aria-selected",
        "aria-busy",
        "class",
        "email",
        "name",
      ],
    });
    globalThis[slot] = state;
  }
  const route = location.pathname + location.hash;
  const visible = (element) =>
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";
  const main = [...document.querySelectorAll('[role="main"]')].find(visible);
  const tab = [
    ...document.querySelectorAll('[role="tab"][aria-selected="true"]'),
  ]
    .filter(visible)
    .map((e) => e.getAttribute("aria-label") || e.textContent)
    .join("|");
  const context = route + "|" + tab;
  const base = {
    context,
    document: state.document,
    revision: state.revision,
    keys: [],
  };
  if (
    location.origin !== "https://mail.google.com" ||
    !/^\/mail\/u\/\d+\/$/.test(location.pathname) ||
    location.hash !== "#inbox" ||
    !main
  )
    return { ...base, ready: false, reason: "not-inbox" };
  if (
    main.getAttribute("aria-busy") === "true" ||
    performance.now() - state.changed < 800
  )
    return { ...base, ready: false, reason: "settling" };
  if (state.cache && state.cache.context === context) return state.cache;
  const rows = [...main.querySelectorAll('tr.zA, [role="row"]')].filter(
    visible,
  );
  const keys = [];
  const unread = [];
  const read = [];
  const details = [];
  let detailBytes = 0;
  const text = (value, limit) =>
    (value || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  for (const row of rows) {
    const thread = row.matches("[data-legacy-thread-id], [data-thread-id]")
      ? row
      : row.querySelector("[data-legacy-thread-id], [data-thread-id]");
    const threadId =
      thread?.getAttribute("data-legacy-thread-id") ||
      thread?.getAttribute("data-thread-id");
    const message = row.querySelector("[data-legacy-last-message-id]");
    const lastMessage =
      row.getAttribute("data-legacy-last-message-id") ||
      message?.getAttribute("data-legacy-last-message-id");
    // Read only the row's sender and subject; .y2 snippets and message bodies are excluded.
    if (threadId && /^[A-Za-z0-9:#_-]{1,100}$/.test(threadId)) {
      const key =
        threadId +
        (lastMessage && /^[A-Za-z0-9:#_-]{1,90}$/.test(lastMessage)
          ? "~" + lastMessage
          : "");
      if (keys.includes(key)) continue;
      keys.push(key);
      if (row.classList.contains("zE")) unread.push(key);
      else if (row.classList.contains("yO")) read.push(key);
      const senders = [
        ...row.querySelectorAll(".yW [email], .yW [name], span[email]"),
      ].filter(visible);
      const senderElement = senders.at(-1);
      const subjectElement = [...row.querySelectorAll(".bog")].find(visible);
      const detail = {
        key,
        sender: text(
          senderElement?.getAttribute("name") ||
            senderElement?.textContent ||
            senderElement?.getAttribute("email"),
          120,
        ),
        subject: text(subjectElement?.textContent, 200),
      };
      const bytes = new TextEncoder().encode(JSON.stringify(detail)).length;
      if (details.length < 40 && detailBytes + bytes <= 12000) {
        details.push(detail);
        detailBytes += bytes;
      }
    }
    if (keys.length === 200) break;
  }
  // An explicit Gmail empty-state marker is needed; unknown DOM is unavailable.
  const empty =
    rows.length === 0 &&
    ([...main.querySelectorAll(".aRv")].some(visible) ||
      [...main.querySelectorAll("table.TB tr.TD > td.TC")]
        .filter(visible)
        .some((e) =>
          /^(新着メールはありません。|受信トレイにメールはありません。|No new mail!?|Your inbox is empty\.)$/i.test(
            text(e.textContent, 200),
          ),
        ));
  // Gmail's range has three numeric spans: first, last, total. Only claim
  // full coverage when every displayed row was captured, without truncation.
  const rowsComplete = keys.length === rows.length;
  const complete =
    empty ||
    [...document.querySelectorAll(".Dj")].filter(visible).some((pager) => {
      const parts = [...pager.querySelectorAll(".ts")].map((e) =>
        text(e.textContent, 30).replace(/[,\s\u00a0]/g, ""),
      );
      if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part)))
        return false;
      const [first, last, total] = parts.map(Number);
      return (
        first === 1 &&
        Number.isSafeInteger(total) &&
        total > 0 &&
        last === total &&
        total === rows.length &&
        rowsComplete
      );
    });
  state.cache = {
    ...base,
    ready: keys.length > 0 || empty,
    keys,
    unread,
    read,
    details,
    complete,
    rowsComplete,
    reason: keys.length || empty ? undefined : "no-row-ids",
  };
  // Keep the host observation bounded even for unusual long IDs or multibyte text.
  while (
    new TextEncoder().encode(JSON.stringify(state.cache)).length > 55000 &&
    keys.length
  ) {
    const key = keys.pop();
    state.cache.complete = false;
    state.cache.rowsComplete = false;
    const u = unread.indexOf(key);
    if (u >= 0) unread.splice(u, 1);
    const r = read.indexOf(key);
    if (r >= 0) read.splice(r, 1);
    const d = details.findIndex((detail) => detail.key === key);
    if (d >= 0) details.splice(d, 1);
  }
  return state.cache;
})();
