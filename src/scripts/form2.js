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

  // 3) Year and header
  const year = mode === "base" ? baseYear : comparisonYear;
  document.getElementById("col-header").textContent = year;

  // 4) Static fields
  const staticFields = {
    netSell: "صافي المبيعات",
    futureNetSales: " المبيعات الآجلة",
    costSales: "تكلفة المبيعات",
    totalProfit: "مجمل الربح",
    rent: "الإيجار",
    fixedCommitments: "المصروفات الثابتة",
    operatingProfit: "الربح التشغيلي",
    benefit: "الفائدة",
    netYearProfit: "صافي الربح السنوي",
  };

  // 5) State
  const state = { staticValue: {}, customFields: [] };
  Object.keys(staticFields).forEach((k) => (state.staticValue[k] = ""));

  // 6) DOM refs
  const tbody = document.getElementById("fields-container");
  const newCustomIn = document.getElementById("new-custom-label");
  const addCustomBtn = document.getElementById("add-custom-btn");
  const saveBtn = document.getElementById("save-btn");
  const printBtn = document.getElementById("print-btn");
  const resetBtn = document.getElementById("reset-btn");

  const backBtn = document.getElementById("back-btn");

  backBtn.addEventListener("click", () => history.back());
  // print functionality
  printBtn.addEventListener("click", () => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (!mode) {
      console.error("cannot print without mode");
      return showMessage("حدث خطأ أثناء معاينة الطباعة", "خطأ");
    }
    window.location.href = `form2-print.html?mode=${mode}`;
  });

  // --- (new) wire up “Export to Excel” button ---
  const exportBtn = document.getElementById("export-btn");
  exportBtn.addEventListener("click", async () => {
    // 1) Grab the table in your #bs-form container
    const table = document.querySelector("#is-form table");
    if (!table) return;

    // 2) Build the header row
    const headers = Array.from(table.querySelectorAll("thead th"))
      .map((th) => th.textContent.trim())
      .reverse();

    console.log("headers", headers);

    // 3) Build the data rows
    const rows = Array.from(table.querySelectorAll("tbody tr"))
      .map((tr) =>
        Array.from(tr.querySelectorAll("td"))
          .map((td) => {
            const input = td.querySelector("input");
            return input ? input.value.trim() : td.textContent.trim();
          })
          .reverse()
      )
      .filter((r) => {
        const [label, value] = r;
        if (!label || !value) return false;
        return true;
      }); // filter out empty rows
    console.log("rows", rows);

    // 4) Delegate to main via preload
    const { canceled, filePath } = await window.electronAPI.exportExcel(
      "قائمة الدخل",
      headers,
      rows,
      `IncomeStatement_${company}_${year}.xlsx`
    );

    if (!canceled) {
      window.electronAPI.showMessage(`تم الحفظ في:\n${filePath}`, "نجاح");
    }
  });

  // 7) Render all rows
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
        </td>
        
      `;
      tr.querySelector("input").addEventListener("input", (e) => {
        state.staticValue[key] = e.target.value;
      });
      tbody.appendChild(tr);
    }

    // 7b) separator
    const sep = document.createElement("tr");
    sep.innerHTML = `<td colspan="2" class="border-t"></td>`;
    tbody.appendChild(sep);

    // 7c) custom rows with delete
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
        </td>
        
          <button
            type="button"
            data-index="${i}"
            class="bg-red-500 text-white px-4 py-2 rounded mt-2 mr-2 cursor-pointer"
          >
            حذف
          </button>
        
      `;
      const [labIn, valIn] = tr.querySelectorAll("input");
      labIn.addEventListener("input", (e) => {
        state.customFields[i].label = e.target.value;
      });
      valIn.addEventListener("input", (e) => {
        state.customFields[i].value = e.target.value;
      });

      // **delete handler**: remove from state **and** resave to DB
      tr.querySelector("button").addEventListener("click", async (e) => {
        const idx = Number(e.currentTarget.dataset.index);
        state.customFields.splice(idx, 1);
        renderAll();

        // Immediately persist the deletion
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
        } catch (err) {
          console.error("Error saving after delete:", err);
          await showMessage("حدث خطأ أثناء حذف الحقل", "خطأ");
        }
      });

      tbody.appendChild(tr);
    });
  }

  // 8) Fetch existing data
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
