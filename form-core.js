/* Shared engine for the registration form and the edit form, so both always
   ask the same questions and apply the same rules. Loaded after app.js. */
(function () {
  const SA = window.SA;

  const MESSAGES = {
    title: "Choose or type a title.",
    surname: "Enter the surname.",
    firstname: "Enter the first name.",
    gender: "Choose male or female.",
    phone: "Enter the phone number.",
    state: "Choose Rivers State or Outside Rivers State.",
    lga: "Enter the LGA.",
    city: "Enter the city or town.",
    marital: "Choose a marital status.",
    church: "Enter the church or ministry.",
    discipleship: "Choose yes or no.",
    center: "Enter the name of your discipleship center.",
    how: "Tell us how you heard about the program.",
    camping: "Let us know if you will be camping at the venue."
  };

  SA.FormCore = function (form) {
    const $ = (id) => form.querySelector("#" + id);
    const stateSel = $("state");
    const lgaSelect = $("lgaSelect");
    const lgaText = $("lgaText");
    const centerField = $("centerField");

    /* ---------- Choices ---------- */
    $("titleList").innerHTML = SA.TITLES.map(t => `<option value="${SA.escape(t)}">`).join("");
    SA.fillSelect(stateSel, SA.STATES, "Select state");
    SA.fillSelect(lgaSelect, SA.RIVERS_LGAS, "Select LGA");
    SA.fillSelect($("how"), SA.HOW, "Select one");

    /* ---------- Fields that depend on another answer ---------- */
    function syncLga() {
      const rivers = stateSel.value === "Rivers";
      lgaSelect.hidden = !rivers;
      lgaText.hidden = rivers;
      lgaSelect.name = rivers ? "lga" : "";
      lgaText.name = rivers ? "" : "lga";
      lgaSelect.required = rivers;
      lgaText.required = !rivers;
      $("lgaLabel").htmlFor = rivers ? "lgaSelect" : "lgaText";
      $("lgaLabelText").textContent = stateSel.value && !rivers ? "LGA and state" : "LGA";
    }

    function syncCenter(moveCursor) {
      const picked = form.querySelector('input[name="discipleship"]:checked');
      const yes = !!picked && picked.value === "Yes";
      const wasHidden = centerField.hidden;
      centerField.hidden = !yes;
      $("center").required = yes;
      if (!yes) { $("center").value = ""; clearError($("center")); }
      if (yes && wasHidden && moveCursor) $("center").focus();
    }

    stateSel.addEventListener("change", () => { syncLga(); clearError(stateSel); clearError(lgaText); });
    form.querySelectorAll('input[name="discipleship"]').forEach(r =>
      r.addEventListener("change", () => syncCenter(true)));
    form.addEventListener("input", (e) => clearError(e.target));
    form.addEventListener("change", (e) => clearError(e.target));

    /* ---------- Errors ---------- */
    function fieldOf(el) { return el.closest(".field"); }
    function showError(el, msg) {
      const f = fieldOf(el); if (!f) return;
      f.classList.add("field--invalid");
      const p = f.querySelector(".field__error");
      if (p) p.textContent = msg;
      el.setAttribute("aria-invalid", "true");
    }
    function clearError(el) {
      const f = el && fieldOf(el); if (!f) return;
      f.classList.remove("field--invalid");
      const p = f.querySelector(".field__error");
      if (p) p.textContent = "";
      f.querySelectorAll("[aria-invalid]").forEach(x => x.removeAttribute("aria-invalid"));
    }
    function clearAllErrors() {
      form.querySelectorAll(".field--invalid").forEach(f => f.classList.remove("field--invalid"));
      form.querySelectorAll(".field__error").forEach(p => (p.textContent = ""));
    }

    function lgaMessage() { return stateSel.value === "Rivers" ? "Choose the LGA." : "Enter the LGA and state."; }

    /* ---------- Validation ---------- */
    function validate() {
      let first = null;
      const controls = [...form.querySelectorAll("input[name], select[name]")]
        .filter(el => !el.hidden && !el.closest("[hidden]") && el.type !== "radio");

      controls.forEach(el => {
        clearError(el);
        if (el.required && !el.value.trim()) {
          showError(el, el.name === "lga" ? lgaMessage() : (MESSAGES[el.name] || "This field is required."));
          first = first || el;
        }
      });

      form.querySelectorAll(".choice-group[data-required]").forEach(g => {
        const name = g.dataset.name;
        if (!form.querySelector(`input[name="${name}"]:checked`)) {
          const input = g.querySelector("input");
          showError(input, MESSAGES[name]);
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

    /* ---------- Reading and writing the form ---------- */
    function collect() {
      const data = {};
      new FormData(form).forEach((v, k) => { if (k) data[k] = String(v).trim(); });
      ["surname", "firstname", "othernames", "city", "lga"].forEach(k => { if (data[k]) data[k] = SA.tidyName(data[k]); });
      data.phone = SA.normalizePhone(data.phone || "");
      data.email = (data.email || "").toLowerCase();
      if (!data.center) data.center = "";
      return data;
    }

    function fill(d) {
      clearAllErrors();
      ["title", "surname", "firstname", "othernames", "phone", "email", "city", "church", "center"]
        .forEach(k => { const el = $(k); if (el) el.value = d[k] || ""; });
      stateSel.value = d.state || "";
      syncLga();
      if (stateSel.value === "Rivers") {
        lgaSelect.value = SA.RIVERS_LGAS.indexOf(d.lga) === -1 ? "" : d.lga;
        if (!lgaSelect.value && d.lga) { // an LGA typed before the list existed
          lgaSelect.insertAdjacentHTML("beforeend", `<option value="${SA.escape(d.lga)}">${SA.escape(d.lga)}</option>`);
          lgaSelect.value = d.lga;
        }
      } else {
        lgaText.value = d.lga || "";
      }
      $("how").value = SA.HOW.indexOf(d.how) === -1 ? "" : d.how;
      ["gender", "marital", "discipleship", "camping"].forEach(name => {
        form.querySelectorAll(`input[name="${name}"]`).forEach(r => { r.checked = r.value === d[name]; });
      });
      syncCenter(false);
    }

    function reset(defaults) {
      form.reset();
      clearAllErrors();
      if (defaults && defaults.state) stateSel.value = defaults.state;
      syncLga();
      syncCenter(false);
    }

    syncLga();
    syncCenter(false);

    return { validate, collect, fill, reset, showError, clearError, clearAllErrors, focus: () => $("title").focus() };
  };
})();
