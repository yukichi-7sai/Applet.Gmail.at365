(() => {
  // Isolated world 1001: no Electron/Node APIs, no IPC, and no authentication code.
  const slot = "__at365GmailObserverV2";
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
    // No body, sender, subject, cookie, token, or unread-count extraction in this version.
    if (threadId && /^[A-Za-z0-9:#_-]{1,100}$/.test(threadId)) {
      const key =
        threadId +
        (lastMessage && /^[A-Za-z0-9:#_-]{1,90}$/.test(lastMessage)
          ? "~" + lastMessage
          : "");
      if (!keys.includes(key)) keys.push(key);
      if (row.classList.contains("zE")) unread.push(key);
    }
    if (keys.length === 200) break;
  }
  // An explicit Gmail empty-state marker is needed; unknown DOM is unavailable.
  const empty =
    rows.length === 0 && [...main.querySelectorAll(".aRv")].some(visible);
  state.cache = {
    ...base,
    ready: keys.length > 0 || empty,
    keys,
    unread,
    reason: keys.length || empty ? undefined : "no-row-ids",
  };
  return state.cache;
})();
