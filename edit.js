/* Edit a registration — registrar site only. */
(function () {
  const SA = window.SA;
  const $ = (id) => document.getElementById(id);
  const esc = SA.escape;

  const form = $("editForm");
  const core = SA.FormCore(form);
  const found = new Map();
  let current = null;

  /* ---------- Find someone ---------- */
  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (q.length < 2 && !/^\d$/.test(q)) {
      $("searchOut").innerHTML = `<p class="results__note">Type at least 2 characters.</p>`;
      return;
    }
    await runSearch(q, e.submitter || $("searchForm").querySelector("button"));
  });

  async function runSearch(q, btn) {
    const out = $("searchOut");
    SA.busy(btn, true, "Searching…");
    try {
      const res = await SA.api("search", { q });
      if (res.status !== "success") throw new Error(res.message || "Search failed.");
      found.clear();
      if (!res.data.length) {
        out.innerHTML = `<p class="results__note">No one matches “${esc(q)}”. Try the phone number or the program code.</p>`;
        return;
      }
      res.data.forEach(d => found.set(d.serial, d));
      out.innerHTML = `<ul class="results">${res.data.map(d => `
        <li class="hit">
          <span class="hit__name"><span class="hit__code">${esc(d.serial)}</span>${esc(fullName(d))}</span>
          <span class="hit__meta">${campBadge(d.camping)} ${esc(d.phone || "")} ${esc(d.church || "")}</span>
          <button type="button" class="btn btn--primary btn--sm" data-open="${esc(d.serial)}">Open</button>
        </li>`).join("")}</ul>` +
        (res.total > res.data.length ? `<p class="results__note">Showing ${res.data.length} of ${res.total}.</p>` : "");
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  }

  $("searchOut").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) open(found.get(b.dataset.open));
  });

  function fullName(d) { return [d.title, d.surname, d.firstname, d.othernames].filter(Boolean).join(" "); }
  function campBadge(v) {
    if (v === "Yes") return `<span class="badge badge--camp">Camping</span>`;
    if (v === "No") return `<span class="badge">Not camping</span>`;
    return `<span class="badge badge--printed">Camping not answered</span>`;
  }

  /* ---------- Open one person ---------- */
  function open(d) {
    if (!d) return;
    current = d;
    core.fill(d);
    $("whoCode").textContent = d.serial;
    $("whoName").textContent = fullName(d);
    $("whoMeta").innerHTML =
      `${d.source === "Online" ? "Registered online" : "Registered at a desk"} on ${esc(d.timestamp || "—")}` +
      (d.registrar ? ` by ${esc(d.registrar)}` : "") +
      (d.printedAt ? ` · tag printed ${esc(d.printedAt)}` : " · no tag printed yet") +
      (d.editedAt ? ` · last edited ${esc(d.editedAt)}${d.editedBy ? " by " + esc(d.editedBy) : ""}` : "");
    $("campWarn").hidden = d.camping === "Yes" || d.camping === "No";
    $("printLink").href = "print.html?add=" + encodeURIComponent(d.serial);
    $("editor").hidden = false;
    $("empty").hidden = true;
    $("editor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Save ---------- */
  let saving = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (saving || !current) return;
    const bad = core.validate();
    if (bad) {
      bad.focus({ preventScroll: true });
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      SA.toast("Some details need attention.", "error");
      return;
    }
    const data = core.collect();
    data.serial = current.serial;
    saving = true;
    SA.busy($("saveBtn"), true, "Saving…");
    try {
      const res = await SA.api("updateParticipant", data);
      if (res.status === "success") {
        current = res.data;
        open(res.data);
        SA.toast(res.changed
          ? `Saved. Updated ${res.fields.join(", ")}.`
          : "Nothing was different, so nothing was saved.", res.changed ? "success" : "info", 5000);
      } else if (res.status === "duplicate") {
        SA.toast(res.message, "error", 7000);
      } else {
        SA.toast(res.message || "Could not save the changes.", "error", 7000);
      }
    } catch (err) {
      SA.handleError(err);
    } finally {
      saving = false;
      SA.busy($("saveBtn"), false);
    }
  });

  $("cancelBtn").addEventListener("click", () => {
    if (current) { core.fill(current); SA.toast("Changes discarded.", "info", 2500); }
  });

  $("closeBtn").addEventListener("click", () => {
    current = null;
    $("editor").hidden = true;
    $("empty").hidden = false;
    $("q").focus();
  });

  /* ---------- People whose camping answer is still unknown ---------- */
  $("unsureBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const out = $("searchOut");
    SA.busy(btn, true, "Loading…");
    try {
      const res = await SA.api("pendingCamping");
      if (res.status !== "success") throw new Error(res.message || "Could not load the list.");
      found.clear();
      if (!res.total) {
        out.innerHTML = `<p class="results__note">Everyone has answered the camping question.</p>`;
        return;
      }
      res.data.forEach(d => found.set(d.serial, d));
      out.innerHTML = `<p class="results__note"><b>${res.total}</b> ${res.total === 1 ? "person has" : "people have"} not answered the camping question. Open each one to set it.</p>
        <ul class="results">${res.data.map(d => `
          <li class="hit">
            <span class="hit__name"><span class="hit__code">${esc(d.serial)}</span>${esc(fullName(d))}</span>
            <span class="hit__meta">${esc(d.phone || "")} ${esc(d.church || "")}</span>
            <button type="button" class="btn btn--primary btn--sm" data-open="${esc(d.serial)}">Open</button>
          </li>`).join("")}</ul>` +
        (res.total > res.data.length ? `<p class="results__note">Showing the first ${res.data.length}. Set these, then press the button again.</p>` : "");
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  });

  SA.initDesk({
    onReady: async () => {
      const code = new URLSearchParams(location.search).get("code");
      if (!code) return;
      history.replaceState(null, "", location.pathname);
      try {
        const res = await SA.api("manualGet", { serial: SA.normalizeCode(code) });
        if (res.status === "success") open(res.data);
        else SA.toast(res.message || "That code was not found.", "error");
      } catch (err) { SA.handleError(err); }
    }
  });
})();
