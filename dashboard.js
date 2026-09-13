/* Dashboard — registrar site only. Reads everything in one call. */
(function () {
  const SA = window.SA;
  const $ = (id) => document.getElementById(id);
  const esc = SA.escape;
  let latest = null;

  const METRICS = [
    { key: "total", label: "Total registered", note: "Everyone in the sheet", tone: "royal" },
    { key: "today", label: "Registered today", note: "Since midnight, Lagos time", tone: "royal" },
    { key: "online", label: "Registered online", note: "Through the public link", tone: "plain" },
    { key: "onsite", label: "Registered at a desk", note: "By a registrar", tone: "plain" },
    { key: "camping", label: "Camping at the venue", note: "Answered yes", tone: "gold" },
    { key: "campingUnknown", label: "Camping not answered", note: "Registered before the question", tone: "warn" },
    { key: "printed", label: "Tags printed", note: "Confirmed by a desk", tone: "good" },
    { key: "unprinted", label: "Still need a tag", note: "No tag printed yet", tone: "warn" },
    { key: "reprints", label: "Reprinted tags", note: "Printed more than once", tone: "plain" },
    { key: "edited", label: "Records edited", note: "Corrected after registering", tone: "plain" }
  ];

  function metricCards(t) {
    return METRICS.map(m => `
      <div class="metric metric--${m.tone}">
        <p class="metric__value">${Number(t[m.key] || 0).toLocaleString()}</p>
        <p class="metric__label">${esc(m.label)}</p>
        <p class="metric__note">${esc(m.note)}</p>
      </div>`).join("");
  }

  function bars(rows, total, opts = {}) {
    if (!rows || !rows.length) return `<p class="hint">Nothing to show yet.</p>`;
    const top = Math.max(...rows.map(r => r.count), 1);
    return `<ul class="bars">${rows.map(r => {
      const pct = total ? Math.round(r.count / total * 100) : 0;
      const cls = opts.tone && opts.tone[r.label] ? " bar--" + opts.tone[r.label] : "";
      return `<li class="bar${cls}">
        <span class="bar__label" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${Math.round(r.count / top * 100)}%"></span></span>
        <span class="bar__count">${r.count}<small>${pct}%</small></span>
      </li>`;
    }).join("")}</ul>`;
  }

  /* ---------- Lists you can open up with a slider ---------- */
  const SHOWN = "sa26.dash.shown";
  function shownCounts() { try { return JSON.parse(localStorage.getItem(SHOWN)) || {}; } catch { return {}; } }
  function setShown(key, n) {
    const all = shownCounts(); all[key] = n;
    localStorage.setItem(SHOWN, JSON.stringify(all));
  }

  // key: which breakdown, boxId: where it draws, title: heading text, noun: what the items are
  const SLIDERS = [
    { key: "lga", boxId: "lgaBox", headId: "lgaHead", title: "Where people live", noun: "places", fallback: 12 },
    { key: "church", boxId: "churchBox", headId: "churchHead", title: "Churches", noun: "churches", fallback: 10 },
    { key: "registrar", boxId: "registrarBox", headId: "registrarHead", title: "Registered by", noun: "desks", fallback: 10 }
  ];

  function drawList(cfg, d) {
    const rows = d.breakdowns[cfg.key] || [];
    const box = $(cfg.boxId);
    const total = d.totals.total;
    const saved = shownCounts()[cfg.key];
    let n = Math.min(rows.length, saved || cfg.fallback);
    if (n < 1) n = rows.length;

    const slider = $(cfg.key + "Slider");
    const wrap = $(cfg.key + "Control");
    // a slider only earns its place when there is more to reveal
    if (rows.length <= 3) {
      wrap.hidden = true;
      n = rows.length;
    } else {
      wrap.hidden = false;
      slider.min = 1;
      slider.max = rows.length;
      slider.value = n;
    }

    function paint(count) {
      const slice = rows.slice(0, count);
      box.innerHTML = bars(slice, total);
      $(cfg.headId).textContent = count >= rows.length
        ? `${cfg.title} — all ${rows.length}`
        : `${cfg.title} — top ${count} of ${rows.length}`;
      if (!wrap.hidden) {
        $(cfg.key + "Value").textContent = count >= rows.length ? `All ${rows.length}` : `Top ${count}`;
        const hidden = rows.length - count;
        const missed = rows.slice(count).reduce((a, b) => a + b.count, 0);
        $(cfg.key + "Rest").textContent = hidden
          ? `${hidden} more ${cfg.noun} not shown (${missed} ${missed === 1 ? "person" : "people"})`
          : "";
      }
    }

    paint(n);
    if (!wrap.hidden) {
      slider.oninput = () => paint(Number(slider.value));
      slider.onchange = () => setShown(cfg.key, Number(slider.value));
      $(cfg.key + "All").onclick = () => {
        slider.value = rows.length;
        setShown(cfg.key, rows.length);
        paint(rows.length);
      };
    }
  }

  function render(d) {
    latest = d;
    const t = d.totals;
    $("metrics").innerHTML = metricCards(t);

    const pct = t.total ? Math.round(t.printed / t.total * 100) : 0;
    $("progressBar").style.width = pct + "%";
    $("progressText").textContent = `${t.printed} of ${t.total} tags printed (${pct}%)`;

    $("campingBox").innerHTML = bars(d.breakdowns.camping, t.total,
      { tone: { Yes: "gold", "Not sure": "warn" } });
    $("dayBox").innerHTML = bars(d.breakdowns.days.slice(-10), t.total);
    $("genderBox").innerHTML = bars(d.breakdowns.gender, t.total);
    $("maritalBox").innerHTML = bars(d.breakdowns.marital, t.total);
    $("discBox").innerHTML = bars(d.breakdowns.discipleship, t.total);
    $("stateBox").innerHTML = bars(d.breakdowns.state, t.total);
    $("howBox").innerHTML = bars(d.breakdowns.how, t.total);
    SLIDERS.forEach(cfg => drawList(cfg, d));

    $("recentBox").innerHTML = d.recent.length
      ? `<ul class="results">${d.recent.map(r => `
          <li class="hit">
            <span class="hit__name"><span class="hit__code">${esc(r.serial)}</span>${esc(r.name)}</span>
            <span class="hit__meta">
              ${r.camping === "Yes" ? `<span class="badge badge--camp">Camping</span>`
                : r.camping === "No" ? `<span class="badge">Not camping</span>`
                : `<span class="badge badge--printed">Camping not answered</span>`}
              ${r.source === "Online" ? `<span class="badge badge--online">Online</span>` : ""}
              ${esc(r.timestamp || "")}
            </span>
            <a class="btn btn--ghost btn--sm" href="edit.html?code=${encodeURIComponent(r.serial)}">Edit</a>
          </li>`).join("")}</ul>`
      : `<p class="hint">No registrations yet.</p>`;

    $("stamp").textContent = "Updated " + d.generatedAt;
    $("board").hidden = false;

    if (t.campingUnknown > 0) {
      $("campNudge").hidden = false;
      $("campNudgeText").innerHTML =
        `<b>${t.campingUnknown}</b> ${t.campingUnknown === 1 ? "person" : "people"} registered before the camping question was added. ` +
        `Their answer is saved as “Not sure”.`;
    } else {
      $("campNudge").hidden = true;
    }
  }

  async function load(btn) {
    SA.busy(btn, true, "Refreshing…");
    try {
      const d = await SA.api("dashboard", {}, { timeout: 45000 });
      if (d.status !== "success") throw new Error(d.message || "Could not load the dashboard.");
      render(d);
    } catch (err) {
      SA.handleError(err);
    } finally {
      SA.busy(btn, false);
    }
  }

  $("refreshBtn").addEventListener("click", (e) => load(e.currentTarget));

  $("printBtn").addEventListener("click", () => window.print());

  $("csvBtn").addEventListener("click", () => {
    if (!latest) return;
    const lines = [["Section", "Item", "Count"]];
    const t = latest.totals;
    METRICS.forEach(m => lines.push(["Summary", m.label, t[m.key] || 0]));
    // the CSV always carries every row, whatever the sliders are set to
    const names = { camping: "Camping", days: "Registrations per day", gender: "Gender", marital: "Marital status",
      discipleship: "Discipleship", state: "State", lga: "LGA", how: "Heard through", church: "Church",
      registrar: "Registered by" };
    Object.keys(names).forEach(k => (latest.breakdowns[k] || []).forEach(r => lines.push([names[k], r.label, r.count])));
    const csv = lines.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `solemn-assembly-summary-${latest.generatedAt.slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  SA.initDesk({ onReady: () => load($("refreshBtn")) });
})();
