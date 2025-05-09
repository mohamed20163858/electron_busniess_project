// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const commentsModulePath = path.join(__dirname, "lib", "comments.js");
const { comments } = require(commentsModulePath);
const readXlsxFile = require("read-excel-file");
const ExcelJS = require("exceljs");

contextBridge.exposeInMainWorld("myAPI", {
  comments: comments,
});
contextBridge.exposeInMainWorld("electronAPI", {
  showMessage: (msg, title) =>
    ipcRenderer.invoke("show-message", { message: msg, title }),
  readXlsxFile, // ✅ expose the function
  // any other APIs you already expose...
  exportPDF: () => ipcRenderer.invoke("export-pdf"),
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  savePDF: (buffer) => ipcRenderer.invoke("save-pdf", buffer),
  exportExcel: async (sheetTitleArabic, headers, rows, defaultFileName) => {
    // 1) Build workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetTitleArabic);

    // title row
    const lastCol = headers.length;
    ws.mergeCells(1, 1, 1, lastCol);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = sheetTitleArabic;
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.font = { size: 14, bold: true };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };
    ws.getRow(1).height = 25;

    // headers (row 2)
    ws.columns = headers.map(() => ({ width: 45 }));
    const hr = ws.addRow(headers);
    hr.font = { bold: true };
    hr.alignment = { horizontal: "center" };
    hr.eachCell((c) => {
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDDDDDD" },
      };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // data rows
    rows.forEach((r) => {
      const er = ws.addRow(r);
      er.alignment = { horizontal: "right" };
    });

    // 2) Ask the main process to show a Save dialog
    const { canceled, filePath } = await ipcRenderer.invoke(
      "show-save-dialog",
      {
        title: `Save ${sheetTitleArabic}`,
        defaultPath: defaultFileName,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      }
    );
    if (canceled || !filePath) return { canceled: true };

    // 3) Write to disk
    await wb.xlsx.writeFile(filePath);
    return { canceled: false, filePath };
  },
  exportReportExcel: async (
    company,
    baseYear,
    comparisonYear,
    sections,
    defaultFileName
  ) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("تقرير النسب المالية");

    const totalCols = 4;
    let row = 1;

    // 1) Main title
    ws.mergeCells(row, 1, row, totalCols);
    const titleCell = ws.getCell(row, 1);
    titleCell.value = `تقرير النسب المالية — ${company} (${baseYear} vs ${comparisonYear})`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    row += 2; // leave a blank line

    // helper to style a header row
    function styleHeader(r) {
      r.font = { bold: true };
      r.alignment = { horizontal: "center" };
      r.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDDDDDD" }, // yellow
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    // 2) For each section
    for (const { title, rows: dataRows } of sections) {
      // section header
      ws.mergeCells(row, 1, row, totalCols);
      const secCell = ws.getCell(row, 1);
      secCell.value = title;
      secCell.font = { bold: true };
      secCell.alignment = { horizontal: "center" };
      secCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" },
      };
      row++;

      // column headers
      const headerRow = ws.getRow(row++);
      headerRow.values = [
        "الوصف",
        baseYear,
        comparisonYear,
        "التعليق",
      ].reverse();
      styleHeader(headerRow);

      // data rows
      dataRows.forEach(([desc, cur, prev, comm]) => {
        const dr = ws.getRow(row++);
        dr.values = [desc, cur, prev, comm].reverse();
        dr.alignment = { horizontal: "right" };
      });

      row++; // blank line before next section
    }

    // auto-size
    ws.columns.forEach((c) => (c.width = 45));

    // 3) Show save dialog
    const { filePath, canceled } = await ipcRenderer.invoke(
      "show-save-dialog",
      {
        defaultPath: defaultFileName,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      }
    );
    if (canceled) return { canceled };

    await wb.xlsx.writeFile(filePath);
    return { canceled: false, filePath };
  },
});
