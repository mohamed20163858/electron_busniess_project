document.addEventListener("DOMContentLoaded", () => {
  // 1) Determine mode
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";

  // 2) Load settings
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) return (window.location.href = "comparison-settings.html");
  const { company, baseYear, comparisonYear } = settings;

  // 3) Determine year
  const year = mode === "base" ? baseYear : comparisonYear;
  document.getElementById("col-header").textContent = year;

  // 4) Static fields
  const staticFields = {
    totalAssets: "اجمالي الأصول",
    totalDebits: "اجمالي الالتزمات",
    currentAssets: "الأصول المتداولة",
    currentDebits: "الالتزامات المتداولة",
    inventory: "المخزون",
    totalContributersRights: "اجمالي حقوق الملكية",
    totalFixedAssets: "اجمالي الأصول الثابتة",
    clientsAndOtherDebits: "العملاء وارصده مدينة أخرى",
    creditorsAndOtherCredits: "دائنون و أرصدة دائنة أخرى",
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
  const printBtn = document.getElementById("print-btn");
  // print functionality
  printBtn.addEventListener("click", () => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (!mode) {
      console.error("cannot print without mode");
      return showMessage("حدث خطأ أثناء معاينة الطباعة", "خطأ");
    }
    window.location.href = `form1-print.html?mode=${mode}`;
  });

  backBtn.addEventListener("click", () => history.back());

  // 7) Render everything in one table
  function renderAll() {
    tbody.innerHTML = "";

    // 7a) Static rows
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
        </td>
      `;
      const input = tr.querySelector("input");
      input.addEventListener("input", (e) => {
        state.staticValue[key] = e.target.value;
      });
      tbody.appendChild(tr);
    }

    // 7b) Separator row (optional)
    const sep = document.createElement("tr");
    sep.innerHTML = `<td colspan="2" class="border-t my-2"></td>`;
    tbody.appendChild(sep);

    // 7c) Custom rows
    state.customFields.forEach((field, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2">
          <input 
            type="text"
            class="w-full p-1 border rounded"
            value="${field.label}"
          />
        </td>
        <td class="border p-2">
          <input 
            type="text"
            class="w-full p-1 border rounded"
            value="${field.value}"
          />
        </td>
      `;
      const [labIn, valIn] = tr.querySelectorAll("input");
      labIn.addEventListener(
        "input",
        (e) => (state.customFields[idx].label = e.target.value)
      );
      valIn.addEventListener(
        "input",
        (e) => (state.customFields[idx].value = e.target.value)
      );
      tbody.appendChild(tr);
    });
  }

  // 8) Fetch existing
  (async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/api/forms/balance-sheet/get?company=${encodeURIComponent(
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
    renderAll();
  })();

  // 9) Add custom
  addCustomBtn.addEventListener("click", () => {
    const label = newCustomIn.value.trim();
    if (!label) return;
    state.customFields.push({ label, value: "" });
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
      await fetch("http://localhost:3000/api/forms/balance-sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.electronAPI.showMessage("تم الحفظ", "نجاح");
    } catch (err) {
      console.error("Save error:", err);
      window.electronAPI.showMessage("حدث خطأ أثناء الحفظ", "خطأ");
    }
  });

  // 11) Reset
  resetBtn.addEventListener("click", async () => {
    try {
      await fetch("http://localhost:3000/api/forms/balance-sheet/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, year }),
      });
      Object.keys(state.staticValue).forEach(
        (k) => (state.staticValue[k] = "")
      );
      state.customFields = [];
      renderAll();
      window.electronAPI.showMessage("تم إعادة الضبط", "نجاح");
    } catch (err) {
      console.error("Reset error:", err);
      window.electronAPI.showMessage("حدث خطأ أثناء إعادة الضبط", "خطأ");
    }
  });
});
