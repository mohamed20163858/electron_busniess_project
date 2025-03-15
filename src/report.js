// const { comments } = require("../lib/comments.js");
const comments = window.myAPI.comments;

document.addEventListener("DOMContentLoaded", function () {
  // Local state variables
  let year = "";
  let yearFetched = "";
  let company = "";
  let reportCurrent = null;
  let reportPrevious = null;
  let companySuggestions = [];

  // Cache DOM elements
  const yearSelect = document.getElementById("year-select");
  const companyInput = document.getElementById("company-input");
  const companiesDatalist = document.getElementById("companies");
  const generateBtn = document.getElementById("generate-btn");
  const backBtn = document.getElementById("back-btn");
  const reportTableContainer = document.getElementById(
    "report-table-container"
  );

  // Populate year select with the last 150 years
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 150; i++) {
    const y = currentYear - i;
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearSelect.appendChild(option);
  }

  // Fetch company suggestions for autocomplete
  function fetchCompanies() {
    fetch("http://localhost:3000/api/companies")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        companySuggestions = data;
        companiesDatalist.innerHTML = "";
        data.forEach((c) => {
          const option = document.createElement("option");
          option.value = c;
          companiesDatalist.appendChild(option);
        });
      })
      .catch((err) => console.error("Error fetching companies:", err));
  }
  fetchCompanies();

  // Update local state from inputs
  yearSelect.addEventListener("change", function (e) {
    year = e.target.value;
  });
  companyInput.addEventListener("input", function (e) {
    company = e.target.value;
  });

  // Format ratio values based on the label
  function getFormattedValue(ratio) {
    if (!ratio) return "-";
    if (
      ratio.label.startsWith("نسبة") ||
      ratio.label.startsWith("السيولة") ||
      ratio.label.includes("العائد")
    ) {
      return (ratio.value * 100).toFixed(1) + "%";
    } else if (ratio.label.includes("فتره") || ratio.label.includes("الدورة")) {
      return ratio.value + " يوم";
    } else {
      return ratio.value.toFixed(2);
    }
  }

  // Generate comment based on current and previous values
  function generateComment(currentValue, previousValue, key) {
    if (currentValue === undefined || previousValue === undefined) {
      return "";
    } else if (currentValue > previousValue) {
      const comment =
        (comments[key] && comments[key].greater) || comments.default.greater;
      return typeof comment === "function"
        ? comment(currentValue, previousValue, Number(yearFetched))
        : comment;
    } else if (currentValue < previousValue) {
      const comment =
        (comments[key] && comments[key].less) || comments.default.less;
      return typeof comment === "function"
        ? comment(currentValue, previousValue, Number(yearFetched))
        : comment;
    } else {
      return (comments[key] && comments[key].equals) || comments.default.equals;
    }
  }

  // Get the union of ratio keys from both reports
  function getRatioKeys() {
    const keysCurrent = reportCurrent ? Object.keys(reportCurrent.ratios) : [];
    const keysPrevious = reportPrevious
      ? Object.keys(reportPrevious.ratios)
      : [];
    return Array.from(new Set([...keysCurrent, ...keysPrevious]));
  }

  // Render the report table if data is available
  function renderReportTable() {
    if (!reportCurrent && !reportPrevious) {
      reportTableContainer.innerHTML = "";
      return;
    }
    let html = `
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr>
            <th class="border px-4 py-2 text-right">الوصف</th>
            <th class="border px-4 py-2 text-right">النتيجة للسنة ${yearFetched}</th>
            <th class="border px-4 py-2 text-right">النتيجة للسنة ${
              Number(yearFetched) - 1
            }</th>
            <th class="border px-4 py-2 text-right">التعليق</th>
          </tr>
        </thead>
        <tbody>
  `;
    const ratioKeys = getRatioKeys();
    ratioKeys.forEach((ratioKey) => {
      const ratioCurrent = reportCurrent
        ? reportCurrent.ratios[ratioKey]
        : null;
      const ratioPrevious = reportPrevious
        ? reportPrevious.ratios[ratioKey]
        : null;
      html += `
      <tr>
        <td class="border px-4 py-2">${
          (ratioCurrent && ratioCurrent.label) ||
          (ratioPrevious && ratioPrevious.label) ||
          ratioKey
        }</td>
        <td class="border px-4 py-2 text-right">${getFormattedValue(
          ratioCurrent
        )}</td>
        <td class="border px-4 py-2 text-right">${getFormattedValue(
          ratioPrevious
        )}</td>
        <td class="border px-4 py-2 text-right">${generateComment(
          ratioCurrent ? ratioCurrent.value : undefined,
          ratioPrevious ? ratioPrevious.value : undefined,
          ratioKey
        )}</td>
      </tr>
    `;
    });
    html += `
        </tbody>
      </table>
    </div>
  `;
    reportTableContainer.innerHTML = html;
  }

  // Handle generating the report
  generateBtn.addEventListener("click", async function () {
    if (!year || !company) {
      alert("يرجى اختيار السنة واسم الشركة.");
      return;
    }
    // Helper function to fetch report data
    async function fetchReport(reportYear) {
      const res = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: reportYear, company }),
      });
      return res.ok ? res.json() : null;
    }
    // Fetch current year report
    const dataCurrent = await fetchReport(year);
    if (dataCurrent && dataCurrent.success) {
      reportCurrent = dataCurrent.report;
      yearFetched = year;
    } else {
      alert("خطأ في جلب التقرير للسنة المحددة.");
      return;
    }
    // Fetch previous year report
    const previousYear = String(Number(year) - 1);
    const dataPrevious = await fetchReport(previousYear);
    if (dataPrevious && dataPrevious.success) {
      reportPrevious = dataPrevious.report;
    } else {
      alert("خطأ في جلب تقرير السنة السابقة.");
    }
    renderReportTable();
  });

  // Back button navigates to the main view (index.html)
  backBtn.addEventListener("click", function () {
    window.location.href = "index.html";
  });
});
