// lib/database.js
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const { app } = require("electron");

let db;

async function initDb() {
  if (!db) {
    db = await open({
      filename: path.join(app.getPath("userData"), "business.db"),
      driver: sqlite3.Database,
    });

    // For development: drop old tables to reset schema
    // await db.exec(`DROP TABLE IF EXISTS balance_sheet;`);
    // await db.exec(`DROP TABLE IF EXISTS income_statement;`);
    // await db.exec(`DROP TABLE IF EXISTS cash_flow;`);
    // await db.exec(`DROP TABLE IF EXISTS comparisons;`);

    // Enable foreign keys
    await db.exec("PRAGMA foreign_keys = ON");
    // Create tables individually to avoid multi-statement parsing issues
    await db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        base_year TEXT NOT NULL,
        comparison_year TEXT NOT NULL,
        UNIQUE(company_id, base_year, comparison_year)
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS balance_sheet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        year       TEXT    NOT NULL,
        data TEXT
      )
    `);
    // Create other form tables similarly
    await db.exec(`
      CREATE TABLE IF NOT EXISTS income_statement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        year       TEXT    NOT NULL,
        data TEXT
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cash_flow (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        year       TEXT    NOT NULL,
        data TEXT
      )
    `);
  }
  return db;
}

function getTableName(form) {
  if (form === "balance-sheet") return "balance_sheet";
  if (form === "income-statement") return "income_statement";
  if (form === "cash-flow") return "cash_flow";
  // console.log(form);
  throw new Error("Unsupported form type: " + form);
}

async function resolveComparison(company, baseYear, comparisonYear) {
  const db = await initDb();
  // ensure company exists
  let row = await db.get("SELECT id FROM companies WHERE name = ?", [company]);
  if (!row) {
    const res = await db.run("INSERT INTO companies (name) VALUES (?)", [
      company,
    ]);
    row = { id: res.lastID };
  }
  // lookup or insert comparison
  const cmp = await db.get(
    `SELECT id FROM comparisons
       WHERE company_id = ? AND base_year = ? AND comparison_year = ?`,
    [row.id, baseYear, comparisonYear]
  );
  if (cmp) return cmp.id;
  const result = await db.run(
    `INSERT INTO comparisons (company_id, base_year, comparison_year)
       VALUES (?, ?, ?)`,
    [row.id, baseYear, comparisonYear]
  );
  return result.lastID;
}

async function saveFormData(form, { company, year, data: jsonData }) {
  const db = await initDb();
  // ensure company
  let { id: company_id } =
    (await db.get(`SELECT id FROM companies WHERE name = ?`, [company])) ||
    (await db
      .run(`INSERT INTO companies (name) VALUES (?)`, [company])
      .then((r) => ({ id: r.lastID })));

  const table = getTableName(form);
  // insert or replace latest for (company, year)
  // you could also DELETE old, then INSERT
  await db.run(
    `INSERT INTO ${table} (company_id, year, data)
       VALUES (?, ?, ?)`,
    [company_id, year, jsonData]
  );
}

// async function getFormDataByYearAndCompany(
//   form,
//   baseYear,
//   comparisonYear,
//   company
// ) {
//   const db = await initDb();
//   const table = getTableName(form);
//   const cmp = await db.get(
//     `SELECT c.id FROM comparisons c
//        JOIN companies co ON co.id = c.company_id
//       WHERE co.name = ? AND c.base_year = ? AND c.comparison_year = ?
//       ORDER BY c.id DESC LIMIT 1`,
//     [company, baseYear, comparisonYear]
//   );
//   if (!cmp) return null;
//   return await db.get(
//     `SELECT t.*, co.name AS company,
//             c.base_year, c.comparison_year
//        FROM ${table} t
//        JOIN comparisons c ON c.id = t.comparison_id
//        JOIN companies co ON co.id = c.company_id
//       WHERE t.comparison_id = ?
//       ORDER BY t.id DESC LIMIT 1`,
//     [cmp.id]
//   );
// }

// Simplified: just fetch the latest data blob for the comparison_id
async function getFormDataByYearAndCompany(form, year, company) {
  const db = await initDb();
  const table = getTableName(form);
  const row = await db.get(
    `SELECT t.data
       FROM ${table} t
       JOIN companies c ON c.id = t.company_id
      WHERE c.name = ? AND t.year = ?
      ORDER BY t.id DESC LIMIT 1`,
    [company, year]
  );
  return row ? { data: row.data } : null;
}

async function resetFormData(form, year, company) {
  const db = await initDb();
  const table = getTableName(form);
  await db.run(
    `DELETE FROM ${table}
      WHERE company_id = (SELECT id FROM companies WHERE name=?) 
        AND year = ?`,
    [company, year]
  );
}

async function getCompanies() {
  const db = await initDb();
  const rows = await db.all(`SELECT name FROM companies`);
  return rows.map((r) => r.name);
}

/**
 * Given three “static” data objects from:
 *  - balance sheet (`balance`),
 *  - income statement (`income`),
 *  - cash flow (`cash`),
 * compute and return all ratios 1 through 34.
 *
 * @param {Object} balance  — balanceSheetParsed.static
 * @param {Object} income   — incomeStatementParsed.static
 * @param {Object} cash     — cashFlowParsed.static
 * @returns {Object} ratios — an object with keys ratio1…ratio34 (or null)
 */
function computeRatios(balance, income, cash) {
  const ratios = {};

  // 1. نسبة اجمالي الديون إلى اجمالي الأصول
  ratios.ratio1 =
    balance.totalAssets && balance.totalDebits
      ? {
          label: "نسبة اجمالي الديون إلى اجمالي الأصول",
          value: Number(balance.totalDebits) / Number(balance.totalAssets),
        }
      : null;

  // 2. نسبة اجمالي الديون إلي اجمالي حقوق الملكية
  ratios.ratio2 =
    balance.totalContributersRights && balance.totalDebits
      ? {
          label: "نسبة اجمالي الديون إلي اجمالي حقوق الملكية",
          value:
            Number(balance.totalDebits) /
            Number(balance.totalContributersRights),
        }
      : null;

  // 3. نسبة اجمالي حقوق الملكية إلي اجمالي الأصول
  ratios.ratio3 =
    balance.totalContributersRights && balance.totalAssets
      ? {
          label: "نسبة اجمالي حقوق الملكية إلي اجمالي الأصول",
          value:
            Number(balance.totalContributersRights) /
            Number(balance.totalAssets),
        }
      : null;

  // 5. معدل تغطيه الفوائد
  ratios.ratio5 =
    income.operatingProfit && income.benefit
      ? {
          label: "معدل تغطيه الفوائد",
          value: Number(income.operatingProfit) / Number(income.benefit),
        }
      : null;

  // 6. معدل تغطيه الرسوم الثابتة
  ratios.ratio6 =
    income.operatingProfit && income.benefit && income.fixedCommitments
      ? {
          label: "معدل تغطيه الرسوم الثابتة",
          value:
            Number(income.operatingProfit) /
            (Number(income.benefit) + Number(income.fixedCommitments)),
        }
      : null;

  // 7. نسبة هيكل راس المال
  ratios.ratio7 =
    balance.totalContributersRights && balance.totalDebits
      ? {
          label: "نسبة هيكل راس المال",
          value:
            Number(balance.totalDebits) /
            (Number(balance.totalContributersRights) +
              Number(balance.totalDebits)),
        }
      : null;

  // 8. نسبة السيولة الحالية
  ratios.ratio8 =
    balance.currentAssets && balance.currentDebits
      ? {
          label: "نسبة السيولة الحالية",
          value: Number(balance.currentAssets) / Number(balance.currentDebits),
        }
      : null;

  // 9. نسبة السيولة السريعة
  ratios.ratio9 =
    balance.currentAssets && balance.currentDebits && balance.inventory
      ? {
          label: "نسبة السيولة السريعة",
          value:
            (Number(balance.currentAssets) - Number(balance.inventory)) /
            Number(balance.currentDebits),
        }
      : null;

  // 10. نسبة التداول
  ratios.ratio10 =
    income.netSell && balance.currentAssets
      ? {
          label: "نسبة التداول",
          value: Number(income.netSell) / Number(balance.currentAssets),
        }
      : null;

  // 11. نسبة السيولة التشغيلية
  ratios.ratio11 =
    cash.netOperatingCashFlow && balance.totalDebits
      ? {
          label: "نسبة السيولة التشغيلية",
          value:
            Number(cash.netOperatingCashFlow) / Number(balance.totalDebits),
        }
      : null;

  // 12. نسبة السيولة المالية
  ratios.ratio12 =
    balance.totalContributersRights && balance.totalDebits
      ? {
          label: "نسبة السيولة المالية",
          value:
            Number(balance.totalDebits) /
            Number(balance.totalContributersRights),
        }
      : null;

  // 13. السيولة من حقوق المساهمين
  ratios.ratio13 =
    balance.totalContributersRights && balance.totalDebits
      ? {
          label: "السيولة من حقوق المساهمين",
          value:
            Number(balance.totalContributersRights) /
            Number(balance.totalDebits),
        }
      : null;

  // 14. السيولة من الأصول الثابتة
  ratios.ratio14 =
    balance.totalFixedAssets && balance.totalDebits
      ? {
          label: "السيولة من الأصول الثابتة",
          value: Number(balance.totalFixedAssets) / Number(balance.totalDebits),
        }
      : null;

  // 15. السيولة من الأصول المتداولة
  ratios.ratio15 =
    balance.currentAssets && balance.totalDebits
      ? {
          label: "السيولة من الأصول المتداولة",
          value: Number(balance.currentAssets) / Number(balance.totalDebits),
        }
      : null;

  // 16. نسبة رأس المال العامل
  ratios.ratio16 =
    balance.currentAssets && balance.currentDebits && balance.totalAssets
      ? {
          label: "نسبة رأس المال العامل",
          value:
            (Number(balance.currentAssets) - Number(balance.currentDebits)) /
            Number(balance.totalAssets),
        }
      : null;

  // 17. معدل دوران الاصول
  ratios.ratio17 =
    income.netSell && balance.totalAssets
      ? {
          label: "معدل دوران الاصول",
          value: Number(income.netSell) / Number(balance.totalAssets),
        }
      : null;

  // 18. معدل دوران الاصول الثابتة
  ratios.ratio18 =
    income.netSell && balance.totalFixedAssets
      ? {
          label: "معدل دوران الاصول الثابتة",
          value: Number(income.netSell) / Number(balance.totalFixedAssets),
        }
      : null;

  // 19. معدل دوران الاصول المتداولة
  ratios.ratio19 =
    income.netSell && balance.currentAssets
      ? {
          label: "معدل دوران الاصول المتداولة",
          value: Number(income.netSell) / Number(balance.currentAssets),
        }
      : null;

  // 20. معدل دوران النقدية
  ratios.ratio20 =
    income.netSell && balance.netCashFlowAndSimilar
      ? {
          label: "معدل دوران النقدية",
          value: Number(income.netSell) / Number(balance.netCashFlowAndSimilar),
        }
      : null;

  // 21. معدل دوران أرصدة العملاء
  if (
    (income.futureNetSales || income.netSell) &&
    balance.clientsAndOtherDebits
  ) {
    const sales = income.futureNetSales || income.netSell;
    ratios.ratio21 = {
      label: "معدل دوران أرصدة العملاء",
      value: Number(sales) / Number(balance.clientsAndOtherDebits),
    };
  } else {
    ratios.ratio21 = null;
  }

  // 22. متوسط فتره التحصيل
  ratios.ratio22 = ratios.ratio21
    ? {
        label: "متوسط فتره التحصيل",
        value: Math.round(360 / ratios.ratio21.value),
      }
    : null;

  // 23. معدل دوران المخزون
  ratios.ratio23 =
    income.costSales && balance.inventory
      ? {
          label: "معدل دوران المخزون",
          value: Number(income.costSales) / Number(balance.inventory),
        }
      : null;

  // 24. متوسط فتره التخزين
  ratios.ratio24 = ratios.ratio23
    ? {
        label: "متوسط فتره التخزين",
        value: Math.round(360 / ratios.ratio23.value),
      }
    : null;

  // 25. طول الدورة التشغيلية
  ratios.ratio25 =
    ratios.ratio24 && ratios.ratio22
      ? {
          label: "طول الدورة التشغيلية",
          value: ratios.ratio24.value + ratios.ratio22.value,
        }
      : null;

  // 26. معدل دوران الدائنين
  ratios.ratio26 =
    income.costSales && balance.creditorsAndOtherCredits
      ? {
          label: "معدل دوران الدائنين",
          value:
            Number(income.costSales) / Number(balance.creditorsAndOtherCredits),
        }
      : null;

  // 27. متوسط فتره السداد
  ratios.ratio27 = ratios.ratio26
    ? {
        label: "متوسط فتره السداد",
        value: Math.round(360 / ratios.ratio26.value),
      }
    : null;

  // 28. طول الدورة التجارية
  ratios.ratio28 =
    ratios.ratio24 && ratios.ratio22 && ratios.ratio27
      ? {
          label: "طول الدورة التجارية",
          value:
            ratios.ratio24.value + ratios.ratio22.value - ratios.ratio27.value,
        }
      : null;

  // 29. نسبة هامش الربح الاجمالي
  ratios.ratio29 =
    income.totalProfit && income.netSell
      ? {
          label: "نسبة هامش الربح الاجمالي",
          value: Number(income.totalProfit) / Number(income.netSell),
        }
      : null;

  // 30. نسبة هامش الربح التشغيلي
  ratios.ratio30 =
    income.operatingProfit && income.netSell
      ? {
          label: "نسبة هامش الربح التشغيلي",
          value: Number(income.operatingProfit) / Number(income.netSell),
        }
      : null;

  // 31. نسبة هامش صافي الربح
  ratios.ratio31 =
    income.netYearProfit && income.netSell
      ? {
          label: "نسبة هامش صافي الربح",
          value: Number(income.netYearProfit) / Number(income.netSell),
        }
      : null;

  // 32. (ROA) العائد علي إجمالي الأصول
  ratios.ratio32 =
    income.netYearProfit && balance.totalAssets
      ? {
          label: "(ROA)العائد علي إجمالي الأصول",
          value: Number(income.netYearProfit) / Number(balance.totalAssets),
        }
      : null;

  // 33. (ROE) العائد علي حقوق الملكية
  ratios.ratio33 =
    income.netYearProfit && balance.totalContributersRights
      ? {
          label: "(ROE)العائد علي حقوق الملكية",
          value:
            Number(income.netYearProfit) /
            Number(balance.totalContributersRights),
        }
      : null;

  // 34. (ROS) العائد علي المبيعات
  ratios.ratio34 =
    income.netYearProfit && income.netSell
      ? {
          label: "(ROS)العائد علي المبيعات",
          value: Number(income.netYearProfit) / Number(income.netSell),
        }
      : null;

  return ratios;
}

/**
 * Fetches each form twice (base & comparison years),
 * parses the `.static` data, computes all ratios, and returns both sets.
 */
async function generateReport(baseYear, comparisonYear, company) {
  // 1) Fetch balance-sheet, income-statement, cash-flow for both years in parallel
  const [bsBaseRec, bsCompRec, insBaseRec, insCompRec, cfBaseRec, cfCompRec] =
    await Promise.all([
      getFormDataByYearAndCompany("balance-sheet", baseYear, company),
      getFormDataByYearAndCompany("balance-sheet", comparisonYear, company),
      getFormDataByYearAndCompany("income-statement", baseYear, company),
      getFormDataByYearAndCompany("income-statement", comparisonYear, company),
      getFormDataByYearAndCompany("cash-flow", baseYear, company),
      getFormDataByYearAndCompany("cash-flow", comparisonYear, company),
    ]);

  // 2) Safely parse .static or default to {}
  const bsBaseStatic = bsBaseRec?.data
    ? JSON.parse(bsBaseRec.data).static || {}
    : {};
  const bsCompStatic = bsCompRec?.data
    ? JSON.parse(bsCompRec.data).static || {}
    : {};
  const insBaseStatic = insBaseRec?.data
    ? JSON.parse(insBaseRec.data).static || {}
    : {};
  const insCompStatic = insCompRec?.data
    ? JSON.parse(insCompRec.data).static || {}
    : {};
  const cfBaseStatic = cfBaseRec?.data
    ? JSON.parse(cfBaseRec.data).static || {}
    : {};
  const cfCompStatic = cfCompRec?.data
    ? JSON.parse(cfCompRec.data).static || {}
    : {};

  // 3) Compute ratios for each
  const baseRatios = computeRatios(bsBaseStatic, insBaseStatic, cfBaseStatic);
  const compRatios = computeRatios(bsCompStatic, insCompStatic, cfCompStatic);

  // 4) Return the combined report
  return {
    success: true,
    report: {
      company,
      baseYear,
      comparisonYear,
      base: baseRatios,
      comparison: compRatios,
    },
  };
}

module.exports = {
  initDb,
  saveFormData,
  getFormDataByYearAndCompany,
  resetFormData,
  generateReport,
  getCompanies,
  resolveComparison,
};
