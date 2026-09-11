/* Shared helpers for both sites. Loaded after config.js. */
(function () {
  const SA = window.SA;

  /* ---------- API ---------- */
  SA.api = async function api(action, payload = {}, { timeout = 30000 } = {}) {
    if (!SA.API_URL || /PASTE_YOUR/.test(SA.API_URL)) {
      throw new Error("The backend link is not set. Open config.js and paste the Apps Script web app URL.");
    }
    if (!navigator.onLine) throw new Error("This device is offline. Reconnect to the internet and try again.");

    const body = Object.assign({ action }, payload);
    const desk = SA.desk.get();
    if (desk.key && body.key === undefined) body.key = desk.key;
    if (desk.name && body.registrar === undefined) body.registrar = desk.name;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight
      const res = await fetch(SA.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error("The server answered with an error (" + res.status + "). Try again.");
      const data = await res.json();
      if (data.status === "unauthorized") {
        const err = new Error(data.message || "Desk passcode is not valid.");
        err.unauthorized = true;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("The server took too long to answer. Check the connection and try again.");
      if (e instanceof SyntaxError) throw new Error("The server sent an unexpected reply. Check that config.js has the right /exec link.");
      if (e.message === "Failed to fetch") throw new Error("Could not reach the server. Check the internet connection and the link in config.js.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  /* ---------- Registrar desk session (registrar site only) ---------- */
  const DESK_KEY = "sa26.desk";
  SA.desk = {
    get() {
      try { return JSON.parse(localStorage.getItem(DESK_KEY)) || {}; } catch { return {}; }
    },
    set(name, key) { localStorage.setItem(DESK_KEY, JSON.stringify({ name, key })); },
    clear() { localStorage.removeItem(DESK_KEY); }
  };

  /* ---------- Formatting ---------- */
  SA.escape = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  SA.normalizeCode = (v) => {
    const s = String(v || "").toUpperCase().replace(/\s+/g, "");
    const m = s.match(/^(?:SA26-?)?(\d{1,6})$/);
    return m ? SA.CODE_PREFIX + m[1].padStart(SA.CODE_DIGITS, "0") : s;
  };

  // "CHUKWUEMEKA" or "chukwuemeka" → "Chukwuemeka"; mixed case like "McDonald" is left alone
  SA.tidyName = (v) => {
    const s = String(v || "").replace(/\s+/g, " ").trim();
    if (!s) return s;
    if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
    return s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
  };

  SA.normalizePhone = (v) => {
    let s = String(v || "").replace(/[^\d+]/g, "");
    if (/^\+?234\d{10}$/.test(s)) s = "0" + s.replace(/^\+?234/, "");
    return s;
  };

  SA.validPhone = (v) => /^0[789]\d{9}$/.test(v) || /^\+\d{10,15}$/.test(v);

  /* ---------- UI helpers ---------- */
  SA.toast = function (message, kind = "info", ms = 4200) {
    let wrap = document.querySelector(".toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toasts";
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = "toast toast--" + kind;
    t.textContent = message;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add("toast--out"); setTimeout(() => t.remove(), 300); }, ms);
  };

  SA.copy = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
  };

  SA.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.textContent = label || "Working…";
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  };

  SA.fillSelect = function (select, items, placeholder) {
    if (!select) return;
    const opts = placeholder ? [`<option value="" disabled selected>${SA.escape(placeholder)}</option>`] : [];
    items.forEach(v => {
      const value = typeof v === "object" ? v.value : v;
      const label = typeof v === "object" ? v.label : v;
      opts.push(`<option value="${SA.escape(value)}">${SA.escape(label)}</option>`);
    });
    select.innerHTML = opts.join("");
  };

  /* ---------- Registrar chrome: desk gate + live counts ---------- */
  SA.initDesk = function ({ onReady } = {}) {
    const gate = document.getElementById("deskGate");
    const who = document.getElementById("deskWho");
    const change = document.getElementById("deskChange");
    if (!gate) { onReady && onReady(); return; }

    const form = gate.querySelector("form");
    const nameInput = gate.querySelector("#deskName");
    const keyInput = gate.querySelector("#deskKey");
    const err = gate.querySelector(".gate__error");

    function open() {
      const d = SA.desk.get();
      nameInput.value = d.name || "";
      keyInput.value = "";
      err.textContent = "";
      document.body.classList.add("is-gated");
      gate.hidden = false;
      setTimeout(() => (d.name ? keyInput : nameInput).focus(), 50);
    }
    function close() {
      gate.hidden = true;
      document.body.classList.remove("is-gated");
      const d = SA.desk.get();
      if (who) who.textContent = d.name;
      SA.refreshStats();
      onReady && onReady();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = SA.tidyName(nameInput.value);
      const key = keyInput.value.trim();
      if (!name || !key) { err.textContent = "Enter your name and the desk passcode."; return; }
      const btn = form.querySelector("button[type=submit]");
      SA.busy(btn, true, "Checking…");
      err.textContent = "";
      try {
        await SA.api("verifyKey", { key, registrar: name });
        SA.desk.set(name, key);
        close();
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        SA.busy(btn, false);
      }
    });

    change && change.addEventListener("click", open);
    SA.onUnauthorized = () => { SA.desk.set(SA.desk.get().name || "", ""); open(); };

    const d = SA.desk.get();
    if (d.name && d.key) close(); else open();
  };

  SA.refreshStats = async function () {
    const el = document.getElementById("deskStats");
    if (!el) return;
    try {
      const s = await SA.api("stats");
      el.innerHTML =
        `<span><b>${s.total}</b> registered</span>` +
        `<span><b>${s.online}</b> online</span>` +
        `<span><b>${s.printed}</b> tags printed</span>`;
    } catch (e) {
      if (e.unauthorized && SA.onUnauthorized) SA.onUnauthorized();
      el.textContent = "";
    }
  };

  SA.handleError = function (e) {
    if (e && e.unauthorized && SA.onUnauthorized) { SA.onUnauthorized(); return; }
    SA.toast((e && e.message) || "Something went wrong.", "error", 6500);
  };
})();
