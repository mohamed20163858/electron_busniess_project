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

  // 3) Update header
  document.getElementById("col-header").textContent =
    mode === "base" ? baseYear : comparisonYear;

  // 4) Define static fields
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

  // 5) Initialize state
  const state = {
    staticBase: {},
    staticComp: {},
    customBase: [],
    customComp: [],
  };
  Object.keys(staticFields).forEach((key) => {
    state.staticBase[key] = "";
    state.staticComp[key] = "";
  });

  // 6) Cache DOM
  const staticTbody = document.getElementById("static-fields-container");
  const customDiv = document.getElementById("custom-fields-container");
  const newLabelIn = document.getElementById("new-custom-label");
  const addCustomBtn = document.getElementById("add-custom-btn");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const backBtn = document.getElementById("back-btn");

  backBtn.addEventListener("click", () => history.back());

  // 7) Render static
  function renderStatic() {
    staticTbody.innerHTML = "";
    Object.entries(staticFields).forEach(([key, label]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2">${label}</td>
        <td class="border p-2">
          <input type="text" class="w-full p-1 border rounded"
                 value="${
                   mode === "base"
                     ? state.staticBase[key]
                     : state.staticComp[key]
                 }">
        </td>`;
      tr.querySelector("input").addEventListener("input", (e) => {
        if (mode === "base") state.staticBase[key] = e.target.value;
        else state.staticComp[key] = e.target.value;
      });
      staticTbody.appendChild(tr);
    });
  }

  // 8) Render custom
  function renderCustom() {
    customDiv.innerHTML = "";
    const arr = mode === "base" ? state.customBase : state.customComp;
    arr.forEach((field, i) => {
      const w = document.createElement("div");
      w.className = "mb-3";
      w.innerHTML = `
        <div class="font-medium mb-1">${field.label}</div>
        <input type="text" class="w-full p-2 border rounded" value="${field.value}">`;
      w.querySelector("input").addEventListener("input", (e) => {
        arr[i].value = e.target.value;
      });
      customDiv.appendChild(w);
    });
  }

  // 9) Fetch data (use HTTP URL)
  (async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/api/forms/balance-sheet/get?company=${encodeURIComponent(
          company
        )}&baseYear=${baseYear}&comparisonYear=${comparisonYear}`
      );
      const { data } = await res.json();
      if (data) {
        const p = JSON.parse(data);
        state.staticBase = p.staticBase || state.staticBase;
        state.staticComp = p.staticComp || state.staticComp;
        state.customBase = p.customBase || [];
        state.customComp = p.customComp || [];
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
    renderStatic();
    renderCustom();
  })();

  // 10) Add custom
  addCustomBtn.addEventListener("click", () => {
    const label = newLabelIn.value.trim();
    if (!label) return;
    state.customBase.push({ label, value: "" });
    state.customComp.push({ label, value: "" });
    newLabelIn.value = "";
    renderCustom();
  });

  // 11) Save
  saveBtn.addEventListener("click", async () => {
    await fetch("http://localhost:3000/api/forms/balance-sheet/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        baseYear,
        comparisonYear,
        data: JSON.stringify({
          staticBase: state.staticBase,
          staticComp: state.staticComp,
          customBase: state.customBase,
          customComp: state.customComp,
        }),
      }),
    });
    alert("تم الحفظ");
  });

  // 12) Reset
  resetBtn.addEventListener("click", async () => {
    await fetch("http://localhost:3000/api/forms/balance-sheet/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, baseYear, comparisonYear }),
    });
    // clear state
    Object.keys(state.staticBase).forEach((k) => (state.staticBase[k] = ""));
    Object.keys(state.staticComp).forEach((k) => (state.staticComp[k] = ""));
    state.customBase = [];
    state.customComp = [];
    renderStatic();
    renderCustom();
    alert("تم إعادة الضبط");
  });
});
