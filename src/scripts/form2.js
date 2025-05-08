document.addEventListener("DOMContentLoaded", () => {
  const { showMessage } = window.electronAPI;

  // 1) Determine mode
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";

  // 2) Load settings
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) return (window.location.href = "companyData.html");
  const { company, baseYear, comparisonYear } = settings;

  // 3) Determine year and update header
  const year = mode === "base" ? baseYear : comparisonYear;
  document.getElementById("col-header").textContent = year;

  // 4) Static fields definition
  const staticFields = {
    operatingProfit: "الربح التشغيلي",
    benefit: "الفائدة",
    rent: "الإيجار",
    fixedCommitments: "الالتزامات الثابتة",
    netSell: "صافي المبيعات",
    futureNetSales: "صافي المبيعات الآجلة",
    costSales: "تكلفة المبيعات",
    totalProfit: "إجمالي الربح",
    netYearProfit: "صافي الربح السنوي",
  };

  // 5) State
  const state = {
    staticValue: {},
    customFields: [],
  };
  Object.keys(staticFields).forEach((k) => (state.staticValue[k] = ""));

  // 6) DOM refs
  const tbody = document.getElementById("fields-container");
  const newCustomIn = document.getElementById("new-custom-label");
  const addCustomBtn = document.getElementById("add-custom-btn");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const backBtn = document.getElementById("back-btn");

  backBtn.addEventListener("click", () => history.back());

  // 7) Render both static & custom in one table
  function renderAll() {
    tbody.innerHTML = "";

    // 7a) static rows
    for (const [key, label] of Object.entries(staticFields)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2 font-medium">${label}</td>
        <td class="border p-2">
          <input 
            type="text" 
            class="w-full p-1 border rounded"
            value="${state.staticValue[key] || ""}"
          />
        </td>`;
      const inp = tr.querySelector("input");
      inp.addEventListener("input", (e) => {
        state.staticValue[key] = e.target.value;
      });
      tbody.appendChild(tr);
    }

    // 7b) separator
    const sep = document.createElement("tr");
    sep.innerHTML = `<td colspan="2" class="border-t my-2"></td>`;
    tbody.appendChild(sep);

    // 7c) custom rows
    state.customFields.forEach((f, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2">
          <input 
            type="text"
            class="w-full p-1 border rounded"
            value="${f.label}"
          />
        </td>
        <td class="border p-2">
          <input 
            type="text"
            class="w-full p-1 border rounded"
            value="${f.value}"
          />
        </td>`;
      const [labIn, valIn] = tr.querySelectorAll("input");
      labIn.addEventListener("input", (e) => {
        state.customFields[i].label = e.target.value;
      });
      valIn.addEventListener("input", (e) => {
        state.customFields[i].value = e.target.value;
      });
      tbody.appendChild(tr);
    });
  }

  // 8) Fetch existing
  (async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/api/forms/income-statement/get?company=${encodeURIComponent(
          company
        )}&year=${year}`
      );
      const { data } = await res.json();
      if (data) {
        const p = JSON.parse(data);
        state.staticValue = p.static || state.staticValue;
        state.customFields = p.custom || [];
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
    renderAll();
  })();

  // 9) Add custom
  addCustomBtn.addEventListener("click", () => {
    const lbl = newCustomIn.value.trim();
    if (!lbl) return;
    state.customFields.push({ label: lbl, value: "" });
    newCustomIn.value = "";
    renderAll();
  });

  // 10) Save
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
        "http://localhost:3000/api/forms/income-statement/save",
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

  // 11) Reset
  resetBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(
        "http://localhost:3000/api/forms/income-statement/reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, year }),
        }
      );
      if (!res.ok) throw new Error(res.statusText);
      Object.keys(state.staticValue).forEach(
        (k) => (state.staticValue[k] = "")
      );
      state.customFields = [];
      renderAll();
      await showMessage("تم إعادة الضبط", "نجاح");
    } catch (err) {
      console.error("Reset error:", err);
      await showMessage("حدث خطأ أثناء إعادة الضبط", "خطأ");
    }
  });
});
