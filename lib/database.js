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
        comparison_id INTEGER NOT NULL REFERENCES comparisons(id),
        data TEXT
      )
    `);
    // Create other form tables similarly
    await db.exec(`
      CREATE TABLE IF NOT EXISTS income_statement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comparison_id INTEGER NOT NULL REFERENCES comparisons(id),
        data TEXT
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cash_flow (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comparison_id INTEGER NOT NULL REFERENCES comparisons(id),
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

async function saveFormData(
  form,
  { company, baseYear, comparisonYear, data: formData }
) {
  const db = await initDb();
  const comparison_id = await resolveComparison(
    company,
    baseYear,
    comparisonYear
  );
  const table = getTableName(form);
  return await db.run(
    `INSERT INTO ${table} (comparison_id, data) VALUES (?, ?)`,
    [comparison_id, formData]
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
async function getFormDataByYearAndCompany(
  form,
  baseYear,
  comparisonYear,
  company
) {
  const db = await initDb();
  const table = getTableName(form);
  // find comparison row
  const cmp = await db.get(
    `SELECT c.id FROM comparisons c
     JOIN companies co ON co.id = c.company_id
     WHERE co.name = ? AND c.base_year = ? AND c.comparison_year = ?
     ORDER BY c.id DESC LIMIT 1`,
    [company, baseYear, comparisonYear]
  );
  if (!cmp) return null;
  // fetch just the data column
  const row = await db.get(
    `SELECT data FROM ${table}
     WHERE comparison_id = ?
     ORDER BY id DESC LIMIT 1`,
    [cmp.id]
  );
  if (!row) return null;
  return { data: row.data };
}

async function resetFormData(form, baseYear, comparisonYear, company) {
  const db = await initDb();
  const table = getTableName(form);
  const cmp = await db.get(
    `SELECT c.id FROM comparisons c
       JOIN companies co ON co.id = c.company_id
      WHERE co.name = ? AND c.base_year = ? AND c.comparison_year = ?`,
    [company, baseYear, comparisonYear]
  );
  if (!cmp) throw new Error("Comparison not found");
  await db.run(`DELETE FROM ${table} WHERE comparison_id = ?`, [cmp.id]);
  return true;
}

async function getCompanies() {
  const db = await initDb();
  const rows = await db.all(`SELECT name FROM companies`);
  return rows.map((r) => r.name);
}

async function generateReport(baseYear, comparisonYear, company) {
  const [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
    getFormDataByYearAndCompany(
      "balance-sheet",
      baseYear,
      comparisonYear,
      company
    ),
    getFormDataByYearAndCompany(
      "income-statement",
      baseYear,
      comparisonYear,
      company
    ),
    getFormDataByYearAndCompany("cash-flow", baseYear, comparisonYear, company),
  ]);
  // const db = await initDb();
  // const companyRow = await db.get("SELECT id FROM companies WHERE name = ?", [
  //   company,
  // ]);
  // if (!companyRow) {
  //   throw new Error("Company not found");
  // }
  // const companyId = companyRow.id;

  // const balanceSheet = await db.get(
  //   `SELECT bs.*, c.name as company
  //    FROM balance_sheet bs
  //    LEFT JOIN companies c ON bs.company_id = c.id
  //    WHERE bs.year = ? AND bs.company_id = ?
  //    ORDER BY bs.id DESC LIMIT 1`,
  //   [year, companyId]
  // );
  // const incomeStatement = await db.get(
  //   `SELECT ins.*, c.name as company
  //    FROM income_statement ins
  //    LEFT JOIN companies c ON ins.company_id = c.id
  //    WHERE ins.year = ? AND ins.company_id = ?
  //    ORDER BY ins.id DESC LIMIT 1`,
  //   [year, companyId]
  // );
  // const cashFlow = await db.get(
  //   `SELECT cf.*, c.name as company
  //    FROM cash_flow cf
  //    LEFT JOIN companies c ON cf.company_id = c.id
  //    WHERE cf.year = ? AND cf.company_id = ?
  //    ORDER BY cf.id DESC LIMIT 1`,
  //   [year, companyId]
  // );

  let ratios = {};
  if (
    balanceSheet &&
    balanceSheet.data &&
    incomeStatement &&
    incomeStatement.data &&
    cashFlow &&
    cashFlow.data
  ) {
    try {
      const balanceSheetParsed = JSON.parse(balanceSheet.data);
      const incomeStatementParsed = JSON.parse(incomeStatement.data);
      const cashFlowParsed = JSON.parse(cashFlow.data);
      const balanceSheetStaticData = balanceSheetParsed.static || {};
      const incomeStatementStaticData = incomeStatementParsed.static || {};
      const cashFlowStaticData = cashFlowParsed.static || {};
      if (
        balanceSheetStaticData.totalAssets &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio1 = {
          label: "نسبة اجمالي الديون إلى اجمالي الأصول",
          value:
            Number(balanceSheetStaticData.totalDebits) /
            Number(balanceSheetStaticData.totalAssets),
        };
      } else {
        ratios.ratio1 = null;
      }
      if (
        balanceSheetStaticData.totalContributersRights &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio2 = {};
        ratios.ratio2.label = "نسبة اجمالي الديون إلي اجمالي حقوق الملكية";
        ratios.ratio2.value =
          Number(balanceSheetStaticData.totalDebits) /
          Number(balanceSheetStaticData.totalContributersRights);
      } else {
        ratios.ratio2 = null;
      }
      if (
        balanceSheetStaticData.totalContributersRights &&
        balanceSheetStaticData.totalAssets
      ) {
        ratios.ratio3 = {};
        ratios.ratio3.label = "نسبة اجمالي حقوق الملكية إلي اجمالي الأصول";
        ratios.ratio3.value =
          Number(balanceSheetStaticData.totalContributersRights) /
          Number(balanceSheetStaticData.totalAssets);
      } else {
        ratios.ratio3 = null;
      }
      // if (
      //   incomeStatementStaticData.operatingProfit &&
      //   incomeStatementStaticData.benefit &&
      //   incomeStatementStaticData.rent
      // ) {
      //   ratios.ratio4 = {};
      //   ratios.ratio4.label = "معدل تغطيه الأعباء الكلية";
      //   ratios.ratio4.value =
      //     (Number(incomeStatementStaticData.operatingProfit) +
      //       Number(incomeStatementStaticData.rent)) /
      //     (Number(incomeStatementStaticData.rent) +
      //       Number(incomeStatementStaticData.benefit));
      // } else {
      //   ratios.ratio4 = null;
      // }
      if (
        incomeStatementStaticData.operatingProfit &&
        incomeStatementStaticData.benefit
      ) {
        ratios.ratio5 = {};
        ratios.ratio5.label = "معدل تغطيه الفوائد";
        ratios.ratio5.value =
          Number(incomeStatementStaticData.operatingProfit) /
          Number(incomeStatementStaticData.benefit);
      } else {
        ratios.ratio5 = null;
      }
      if (
        incomeStatementStaticData.operatingProfit &&
        incomeStatementStaticData.benefit &&
        incomeStatementStaticData.fixedCommitments
      ) {
        ratios.ratio6 = {};
        ratios.ratio6.label = "معدل تغطيه الرسوم الثابتة";
        ratios.ratio6.value =
          Number(incomeStatementStaticData.operatingProfit) /
          (Number(incomeStatementStaticData.benefit) +
            Number(incomeStatementStaticData.fixedCommitments));
      } else {
        ratios.ratio6 = null;
      }
      if (
        balanceSheetStaticData.totalContributersRights &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio7 = {};
        ratios.ratio7.label = "نسبة هيكل راس المال";
        ratios.ratio7.value =
          Number(balanceSheetStaticData.totalDebits) /
          (Number(balanceSheetStaticData.totalContributersRights) +
            Number(balanceSheetStaticData.totalDebits));
      } else {
        ratios.ratio7 = null;
      }
      // cash ratio calculations
      if (
        balanceSheetStaticData.currentDebits &&
        balanceSheetStaticData.currentAssets
      ) {
        ratios.ratio8 = {};
        ratios.ratio8.label = "نسبة السيولة الحالية";
        ratios.ratio8.value =
          Number(balanceSheetStaticData.currentAssets) /
          Number(balanceSheetStaticData.currentDebits);
      } else {
        ratios.ratio8 = null;
      }
      if (
        balanceSheetStaticData.currentDebits &&
        balanceSheetStaticData.currentAssets &&
        balanceSheetStaticData.inventory
      ) {
        ratios.ratio9 = {};
        ratios.ratio9.label = "نسبة السيولة السريعة";
        ratios.ratio9.value =
          (Number(balanceSheetStaticData.currentAssets) -
            Number(balanceSheetStaticData.inventory)) /
          Number(balanceSheetStaticData.currentDebits);
      } else {
        ratios.ratio9 = null;
      }
      if (
        incomeStatementStaticData.netSell &&
        balanceSheetStaticData.currentAssets
      ) {
        ratios.ratio10 = {};
        ratios.ratio10.label = "نسبة التداول";
        ratios.ratio10.value =
          Number(incomeStatementStaticData.netSell) /
          Number(balanceSheetStaticData.currentAssets);
      } else {
        ratios.ratio10 = null;
      }
      if (
        cashFlowStaticData.netOperatingCashFlow &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio11 = {};
        ratios.ratio11.label = "نسبة السيولة التشغيلية";
        ratios.ratio11.value =
          Number(cashFlowStaticData.netOperatingCashFlow) /
          Number(balanceSheetStaticData.totalDebits);
      } else {
        ratios.ratio11 = null;
      }
      if (
        balanceSheetStaticData.totalContributersRights &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio12 = {};
        ratios.ratio12.label = "نسبة السيولة المالية";
        ratios.ratio12.value =
          Number(balanceSheetStaticData.totalDebits) /
          Number(balanceSheetStaticData.totalContributersRights);
      } else {
        ratios.ratio12 = null;
      }
      if (
        balanceSheetStaticData.totalContributersRights &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio13 = {};
        ratios.ratio13.label = "السيولة من حقوق المساهمين";
        ratios.ratio13.value =
          Number(balanceSheetStaticData.totalContributersRights) /
          Number(balanceSheetStaticData.totalDebits);
      } else {
        ratios.ratio13 = null;
      }
      if (
        balanceSheetStaticData.totalFixedAssets &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio14 = {};
        ratios.ratio14.label = "السيولة من الأصول الثابتة";
        ratios.ratio14.value =
          Number(balanceSheetStaticData.totalFixedAssets) /
          Number(balanceSheetStaticData.totalDebits);
      } else {
        ratios.ratio14 = null;
      }
      if (
        balanceSheetStaticData.currentAssets &&
        balanceSheetStaticData.totalDebits
      ) {
        ratios.ratio15 = {};
        ratios.ratio15.label = "السيولة من الأصول المتداولة";
        ratios.ratio15.value =
          Number(balanceSheetStaticData.currentAssets) /
          Number(balanceSheetStaticData.totalDebits);
      } else {
        ratios.ratio15 = null;
      }
      if (
        balanceSheetStaticData.currentAssets &&
        balanceSheetStaticData.currentDebits &&
        balanceSheetStaticData.totalAssets
      ) {
        ratios.ratio16 = {};
        ratios.ratio16.label = "نسبة رأس المال العامل";
        ratios.ratio16.value =
          (Number(balanceSheetStaticData.currentAssets) -
            Number(balanceSheetStaticData.currentDebits)) /
          Number(balanceSheetStaticData.totalAssets);
      } else {
        ratios.ratio16 = null;
      }
      // active ratio calculations
      if (
        incomeStatementStaticData.netSell &&
        balanceSheetStaticData.totalAssets
      ) {
        ratios.ratio17 = {};
        ratios.ratio17.label = "معدل دوران الاصول";
        ratios.ratio17.value =
          Number(incomeStatementStaticData.netSell) /
          Number(balanceSheetStaticData.totalAssets);
      } else {
        ratios.ratio17 = null;
      }
      if (
        incomeStatementStaticData.netSell &&
        balanceSheetStaticData.totalFixedAssets
      ) {
        ratios.ratio18 = {};
        ratios.ratio18.label = "معدل دوران الاصول الثابتة";
        ratios.ratio18.value =
          Number(incomeStatementStaticData.netSell) /
          Number(balanceSheetStaticData.totalFixedAssets);
      } else {
        ratios.ratio18 = null;
      }
      if (
        incomeStatementStaticData.netSell &&
        balanceSheetStaticData.currentAssets
      ) {
        ratios.ratio19 = {};
        ratios.ratio19.label = "معدل دوران الاصول المتداولة";
        ratios.ratio19.value =
          Number(incomeStatementStaticData.netSell) /
          Number(balanceSheetStaticData.currentAssets);
      } else {
        ratios.ratio19 = null;
      }
      if (
        incomeStatementStaticData.netSell &&
        cashFlowStaticData.netCashFlowAndSimilar
      ) {
        ratios.ratio20 = {};
        ratios.ratio20.label = "معدل دوران النقدية";
        ratios.ratio20.value =
          Number(incomeStatementStaticData.netSell) /
          Number(cashFlowStaticData.netCashFlowAndSimilar);
      } else {
        ratios.ratio20 = null;
      }
      if (
        (incomeStatementStaticData.futureNetSales ||
          incomeStatementStaticData.netSell) &&
        balanceSheetStaticData.clientsAndOtherDebits
      ) {
        ratios.ratio21 = {};
        ratios.ratio21.label = "معدل دوران أرصدة العملاء";
        if (incomeStatementStaticData.futureNetSales) {
          ratios.ratio21.value =
            Number(incomeStatementStaticData.futureNetSales) /
            Number(balanceSheetStaticData.clientsAndOtherDebits);
        } else {
          ratios.ratio21.value =
            Number(incomeStatementStaticData.netSell) /
            Number(balanceSheetStaticData.clientsAndOtherDebits);
        }
      } else {
        ratios.ratio21 = null;
      }
      if (ratios.ratio21) {
        ratios.ratio22 = {};
        ratios.ratio22.label = "متوسط فتره التحصيل";
        ratios.ratio22.value = Math.round(360 / ratios.ratio21.value);
      } else {
        ratios.ratio22 = null;
      }
      if (
        incomeStatementStaticData.costSales &&
        balanceSheetStaticData.inventory
      ) {
        ratios.ratio23 = {};
        ratios.ratio23.label = "معدل دوران المخزون";
        ratios.ratio23.value =
          Number(incomeStatementStaticData.costSales) /
          Number(balanceSheetStaticData.inventory);
      } else {
        ratios.ratio23 = null;
      }
      if (ratios.ratio23) {
        ratios.ratio24 = {};
        ratios.ratio24.label = "متوسط فتره التخزين";
        ratios.ratio24.value = Math.round(360 / ratios.ratio23.value);
      } else {
        ratios.ratio24 = null;
      }
      if (ratios.ratio24 && ratios.ratio22) {
        ratios.ratio25 = {};
        ratios.ratio25.label = "طول الدورة التشغيلية";
        ratios.ratio25.value = ratios.ratio24.value + ratios.ratio22.value;
      } else {
        ratios.ratio25 = null;
      }
      if (
        incomeStatementStaticData.costSales &&
        balanceSheetStaticData.creditorsAndOtherCredits
      ) {
        ratios.ratio26 = {};
        ratios.ratio26.label = "معدل دوران الدائنين";
        ratios.ratio26.value =
          Number(incomeStatementStaticData.costSales) /
          Number(balanceSheetStaticData.creditorsAndOtherCredits);
      } else {
        ratios.ratio26 = null;
      }
      if (ratios.ratio26) {
        ratios.ratio27 = {};
        ratios.ratio27.label = "متوسط فتره السداد";
        ratios.ratio27.value = Math.round(360 / ratios.ratio26.value);
      } else {
        ratios.ratio27 = null;
      }
      if (ratios.ratio24 && ratios.ratio22 && ratios.ratio27) {
        ratios.ratio28 = {};
        ratios.ratio28.label = "طول الدورة التجارية";
        ratios.ratio28.value =
          ratios.ratio24.value + ratios.ratio22.value - ratios.ratio27.value;
      } else {
        ratios.ratio28 = null;
      }
      // profit ratio calculations

      if (
        incomeStatementStaticData.totalProfit &&
        incomeStatementStaticData.netSell
      ) {
        ratios.ratio29 = {};
        ratios.ratio29.label = "نسبة هامش الربح الاجمالي";
        ratios.ratio29.value =
          Number(incomeStatementStaticData.totalProfit) /
          Number(incomeStatementStaticData.netSell);
      } else {
        ratios.ratio29 = null;
      }
      if (
        incomeStatementStaticData.operatingProfit &&
        incomeStatementStaticData.netSell
      ) {
        ratios.ratio30 = {};
        ratios.ratio30.label = "نسبة هامش الربح التشغيلي";
        ratios.ratio30.value =
          Number(incomeStatementStaticData.operatingProfit) /
          Number(incomeStatementStaticData.netSell);
      } else {
        ratios.ratio30 = null;
      }
      if (
        incomeStatementStaticData.netYearProfit &&
        incomeStatementStaticData.netSell
      ) {
        ratios.ratio31 = {};
        ratios.ratio31.label = "نسبة هامش صافي الربح";
        ratios.ratio31.value =
          Number(incomeStatementStaticData.netYearProfit) /
          Number(incomeStatementStaticData.netSell);
      } else {
        ratios.ratio31 = null;
      }
      if (
        incomeStatementStaticData.netYearProfit &&
        balanceSheetStaticData.totalAssets
      ) {
        ratios.ratio32 = {};
        ratios.ratio32.label = "(ROA)العائد علي إجمالي الأصول";
        ratios.ratio32.value =
          Number(incomeStatementStaticData.netYearProfit) /
          Number(balanceSheetStaticData.totalAssets);
      } else {
        ratios.ratio32 = null;
      }
      if (
        incomeStatementStaticData.netYearProfit &&
        balanceSheetStaticData.totalContributersRights
      ) {
        ratios.ratio33 = {};
        ratios.ratio33.label = "(ROE)العائد علي حقوق الملكية";
        ratios.ratio33.value =
          Number(incomeStatementStaticData.netYearProfit) /
          Number(balanceSheetStaticData.totalContributersRights);
      } else {
        ratios.ratio33 = null;
      }
      if (
        incomeStatementStaticData.netYearProfit &&
        incomeStatementStaticData.netSell
      ) {
        ratios.ratio34 = {};
        ratios.ratio34.label = "(ROS)العائد علي المبيعات";
        ratios.ratio34.value =
          Number(incomeStatementStaticData.netYearProfit) /
          Number(incomeStatementStaticData.netSell);
      } else {
        ratios.ratio34 = null;
      }
      // ... additional ratio calculations
    } catch (err) {
      console.error("Error parsing balance sheet data", err);
      ratios.error = err.message;
    }
  }
  return { ratios };
}

module.exports = {
  initDb,
  saveFormData,
  getFormDataByYearAndCompany,
  resetFormData,
  generateReport,
  getCompanies,
};
