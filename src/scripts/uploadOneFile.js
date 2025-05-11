// scripts/uploadOneFile.js

document.addEventListener("DOMContentLoaded", () => {
  const { showMessage } = window.electronAPI;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "comp" ? "comp" : "base";

  // 1) Load comparison settings
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (!settings) return void (window.location.href = "companyData.html");
  const { company, baseYear, comparisonYear } = settings;
  const year = mode === "base" ? baseYear : comparisonYear;
  console.log("Mode:", mode, "Company:", company, "Year:", year);

  // 2) DOM references
  const fileInput = document.getElementById("excel-file");
  const fileNameSpan = document.getElementById("file-name");
  const uploadBtn = document.getElementById("upload-btn");
  const statusDiv = document.getElementById("status");

  fileInput.addEventListener("change", function () {
    const fileName = this.files[0]?.name || "No file chosen";
    fileNameSpan.textContent = `${fileName} Added`;
  });

  // 3) Sheet → form configuration
  const sheetMap = {
    "قائمة المركز المالى": {
      formName: "balance-sheet",
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
    "قائمة الدخل": {
      formName: "income-statement",
      staticFields: {
        operatingProfit: [
          "الربح التشغيلي",
          "ربح تشغيلى",
          "نتائج أنشطه التشغيل",
        ],
        benefit: ["الفائدة", "فوائد"],
        rent: ["الإيجار", "ايجار"],
        fixedCommitments: [
          "الالتزامات الثابتة",
          "التزامات ثابتة",
          "مصروفات ثابته",
          "المصروفات الثابته",
          "المصروفات ثابتة",
        ],
        netSell: ["صافي المبيعات", "صافى المبيعات"],
        futureNetSales: [
          "صافي المبيعات الآجلة",
          "صافى المبيعات الآجلة",
          "مبيعات آجله",
          "المبيعات الآجلة",
        ],
        costSales: ["تكلفة المبيعات", "تكلفه المبيعات"],
        totalProfit: ["إجمالي الربح", "اجمالي الربح", "مجمل الربح"],
        netYearProfit: ["صافي الربح السنوي", "صافى ربح السنه"],
      },
    },
    "قائمة التدفقات النقدية": {
      formName: "cash-flow",
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

  // 4) Normalize Arabic letters for matching
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

  // 5) Build a normalized lookup from sheetMap
  const sheetLookup = {};
  for (const rawName in sheetMap) {
    sheetLookup[normalizeArabic(rawName)] = sheetMap[rawName];
  }

  // 6) Levenshtein distance for fuzzy match
  function levenshtein(a, b) {
    const m = a.length,
      n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  // 7) Find the closest static‐field key
  function findClosestMatch(label, staticFields) {
    const normLabel = normalizeArabic(label);
    let bestKey = null,
      bestDist = Infinity;
    for (const [key, variants] of Object.entries(staticFields)) {
      for (const v of variants) {
        const d = levenshtein(normLabel, normalizeArabic(v));
        if (d < bestDist) {
          bestDist = d;
          bestKey = key;
        }
      }
    }
    return bestDist <= 2 ? bestKey : null;
  }

  // 8) Date‐pattern recognizer
  const DATE_RE = /^\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*$/;

  // 9) Upload button logic
  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      await showMessage("الرجاء اختيار ملف Excel أولاً.", "خطأ");
      return;
    }
    statusDiv.textContent = "جارٍ المعالجة...";

    try {
      const readXlsxFile = window.readXlsxFile;
      const sheets = await readXlsxFile(file, { getSheets: true });
      console.log(
        "Sheets found:",
        sheets.map((s) => s.name)
      );

      for (const { name: rawSheet } of sheets) {
        const cfg = sheetLookup[normalizeArabic(rawSheet)];
        if (!cfg) {
          console.log("Skipping un-configured sheet:", rawSheet);
          continue;
        }

        console.log("Processing sheet:", rawSheet);
        const rows = await readXlsxFile(file, { sheet: rawSheet });
        console.log(` Rows:`, rows.length);

        // prepare containers
        const parsedStatic = {};
        Object.keys(cfg.staticFields).forEach((k) => (parsedStatic[k] = ""));
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

          const [labelRaw, rawValue] = filled;
          const label = String(labelRaw || "").trim();
          if (!label || !rawValue) continue;

          //  — skip exactly "البند"
          if (label === "البند" || label === "الحساب") {
            console.log(`  Skipping header row "البند"`);
            continue;
          }

          //  — skip any obvious date
          if (DATE_RE.test(labelRaw)) {
            console.log(`  Skipping date‐label row: "${labelRaw}"`);
            continue;
          }

          //  — parse numeric (floats, ints)
          let num;
          if (typeof rawValue === "number") {
            num = rawValue;
          } else {
            num = parseFloat(String(rawValue).replace(/,/g, ""));
          }
          if (isNaN(num)) {
            console.log(`  Skipping non-numeric: "${rawValue}"`);
            continue;
          }

          //  — force positive
          num = Math.abs(num);

          console.log(`  Row ${i}: "${label}" =`, num);

          const key = findClosestMatch(label, cfg.staticFields);
          if (key) {
            parsedStatic[key] = num;
          } else {
            console.warn("    No match for:", label);
            customArr.push({ label, value: num });
          }
        }

        console.log(" ParsedStatic:", parsedStatic, "Custom:", customArr);
        const resp = await fetch(
          `http://localhost:3000/api/forms/${cfg.formName}/save`,
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
        console.log(`  → Saved ${cfg.formName}: HTTP ${resp.status}`);
        if (!resp.ok) {
          throw new Error(`Save failed for ${cfg.formName}`);
        }
      }

      statusDiv.textContent = "";
      await showMessage("تم رفع ومعالجة جميع الجداول بنجاح", "نجاح");
    } catch (err) {
      console.error("Upload error:", err);
      statusDiv.textContent = "";
      await showMessage(`خطأ أثناء المعالجة: ${err.message}`, "خطأ");
    }
  });
});
