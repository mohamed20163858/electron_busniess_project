(async function () {
  const { showMessage } = window.electronAPI;

  // 1) Load settings + mode
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";
  const saved = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!saved) {
    showMessage("الرجاء ضبط بيانات الشركة أولاً.", "خطأ");
    return (window.location.href = "companyData.html");
  }
  const { company, baseYear, comparisonYear } = saved;
  const yearA = baseYear,
    yearB = comparisonYear;
  const year = mode === "base" ? yearA : yearB;

  // 2) Fill subheader
  document.getElementById(
    "subheader"
  ).textContent = `${company} — السنة ${year}`;

  // 3) Fetch report
  let report;
  try {
    const res = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, baseYear, comparisonYear }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Unknown");
    report = json.report;
  } catch (err) {
    console.error(err);
    showMessage("خطأ في جلب التقرير.", "خطأ");
    return;
  }

  const { base, comparison } = report;

  // 4) Helpers
  function fmt(r) {
    if (!r) return "-";
    const v = r.value,
      l = r.label;
    if (l.includes("السيولة") || l.includes("نسبة التداول"))
      return v.toFixed(1);
    if (l.startsWith("نسبة") || l.includes("العائد"))
      return (v * 100).toFixed(1) + "%";
    if (l.includes("فتره") || l.includes("الدورة")) return v + " يوم";
    return v.toFixed(2);
  }
  function cm(cur, prev, key) {
    if (cur == null || prev == null) return "";
    const cmp =
      cur > prev
        ? window.myAPI.comments[key]?.greater
        : cur < prev
        ? window.myAPI.comments[key]?.less
        : window.myAPI.comments[key]?.equals;
    return typeof cmp === "function" ? cmp(cur, prev, baseYear) : cmp || "";
  }
  function idx(k) {
    const m = k.match(/^ratio(\d+)$/);
    return m ? +m[1] : Infinity;
  }

  // 5) bucket keys
  const all = Array.from(
    new Set([...Object.keys(base), ...Object.keys(comparison)])
  ).filter((k) => base[k]?.label || comparison[k]?.label);
  const buckets = { debt: [], liquidity: [], activity: [], profitability: [] };
  all.forEach((k) => {
    const n = idx(k);
    if (n >= 1 && n <= 6) buckets.debt.push(k);
    else if (n >= 7 && n <= 15) buckets.liquidity.push(k);
    else if (n >= 16 && n <= 27) buckets.activity.push(k);
    else if (n >= 28) buckets.profitability.push(k);
  });
  const titles = {
    debt: "نسب المديونية",
    liquidity: "نسب السيولة",
    activity: "نسب النشاط",
    profitability: "نسب الربحية",
  };

  // 6) Render subtables
  let html = "";
  for (let section of ["debt", "liquidity", "activity", "profitability"]) {
    const keys = buckets[section];
    if (!keys.length) continue;
    html += `<h2 class="text-xl font-semibold mt-4 mb-2">${titles[section]}</h2>`;
    html += `
        <table class="min-w-[90%] border-collapse mb-6">
          <thead>
            <tr>
              <th class="border px-4 py-2 text-right ">الوصف</th>
              <th class="border px-4 py-2 text-right ">${yearA}</th>
              <th class="border px-4 py-2 text-right ">${yearB}</th>
              <th class="border px-4 py-2 text-right ">التعليق</th>
            </tr>
          </thead>
          <tbody>
      `;
    keys.forEach((key) => {
      const r1 = base[key],
        r2 = comparison[key];
      html += `
          <tr>
            <td class="border px-4 py-2">${(r1 || r2).label}</td>
            <td class="border px-4 py-2 text-right">${fmt(r1)}</td>
            <td class="border px-4 py-2 text-right">${fmt(r2)}</td>
            <td class="border px-4 py-2 text-right">${cm(
              r1?.value,
              r2?.value,
              key
            )}</td>
          </tr>
        `;
    });
    html += `</tbody></table>`;
  }
  document.getElementById("content").innerHTML = html;

  // 7) Wire buttons
  document.getElementById("print-btn").addEventListener("click", async () => {
    const pdf = await window.electronAPI.exportPDF();
    await window.electronAPI.savePDF(pdf);
    //window.print();
  });
  document.getElementById("back-btn").addEventListener("click", () => {
    window.history.back();
  });
})();
