// scripts/cash-flow.js

document.addEventListener("DOMContentLoaded", () => {
  const { showMessage } = window.electronAPI;

  // 1) Mode from URL
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";

  // 2) Load comparisonSettings
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) {
    window.location.href = "companyData.html";
    return;
  }
  const { company, baseYear, comparisonYear } = settings;

  // 3) Determine year
  const year = mode === "base" ? baseYear : comparisonYear;

  // 4) Update header
  document.getElementById("col-header").textContent = year;

  // 5) Define static fields
  const staticFields = {
    netOperatingCashFlow: "صافي التدفقات النقدية التشغيلية",
    netCashFlowAndSimilar: "صافي التدفقات النقدية وما في حكمها",
  };

  // 6) State
  const state = {
    staticValue: {},
    customFields: [],
  };
  Object.keys(staticFields).forEach((k) => (state.staticValue[k] = ""));

  // 7) Cache DOM
  const staticTbody = document.getElementById("static-fields-container");
  const customDiv = document.getElementById("custom-fields-container");
  const newLabelIn = document.getElementById("new-custom-label");
  const addCustomBtn = document.getElementById("add-custom-btn");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const backBtn = document.getElementById("back-btn");

  backBtn.addEventListener("click", () => history.back());

  // 8) Render static
  function renderStatic() {
    staticTbody.innerHTML = "";
    Object.entries(staticFields).forEach(([key, label]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td class="border p-2">${label}</td>
          <td class="border p-2">
            <input
              type="text"
              class="w-full p-1 border rounded"
              value="${state.staticValue[key] || ""}"
            />
          </td>`;
      tr.querySelector("input").addEventListener("input", (e) => {
        state.staticValue[key] = e.target.value;
      });
      staticTbody.appendChild(tr);
    });
  }

  // 9) Render custom
  function renderCustom() {
    customDiv.innerHTML = "";
    state.customFields.forEach((f, i) => {
      const w = document.createElement("div");
      w.className = "mb-3";
      w.innerHTML = `
          <div class="font-medium mb-1">${f.label}</div>
          <input
            type="text"
            class="w-full p-2 border rounded"
            value="${f.value || ""}"
          />`;
      w.querySelector("input").addEventListener("input", (e) => {
        state.customFields[i].value = e.target.value;
      });
      customDiv.appendChild(w);
    });
  }

  // 10) Fetch existing data
  (async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/api/forms/cash-flow/get?company=${encodeURIComponent(
          company
        )}&year=${year}`
      );
      const { data } = await res.json();
      if (data) {
        const parsed = JSON.parse(data);
        state.staticValue = parsed.static || state.staticValue;
        state.customFields = parsed.custom || [];
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
    renderStatic();
    renderCustom();
  })();

  // 11) Add custom
  addCustomBtn.addEventListener("click", () => {
    const label = newLabelIn.value.trim();
    if (!label) return;
    state.customFields.push({ label, value: "" });
    newLabelIn.value = "";
    renderCustom();
  });

  // 12) Save
  saveBtn.addEventListener("click", async () => {
    const payload = {
      company,
      year,
      data: JSON.stringify({
        static: state.staticValue,
        custom: state.customFields,
      }),
    };
    try {
      const res = await fetch(
        "http://localhost:3000/api/forms/cash-flow/save",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(res.statusText);
      await showMessage("تم الحفظ", "نجاح");
    } catch (err) {
      console.error("Save error:", err);
      await showMessage("حدث خطأ أثناء الحفظ", "خطأ");
    }
  });

  // 13) Reset
  resetBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(
        "http://localhost:3000/api/forms/cash-flow/reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, year }),
        }
      );
      if (!res.ok) throw new Error(res.statusText);
      // clear
      Object.keys(state.staticValue).forEach(
        (k) => (state.staticValue[k] = "")
      );
      state.customFields = [];
      renderStatic();
      renderCustom();
      await showMessage("تم إعادة الضبط", "نجاح");
    } catch (err) {
      console.error("Reset error:", err);
      await showMessage("حدث خطأ أثناء إعادة الضبط", "خطأ");
    }
  });
});
