/* Print tags page — registrar site only. */
(function () {
  const SA = window.SA;
  const $ = (id) => document.getElementById(id);
  const esc = SA.escape;
  const SHEET_KEY = "sa26.sheet";
  const SIZE = 6;

  const sheet = $("sheet");
  const printBtn = $("printBtn");
  const found = new Map(); // serial → participant from the last search

  /* ---------- Sheet state (survives page refresh) ---------- */
  let slots = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(SHEET_KEY));
      if (Array.isArray(s) && s.length === SIZE) return s;
    } catch { /* ignore */ }
    return Array(SIZE).fill(null);
  })();
  const save = () => localStorage.setItem(SHEET_KEY, JSON.stringify(slots));
  const filled = () => slots.filter(Boolean);
  const fullName = (d) => [d.title, d.surname, d.firstname, d.othernames].filter(Boolean).join(" ");

  /* ---------- Tag markup ---------- */
  function tagHTML(d, kind) {
    const k = SA.TAG_TYPES[kind] ? kind : "participant";
    const main = [d.title, d.surname].filter(Boolean).join(" ");
    const given = [d.firstname, d.othernames].filter(Boolean).join(" ");
    const from = d.state === "Rivers" ? [d.lga, "Rivers State"].filter(Boolean).join(", ") : (d.lga || "Outside Rivers State");
    const src = d.source === "Online" ? "Registered online" : "Registered onsite";
    return `
      <article class="tag tag--${k}">
        <img class="tag__banner" src="images/banner.png" alt="">
        <p class="tag__theme">${esc(SA.EVENT.theme)}</p>
        <div class="tag__person">
          <div class="tag__avatar"><img src="images/himage.png" alt=""></div>
          <div class="tag__names">
            <p class="tag__name">${esc(main)}</p>
            <p class="tag__given">${esc(given)}</p>
          </div>
        </div>
        <dl class="tag__meta">
          <div><dt>Church</dt><dd>${esc(d.church || "—")}</dd></div>
          <div><dt>From</dt><dd>${esc(from || "—")}</dd></div>
        </dl>
        <footer class="tag__foot">
          <span class="tag__role">${esc(SA.TAG_TYPES[k])}<small>${src}</small></span>
          <span class="tag__code">${esc(d.serial)}</span>
        </footer>
      </article>`;
  }

  function render() {
    sheet.innerHTML = slots.map((s, i) => s
      ? `<div class="slot slot--filled">${tagHTML(s.data, s.kind)}
           <button type="button" class="slot__remove" data-remove="${i}" aria-label="Remove tag in space ${i + 1}">×</button>
         </div>`
      : `<div class="slot"><div class="slot__empty">Space ${i + 1}</div></div>`
    ).join("");
    const n = filled().length;
    $("sheetCount").textContent = `${n} of ${SIZE} tags`;
    printBtn.disabled = n === 0;
    printBtn.textContent = n ? `Print ${n} tag${n > 1 ? "s" : ""}` : "Print tags";
    $("clearBtn").disabled = n === 0;
    save();
    fitNames();
    fit();
  }

  /* Shrink long names until they sit on one line; wrap only as a last resort */
  function fitText(el, maxPt, minPt) {
    el.classList.remove("is-wrapped");
    let size = maxPt;
    el.style.fontSize = size + "pt";
    while (el.scrollWidth > el.clientWidth + 1 && size > minPt) {
      size -= 0.5;
      el.style.fontSize = size + "pt";
    }
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add("is-wrapped");
  }
  function fitNames() {
    sheet.querySelectorAll(".tag__name").forEach(el => fitText(el, 24, 15));
    sheet.querySelectorAll(".tag__given").forEach(el => fitText(el, 14, 10));
  }
  if (document.fonts) document.fonts.ready.then(fitNames);

  /* Scale the A4 preview to the available width */
  function fit() {
    const scroller = $("sheetScroller");
    const fitEl = $("sheetFit");
    const w = sheet.offsetWidth, h = sheet.offsetHeight;
    const scale = Math.min(1, scroller.clientWidth / w);
    fitEl.style.transform = `scale(${scale})`;
    fitEl.style.width = w + "px";
    scroller.style.height = Math.ceil(h * scale) + 8 + "px";
  }
  window.addEventListener("resize", fit);

  /* ---------- Placing tags ---------- */
  function place(data, kind = "participant", pos = null, { silent = false } = {}) {
    if (slots.some(s => s && s.data.serial === data.serial)) {
      if (!silent) SA.toast(`${data.serial} is already on this sheet.`, "info");
      return false;
    }
    if (data.printedAt && !silent) {
      const ok = confirm(`${fullName(data)} (${data.serial}) already had a tag printed on ${data.printedAt}` +
        (data.printedBy ? ` by ${data.printedBy}` : "") + `.\n\nAdd it again for a reprint?`);
      if (!ok) return false;
    }
    let idx = pos ? pos - 1 : slots.findIndex(s => !s);
    if (idx === -1) {
      SA.toast("The sheet is full. Print it or remove a tag first.", "error");
      return false;
    }
    if (pos && slots[idx]) {
      if (!confirm(`Space ${pos} already has ${fullName(slots[idx].data)}. Replace it?`)) return false;
      release([slots[idx].data.serial]);
    }
    slots[idx] = { data, kind };
    render();
    return true;
  }

  function release(serials) {
    if (serials.length) SA.api("release", { serials }).catch(() => { /* reservations expire anyway */ });
  }

  sheet.addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const i = Number(b.dataset.remove);
    const s = slots[i];
    slots[i] = null;
    render();
    if (s) {
      release([s.data.serial]);
      SA.toast(`Removed ${s.data.serial} from the sheet.`);
    }
  });

  $("clearBtn").addEventListener("click", () => {
    const list = filled();
    if (!list.length) return;
    if (!confirm(`Remove all ${list.length} tag(s) from the sheet? Nothing is marked as printed.`)) return;
    release(list.map(s => s.data.serial));
    slots = Array(SIZE).fill(null);
    render();
  });

  /* ---------- Find a participant ---------- */
  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    const out = $("searchOut");
    if (q.length < 2 && !/^\d$/.test(q)) { out.innerHTML = `<p class="results__note">Type at least 2 characters.</p>`; return; }
    const btn = e.submitter || $("searchForm").querySelector("button");
    SA.busy(btn, true, "Searching…");
    try {
      const res = await SA.api("search", { q });
      if (res.status !== "success") throw new Error(res.message || "Search failed.");
      found.clear();
      if (!res.data.length) {
        out.innerHTML = `<p class="results__note">No one matches “${esc(q)}”. Check the spelling, try the phone number, or register them on the Register page.</p>`;
        return;
      }
      res.data.forEach(d => found.set(d.serial, d));
      out.innerHTML = `<ul class="results">${res.data.map(d => `
        <li class="hit">
          <span class="hit__name"><span class="hit__code">${esc(d.serial)}</span>${esc(fullName(d))}</span>
          <span class="hit__meta">
            ${d.printedAt
              ? `<span class="badge badge--printed">Printed ${esc(d.printedAt.slice(5, 16))}</span>`
              : `<span class="badge">No tag yet</span>`}
            ${d.source === "Online" ? `<span class="badge badge--online">Online</span>` : ""}
            ${esc(d.church || "")}
          </span>
          <button type="button" class="btn btn--primary btn--sm" data-add="${esc(d.serial)}">${d.printedAt ? "Reprint" : "Add"}</button>
        </li>`).join("")}</ul>` +
        (res.total > res.data.length ? `<p class="results__note">Showing ${res.data.length} of ${res.total}. Type more of the name to narrow it down.</p>` : "");
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  });

  $("searchOut").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const d = found.get(b.dataset.add);
    if (d && place(d)) SA.toast(`Added ${d.serial} to the sheet.`, "success", 2500);
  });

  /* ---------- Add by code ---------- */
  async function fetchByCode(code) {
    const res = await SA.api("manualGet", { serial: code });
    if (res.status === "success") return res.data;
    throw new Error(res.message || `No participant has the code ${code}.`);
  }

  $("codeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("code");
    const raw = input.value.trim();
    if (!raw) { input.focus(); SA.toast("Type a program code first.", "error"); return; }
    const code = SA.normalizeCode(raw);
    const pos = Number($("slotPos").value) || null;
    const kind = $("tagType").value;
    const btn = $("codeForm").querySelector("button[type=submit]");
    SA.busy(btn, true, "Finding…");
    try {
      const d = await fetchByCode(code);
      if (place(d, kind, pos)) {
        input.value = "";
        $("slotPos").value = "";
        $("tagType").value = "participant";
        SA.toast(`Added ${d.serial}, ${fullName(d)}.`, "success", 2500);
      }
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
      input.focus();
    }
  });

  /* ---------- Quick fill ---------- */
  $("lastBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    SA.busy(btn, true, "Loading…");
    try {
      const res = await SA.api("manualGet", { serial: "last" });
      if (res.status !== "success") throw new Error(res.message || "Nothing found.");
      if (place(res.data)) SA.toast(`Added ${res.data.serial}, ${fullName(res.data)}.`, "success", 2500);
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  });

  $("autoBtn").addEventListener("click", async (e) => {
    const free = slots.filter(s => !s).length;
    if (!free) { SA.toast("The sheet is full. Print it or remove a tag first.", "error"); return; }
    const btn = e.currentTarget;
    SA.busy(btn, true, "Loading…");
    try {
      const res = await SA.api("autoGet", { limit: free, exclude: filled().map(s => s.data.serial) });
      if (res.status !== "success") throw new Error(res.message || "Could not load participants.");
      if (!res.data.length) { SA.toast("Everyone registered so far already has a tag.", "info"); return; }
      res.data.forEach(d => place(d, "participant", null, { silent: true }));
      SA.toast(`Added ${res.data.length} participant(s) without tags.`, "success", 2500);
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  });

  /* ---------- Print, then confirm ---------- */
  const dialog = $("confirmDialog");

  function imagesReady() {
    const imgs = [...sheet.querySelectorAll("img")];
    return Promise.all(imgs.map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  }

  printBtn.addEventListener("click", async () => {
    const n = filled().length;
    if (!n) return;
    await Promise.all([document.fonts ? document.fonts.ready : null, imagesReady()]);
    let asked = false;
    const ask = () => {
      if (asked) return;
      asked = true;
      $("confirmTitle").textContent = `Did all ${n} tag${n > 1 ? "s" : ""} print correctly?`;
      dialog.showModal();
    };
    window.addEventListener("afterprint", () => setTimeout(ask, 50), { once: true });
    window.print();
    setTimeout(ask, 1200); // browsers that don't fire afterprint
  });

  $("confirmNo").addEventListener("click", () => dialog.close());

  $("confirmYes").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const serials = filled().map(s => s.data.serial);
    SA.busy(btn, true, "Saving…");
    try {
      const res = await SA.api("printConfirm", { serials });
      if (res.status !== "success") throw new Error(res.message || "Could not mark tags as printed.");
      slots = Array(SIZE).fill(null);
      render();
      dialog.close();
      SA.toast(`${res.updated} tag${res.updated === 1 ? "" : "s"} marked as printed.`, "success");
      SA.refreshStats();
      $("code").focus();
    } catch (err) {
      dialog.close();
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  });

  /* ---------- Start ---------- */
  render();

  SA.initDesk({
    onReady: async () => {
      // print.html?add=SA26-0001,SA26-0002 (the "Print this tag" link on the Register page)
      const params = new URLSearchParams(location.search);
      const add = params.get("add");
      if (!add) return;
      history.replaceState(null, "", location.pathname);
      for (const code of add.split(",").map(SA.normalizeCode).filter(Boolean)) {
        try {
          const d = await fetchByCode(code);
          if (place(d)) SA.toast(`Added ${d.serial}, ${fullName(d)}.`, "success", 2500);
        } catch (err) {
          SA.handleError(err);
        }
      }
    }
  });
})();
