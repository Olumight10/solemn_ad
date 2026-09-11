/* Registration form — shared by the registrar site (data-mode="registrar")
   and the public site (data-mode="public"). */
(function () {
  const SA = window.SA;
  const mode = document.body.dataset.mode || "public";
  const form = document.getElementById("registrationForm");
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const stateSel = $("state");
  const lgaSelect = $("lgaSelect");
  const lgaText = $("lgaText");
  const centerField = $("centerField");
  const submitBtn = $("submitBtn");

  /* ---------- Populate choices ---------- */
  $("titleList").innerHTML = SA.TITLES.map(t => `<option value="${SA.escape(t)}">`).join("");
  SA.fillSelect(stateSel, SA.STATES, "Select state");
  SA.fillSelect(lgaSelect, SA.RIVERS_LGAS, "Select LGA");
  SA.fillSelect($("how"), SA.HOW, "Select one");

  /* ---------- Dependent fields ---------- */
  function syncLga() {
    const rivers = stateSel.value === "Rivers";
    lgaSelect.hidden = !rivers;
    lgaText.hidden = rivers;
    lgaSelect.name = rivers ? "lga" : "";
    lgaText.name = rivers ? "" : "lga";
    lgaSelect.required = rivers;
    lgaText.required = !rivers;
    $("lgaLabel").htmlFor = rivers ? "lgaSelect" : "lgaText";
    // Outside Rivers there is no LGA list, so ask for the state in the same box
    $("lgaLabelText").textContent = stateSel.value && !rivers ? "LGA and state" : "LGA";
  }
  function syncCenter(e) {
    const picked = form.querySelector('input[name="discipleship"]:checked');
    const yes = !!picked && picked.value === "Yes";
    const wasHidden = centerField.hidden;
    centerField.hidden = !yes;
    $("center").required = yes;
    if (!yes) { $("center").value = ""; clearError($("center")); }
    // When someone just picked Yes, take them straight to the follow-up question
    if (yes && wasHidden && e) $("center").focus({ preventScroll: false });
  }
  stateSel.addEventListener("change", () => { syncLga(); clearError(stateSel); clearError(lgaText); });
  form.querySelectorAll('input[name="discipleship"]').forEach(r => r.addEventListener("change", syncCenter));

  function setDefaults() {
    if (mode === "registrar") stateSel.value = "Rivers"; // the event is in Port Harcourt
    syncLga();
    syncCenter();
  }
  setDefaults();

  /* ---------- Validation ---------- */
  function stateMsg() { return stateSel.value === "Rivers" ? "Choose the LGA." : "Enter the LGA and state."; }
  const messages = {
    title: "Choose or type a title.",
    surname: "Enter the surname.",
    firstname: "Enter the first name.",
    gender: "Choose male or female.",
    phone: "Enter the phone number.",
    state: "Choose Rivers State or Outside Rivers State.",
    lga: stateMsg,
    city: "Enter the city or town.",
    marital: "Choose a marital status.",
    church: "Enter the church or ministry.",
    discipleship: "Choose yes or no.",
    center: "Enter the name of your discipleship center.",
    how: "Tell us how you heard about the program."
  };

  function fieldOf(el) { return el.closest(".field"); }
  function showError(el, msg) {
    const f = fieldOf(el); if (!f) return;
    f.classList.add("field--invalid");
    const p = f.querySelector(".field__error");
    if (p) p.textContent = msg;
    el.setAttribute("aria-invalid", "true");
  }
  function clearError(el) {
    const f = fieldOf(el); if (!f) return;
    f.classList.remove("field--invalid");
    const p = f.querySelector(".field__error");
    if (p) p.textContent = "";
    f.querySelectorAll("[aria-invalid]").forEach(x => x.removeAttribute("aria-invalid"));
  }
  form.addEventListener("input", (e) => clearError(e.target));
  form.addEventListener("change", (e) => clearError(e.target));

  function validate() {
    let first = null;
    const controls = [...form.querySelectorAll("input[name], select[name]")]
      .filter(el => !el.hidden && !el.closest("[hidden]") && el.type !== "radio");

    controls.forEach(el => {
      clearError(el);
      const v = el.value.trim();
      if (el.required && !v) {
        const m = messages[el.name];
        showError(el, (typeof m === "function" ? m() : m) || "This field is required.");
        first = first || el;
      }
    });

    // radio groups
    form.querySelectorAll(".choice-group[data-required]").forEach(g => {
      const name = g.dataset.name;
      if (!form.querySelector(`input[name="${name}"]:checked`)) {
        const input = g.querySelector("input");
        showError(input, messages[name]);
        first = first || input;
      }
    });

    const phone = $("phone");
    const p = SA.normalizePhone(phone.value);
    if (phone.value.trim() && !SA.validPhone(p)) {
      showError(phone, "Use 11 digits like 08031234567, or +countrycode for numbers outside Nigeria.");
      first = first || phone;
    }
    const email = $("email");
    if (email.value.trim() && !email.checkValidity()) {
      showError(email, "This email address doesn’t look right.");
      first = first || email;
    }
    return first;
  }

  /* ---------- Submit ---------- */
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;

    const bad = validate();
    if (bad) {
      bad.focus({ preventScroll: true });
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      SA.toast("Some details need attention.", "error");
      return;
    }

    const data = {};
    new FormData(form).forEach((v, k) => { if (k) data[k] = String(v).trim(); });
    ["surname", "firstname", "othernames", "city", "lga"].forEach(k => { if (data[k]) data[k] = SA.tidyName(data[k]); });
    data.phone = SA.normalizePhone(data.phone);
    data.email = (data.email || "").toLowerCase();
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

  form.addEventListener("reset", () => {
    form.querySelectorAll(".field--invalid").forEach(f => f.classList.remove("field--invalid"));
    form.querySelectorAll(".field__error").forEach(p => (p.textContent = ""));
    setTimeout(setDefaults, 0);
  });

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
      </div>`;
    box.hidden = false;

    const list = recent().filter(r => r.serial !== res.serial);
    list.unshift({ serial: res.serial, fullname: res.fullname });
    localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8)));
    renderRecent();

    if (!dup) {
      form.reset();
      SA.toast(`${res.serial} saved for ${res.fullname}.`, "success");
      SA.refreshStats();
    } else {
      SA.toast("This person was registered before. Their existing code is shown.", "info", 6000);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => $("title").focus({ preventScroll: true }), 350);
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
    if (!dup) form.reset();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  const again = $("passAgain");
  if (again) again.addEventListener("click", () => {
    $("passDialog").close();
    form.reset();
    window.scrollTo({ top: form.offsetTop - 16, behavior: "smooth" });
  });
  if (mode === "registrar") SA.initDesk();
})();
