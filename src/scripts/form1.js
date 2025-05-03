document.addEventListener("DOMContentLoaded", () => {
  // 1) Determine mode from URL
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";

  // 2) Load settings
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) return (window.location.href = "comparison-settings.html");
  const { company, baseYear, comparisonYear } = settings;

  // 3) Compute the single year for this form
  const year = mode === "base" ? baseYear : comparisonYear;

  // 4) Update header
  document.getElementById("col-header").textContent = year;

  // 5) Define static fields
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

  // 6) Initialize state
  const state = {
    staticValue: {},
    customFields: [],
  };
  Object.keys(staticFields).forEach((k) => (state.staticValue[k] = ""));

  // 7) Cache DOM elements
  const staticTbody = document.getElementById("static-fields-container");
  const customDiv = document.getElementById("custom-fields-container");
  const newLabelIn = document.getElementById("new-custom-label");
  const addCustomBtn = document.getElementById("add-custom-btn");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const backBtn = document.getElementById("back-btn");

  backBtn.addEventListener("click", () => history.back());

  // 8) Render static fields
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
            >
          </td>`;
      tr.querySelector("input").addEventListener("input", (e) => {
        state.staticValue[key] = e.target.value;
      });
      staticTbody.appendChild(tr);
    });
  }

  // 9) Render custom fields
  function renderCustom() {
    customDiv.innerHTML = "";
    state.customFields.forEach((field, i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "mb-3";
      wrapper.innerHTML = `
          <div class="font-medium mb-1">${field.label}</div>
          <input 
            type="text" 
            class="w-full p-2 border rounded"
            value="${field.value || ""}"
          >`;
      wrapper.querySelector("input").addEventListener("input", (e) => {
        state.customFields[i].value = e.target.value;
      });
      customDiv.appendChild(wrapper);
    });
  }

  // 10) Fetch existing data for company+year
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
    renderStatic();
    renderCustom();
  })();

  // 11) Add a new custom field
  addCustomBtn.addEventListener("click", () => {
    const label = newLabelIn.value.trim();
    if (!label) return;
    state.customFields.push({ label, value: "" });
    newLabelIn.value = "";
    renderCustom();
  });

  // 12) Save (company + year)
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

  // 13) Reset (company + year)
  resetBtn.addEventListener("click", async () => {
    try {
      await fetch("http://localhost:3000/api/forms/balance-sheet/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, year }),
      });
      // clear and re-render
      Object.keys(state.staticValue).forEach(
        (k) => (state.staticValue[k] = "")
      );
      state.customFields = [];
      renderStatic();
      renderCustom();
      window.electronAPI.showMessage("تم إعادة الضبط", "نجاح");
    } catch (err) {
      console.error("Reset error:", err);
      window.electronAPI.showMessage("حدث خطأ أثناء إعادة الضبط", "خطأ");
    }
  });
});
