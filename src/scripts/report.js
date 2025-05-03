// scripts/report.js

const comments = window.myAPI.comments;
const { showMessage } = window.electronAPI;

document.addEventListener("DOMContentLoaded", async () => {
  // Load saved settings
  const saved = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!saved) {
    await showMessage("الرجاء ضبط بيانات الشركة أولاً.", "خطأ");
    return (window.location.href = "companyData.html");
  }
  const { company, baseYear, comparisonYear } = saved;

  const backBtn = document.getElementById("back-btn");
  const container = document.getElementById("report-table-container");

  // Format ratio values
  function fmt(r) {
    if (!r) return "-";
    const v = r.value;
    const lbl = r.label;
    if (lbl.includes("السيولة") || lbl.includes("نسبة التداول")) {
      return v.toFixed(1);
    } else if (lbl.startsWith("نسبة") || lbl.includes("العائد")) {
      return (v * 100).toFixed(1) + "%";
    } else if (lbl.includes("فتره") || lbl.includes("الدورة")) {
      return v + " يوم";
    } else {
      return v.toFixed(2);
    }
  }

  // Generate comment
  function comment(cur, prev, key) {
    if (cur == null || prev == null) return "";
    const cmp =
      cur > prev
        ? comments[key]?.greater
        : cur < prev
        ? comments[key]?.less
        : comments[key]?.equals;
    return typeof cmp === "function" ? cmp(cur, prev, baseYear) : cmp || "";
  }

  // Render table
  function render({ base, comparison }) {
    const keys = Array.from(
      new Set([...Object.keys(base), ...Object.keys(comparison)])
    );
    let html = `
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse">
          <thead>
            <tr>
              <th class="border px-4 py-2 text-right">الوصف</th>
              <th class="border px-4 py-2 text-right">النتائج ${baseYear}</th>
              <th class="border px-4 py-2 text-right">النتائج ${comparisonYear}</th>
              <th class="border px-4 py-2 text-right">التعليق</th>
            </tr>
          </thead>
          <tbody>
    `;
    keys.forEach((key) => {
      const r1 = base[key] || null;
      const r2 = comparison[key] || null;
      // Skip if both are missing labels
      if (!r1?.label && !r2?.label) return;
      html += `
        <tr>
          <td class="border px-4 py-2">${(r1 || r2)?.label || key}</td>
          <td class="border px-4 py-2 text-right">${fmt(r1)}</td>
          <td class="border px-4 py-2 text-right">${fmt(r2)}</td>
          <td class="border px-4 py-2 text-right">
            ${comment(r1?.value, r2?.value, key)}
          </td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
  }

  // Fetch report
  async function fetchReport() {
    try {
      const res = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, baseYear, comparisonYear }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unknown");
      return json.report;
    } catch (err) {
      console.error("Error generating report:", err);
      await showMessage("خطأ في جلب التقرير.", "خطأ");
      return null;
    }
  }

  // Auto-generate on load
  const report = await fetchReport();
  if (report) render(report);

  // Back button
  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
});
