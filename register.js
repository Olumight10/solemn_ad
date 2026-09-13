/* Registration form — shared by the registrar site (data-mode="registrar")
   and the public site (data-mode="public"). */
(function () {
  const SA = window.SA;
  const mode = document.body.dataset.mode || "public";
  const form = document.getElementById("registrationForm");
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const submitBtn = $("submitBtn");
  const core = SA.FormCore(form);
  const defaults = mode === "registrar" ? { state: "Rivers" } : null;  // the event is in Port Harcourt
  core.reset(defaults);

  /* ---------- Submit ---------- */
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;

    const bad = core.validate();
    if (bad) {
      bad.focus({ preventScroll: true });
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      SA.toast("Some details need attention.", "error");
      return;
    }

    const data = core.collect();
    if (mode === "public") { data.key = ""; data.registrar = ""; }

    sending = true;
    SA.busy(submitBtn, true, "Registering…");
    try {
      const res = await SA.api("storeParticipant", data);
      if (res.status === "success" || res.status === "duplicate") {
        onDone(res);
      } else {
        SA.toast(res.message || "Registration was not saved. Try again.", "error", 7000);
      }
    } catch (err) {
      SA.handleError(err);
    } finally {
      sending = false;
      SA.busy(submitBtn, false);
    }
  });

  form.addEventListener("reset", (e) => { e.preventDefault(); core.reset(defaults); });

  function onDone(res) {
    const dup = res.status === "duplicate";
    if (mode === "registrar") return registrarDone(res, dup);
    return publicDone(res, dup);
  }

  /* ---------- Registrar: result ticket + recent list ---------- */
  const RECENT = "sa26.recent";
  function recent() { try { return JSON.parse(localStorage.getItem(RECENT)) || []; } catch { return []; } }

  function ticketHTML(res, dup) {
    const code = SA.escape(res.serial);
    return `
      <div class="pass ${dup ? "pass--dup" : ""}">
        <div class="pass__main">
          <p class="pass__state">${dup ? "Already registered" : "Registered"}</p>
          <p class="pass__name">${SA.escape(res.fullname)}</p>
        </div>
        <div class="pass__stub">
          <span class="pass__label">Program code</span>
          <span class="pass__code">${code}</span>
        </div>
      </div>`;
  }

  function registrarDone(res, dup) {
    const box = $("result");
    box.innerHTML = ticketHTML(res, dup) + `
      <div class="result__actions">
        <a class="btn btn--primary" href="print.html?add=${encodeURIComponent(res.serial)}">Print this tag</a>
        <button type="button" class="btn btn--ghost" data-copy="${SA.escape(res.serial)}">Copy code</button>
      </div>
      ${dup ? `<p class="hint" style="margin-top:.6rem"><a href="edit.html?code=${encodeURIComponent(res.serial)}">Open their details to check or correct</a></p>` : ""}`;
    box.hidden = false;

    const list = recent().filter(r => r.serial !== res.serial);
    list.unshift({ serial: res.serial, fullname: res.fullname });
    localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8)));
    renderRecent();

    if (!dup) {
      core.reset(defaults);
      SA.toast(`${res.serial} saved for ${res.fullname}.`, "success");
      SA.refreshStats();
    } else {
      SA.toast("This person was registered before. Their existing code is shown.", "info", 6000);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => core.focus(), 350);
  }

  function renderRecent() {
    const ul = $("recentList");
    if (!ul) return;
    const items = recent();
    ul.innerHTML = items.length
      ? items.map(r => `
          <li>
            <span class="recent__code">${SA.escape(r.serial)}</span>
            <span class="recent__name">${SA.escape(r.fullname)}</span>
            <a href="print.html?add=${encodeURIComponent(r.serial)}">Print</a>
          </li>`).join("")
      : `<li class="recent__empty">People you register at this desk appear here, ready to print.</li>`;
  }
  renderRecent();

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    await SA.copy(b.dataset.copy);
    const old = b.textContent; b.textContent = "Copied"; setTimeout(() => (b.textContent = old), 1400);
  });

  /* ---------- Public: pass dialog ---------- */
  function publicDone(res, dup) {
    const dlg = $("passDialog");
    $("passTicket").innerHTML = ticketHTML(res, dup);
    $("passHeading").textContent = dup ? "You are already registered" : "You are registered";
    $("passCopy").dataset.copy = res.serial;
    if (!dup) core.reset(defaults);
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  const again = $("passAgain");
  if (again) again.addEventListener("click", () => {
    $("passDialog").close();
    core.reset(defaults);
    window.scrollTo({ top: form.offsetTop - 16, behavior: "smooth" });
  });
  if (mode === "registrar") SA.initDesk();
})();
