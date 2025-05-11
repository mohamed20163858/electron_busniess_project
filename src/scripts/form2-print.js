// Form 2 print script for the income statement form ./src/form2-print.js
(async function () {
  // 1) Read mode & settings
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) {
    showMessage("الرجاء ضبط بيانات الشركة أولاً.", "خطأ");
    return (window.location.href = "companyData.html");
  }
  const { company, baseYear, comparisonYear } = settings;
  const year = mode === "base" ? baseYear : comparisonYear;

  // 2) Update subheader
  document.getElementById(
    "subheader"
  ).textContent = `${company} — السنة ${year}`;

  // 3) Fetch the data
  let data;
  try {
    const res = await fetch(
      `http://localhost:3000/api/forms/income-statement/get?company=${encodeURIComponent(
        company
      )}&year=${year}`
    );
    const json = await res.json();
    data = json.data ? JSON.parse(json.data) : { static: {}, custom: [] };
  } catch (e) {
    console.error(e);
    showMessage("خطأ في جلب البيانات للمعاينة.", "خطأ");
    return;
  }

  // 4) Build table HTML
  const { static: statics = {}, custom = [] } = data;
  let html = `
      <table class="min-w-full border-collapse">
        <thead>
          <tr>
            <th class="border px-4 py-2 text-right">البند</th>
            <th class="border px-4 py-2 text-right">القيمة</th>
          </tr>
        </thead>
        <tbody>
    `;

  // static fields first
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

  for (let [key, label] of Object.entries(staticFields)) {
    const val = statics[key];
    if (!val) continue; // skip if not present
    html += `
        <tr>
          <td class="border px-4 py-2 text-right">${label}</td>
          <td class="border px-4 py-2 text-right">${
            val != null ? val : "-"
          }</td>
        </tr>
      `;
  }

  // custom fields
  if (custom.length) {
    // html += `<tr><td colspan="2" class="py-4"></td></tr>`;
    for (let f of custom) {
      html += `
          <tr>
            <td class="border px-4 py-2 text-right">${f.label}</td>
            <td class="border px-4 py-2 text-right">${f.value}</td>
          </tr>
        `;
    }
  }

  html += `</tbody></table>`;
  document.getElementById("table-container").innerHTML = html;

  // 5) Wire up buttons
  document.getElementById("print-btn").addEventListener("click", async () => {
    // window.print();
    const pdf = await window.electronAPI.exportPDF();
    await window.electronAPI.savePDF(pdf);
    // window.close();
  });
  document.getElementById("back-btn").addEventListener("click", () => {
    window.history.back();
  });
})();
