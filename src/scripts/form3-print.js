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

  // 3) Fetch the cash-flow data
  let data;
  try {
    const res = await fetch(
      `http://localhost:3000/api/forms/cash-flow/get?company=${encodeURIComponent(
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
  const staticFields = {
    netOperatingCashFlow: "صافي التدفقات النقدية التشغيلية",
    meta1: "صافي التدفقات النقدية الاستثمارية",
    meta2: "صافي التدفقات النقدية التمويلية",
    meta3: "التغير في التدفقات النقدية",
    // to be added in balance sheet instead of here
    // netCashFlowAndSimilar: "صافي التدفقات النقدية وما في حكمها",
  };

  for (let [key, label] of Object.entries(staticFields)) {
    const val = statics[key];
    if (val == null || val === "") continue;
    html += `
        <tr>
          <td class="border px-4 py-2 text-right">${label}</td>
          <td class="border px-4 py-2 text-right">${val}</td>
        </tr>
      `;
  }

  // custom fields
  if (custom.length) {
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
    //   window.print();
    const pdf = await window.electronAPI.exportPDF();
    await window.electronAPI.savePDF(pdf);
  });
  document.getElementById("back-btn").addEventListener("click", () => {
    window.history.back();
  });
})();
