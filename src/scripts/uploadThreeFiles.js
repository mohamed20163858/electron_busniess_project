// scripts/uploadThreeFiles.js

document.addEventListener("DOMContentLoaded", () => {
  const { showMessage } = window.electronAPI;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";

  // 1) Load settings
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) return void (window.location.href = "companyData.html");
  const { company, baseYear, comparisonYear } = settings;
  const year = mode === "base" ? baseYear : comparisonYear;

  // 2) DOM refs
  const inputs = {
    "balance-sheet": document.getElementById("file-bs"),
    "income-statement": document.getElementById("file-is"),
    "cash-flow": document.getElementById("file-cf"),
  };
  const uploadBtn = document.getElementById("upload-btn");
  const statusDiv = document.getElementById("status");

  // 3) Per-form static fields
  const sheetMap = {
    "balance-sheet": {
      staticFields: {
        totalAssets: ["اجمالي الأصول", "اجمالى الاصول"],
        totalDebits: ["اجمالي الالتزمات", "اجمالى الالتزامات"],
        currentAssets: ["الأصول المتداولة", "الاصول المتداولة"],
        currentDebits: ["الالتزامات المتداولة", "الالتزامات المتداوله"],
        inventory: ["المخزون", "مخزون"],
        totalContributersRights: ["اجمالي حقوق الملكية", "حقوق الملكيه"],
        totalFixedAssets: ["اجمالي الأصول الثابتة", "أصول ثابتة"],
        clientsAndOtherDebits: [
          "العملاء وارصده مدينة أخرى",
          "عملاء وأرصده مدينة اخرى",
        ],
        creditorsAndOtherCredits: [
          "دائنون و أرصدة دائنة أخرى",
          "دائنون وأرصده دائنه اخرى",
        ],
      },
    },
    "income-statement": {
      staticFields: {
        operatingProfit: [
          "الربح التشغيلي",
          "ربح تشغيلى",
          "نتائج أنشطه التشغيل",
        ],
        benefit: ["الفائدة", "فوائد"],
        rent: ["الإيجار", "ايجار"],
        fixedCommitments: ["الالتزامات الثابتة", "التزامات ثابتة"],
        netSell: ["صافي المبيعات", "صافى المبيعات"],
        futureNetSales: ["صافي المبيعات الآجلة", "صافى المبيعات الآجلة"],
        costSales: ["تكلفة المبيعات", "تكلفه المبيعات"],
        totalProfit: ["إجمالي الربح", "اجمالي الربح", "مجمل الربح"],
        netYearProfit: ["صافي الربح السنوي", "صافى ربح السنه"],
      },
    },
    "cash-flow": {
      staticFields: {
        netOperatingCashFlow: [
          "صافي التدفقات النقدية التشغيلية",
          "التدفقات النقدية التشغيلية",
          "صافي التدفقات النقدية من الأنشطة التشغيلية",
        ],
        netCashFlowAndSimilar: [
          "صافي التدفقات النقدية وما في حكمها",
          "النقدية وما في حكمها",
        ],
      },
    },
  };

  // 4) Arabic normalize
  function normalizeArabic(s) {
    return (s || "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[^ء-ي]/g, "")
      .trim();
  }

  // 5) Fuzzy match via Levenshtein
  function levenshtein(a, b) {
    const m = a.length,
      n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + c
        );
      }
    }
    return dp[m][n];
  }

  // 6) Pick best static key
  function findClosestMatch(label, variantsMap) {
    const norm = normalizeArabic(label);
    let best = null,
      dist = Infinity;
    for (const [key, variants] of Object.entries(variantsMap)) {
      for (const v of variants) {
        const d = levenshtein(norm, normalizeArabic(v));
        if (d < dist) {
          dist = d;
          best = key;
        }
      }
    }
    return dist <= 2 ? best : null;
  }

  // 7) Date regex
  const DATE_RE = /^\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*$/;

  // 8) Core per-file processor
  async function processFile(formName, file) {
    const read = window.readXlsxFile;
    const rows = await read(file);
    console.log(`→ ${formName} rows`, rows);
    // prepare
    const parsedStatic = {};
    const variants = sheetMap[formName].staticFields;
    Object.keys(variants).forEach((k) => (parsedStatic[k] = ""));
    const customArr = [];

    for (let i = 1; i < rows.length; i++) {
      // take the row, remove any null/undefined/empty‐string cells …
      const filled = rows[i].filter(
        (cell) =>
          cell !== null && cell !== undefined && String(cell).trim() !== ""
      );
      // … and only proceed if we now have at least two columns
      if (filled.length < 2) {
        console.log(
          `  Row ${i} skipped – fewer than 2 columns after filtering.`
        );
        continue;
      }

      const [lab, val] = filled;
      const label = String(lab || "").trim();
      if (!label || !val) continue;
      if (label === "البند" || label === "الحساب") continue;
      if (DATE_RE.test(label)) continue;

      // numeric?
      let num =
        typeof val === "number"
          ? val
          : parseFloat(String(val).replace(/,/g, ""));
      if (isNaN(num)) continue;
      num = Math.abs(num);

      const key = findClosestMatch(label, variants);
      if (key) {
        parsedStatic[key] = num;
      } else {
        customArr.push({ label, value: num });
      }
    }

    // save
    const res = await fetch(
      `http://localhost:3000/api/forms/${formName}/save`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          year,
          data: JSON.stringify({ static: parsedStatic, custom: customArr }),
        }),
      }
    );
    if (!res.ok) throw new Error(`${formName} save failed`);
  }

  // 9) Wire up upload
  uploadBtn.addEventListener("click", async () => {
    statusDiv.textContent = "جارٍ المعالجة...";
    try {
      for (const formName of Object.keys(inputs)) {
        const file = inputs[formName].files[0];
        if (!file) {
          throw new Error(`الرجاء اختيار ملف لـ ${formName}`);
        }
        console.log(`→ Processing ${formName}`);
        await processFile(formName, file);
      }
      statusDiv.textContent = "";
      await showMessage("تم رفع ومعالجة الثلاثة ملفات بنجاح", "نجاح");
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "";
      await showMessage(`خطأ: ${err.message}`, "خطأ");
    }
  });
});
