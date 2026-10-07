(key) => {
  // Invoked only by an explicit action in the trusted local UI. Opening a row
  // lets Gmail handle navigation/read state; never invent a thread URL.
  if (
    typeof key !== "string" ||
    !/^[A-Za-z0-9:#_-]{1,100}(?:~[A-Za-z0-9:#_-]{1,90})?$/.test(key) ||
    location.origin !== "https://mail.google.com" ||
    !/^\/mail\/u\/\d+\/$/.test(location.pathname) ||
    location.hash !== "#inbox"
  )
    return false;
  const visible = (element) =>
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";
  const main = [...document.querySelectorAll('[role="main"]')].find(visible);
  if (!main || main.getAttribute("aria-busy") === "true") return false;
  const id = key.split("~")[0];
  const rows = [...main.querySelectorAll('tr.zA, [role="row"]')].filter(
    visible,
  );
  for (const row of rows) {
    const thread = row.matches("[data-legacy-thread-id], [data-thread-id]")
      ? row
      : row.querySelector("[data-legacy-thread-id], [data-thread-id]");
    const threadId =
      thread?.getAttribute("data-legacy-thread-id") ||
      thread?.getAttribute("data-thread-id");
    if (threadId !== id) continue;
    // Click the subject area, avoiding checkboxes, stars and sender controls.
    const subject = [...row.querySelectorAll(".bog")].find(visible);
    if (!subject) return false;
    subject.click();
    return true;
  }
  return false;
};
