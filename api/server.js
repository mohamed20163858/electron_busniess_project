// api/server.js
const express = require("express");
const bodyParser = require("body-parser");
const {
  saveFormData,
  getFormDataByYearAndCompany,
  resetFormData,
  generateReport,
  getCompanies,
} = require("../lib/database");

const app = express();
const PORT = 3000; // You can choose any available port

// Parse JSON request bodies
app.use(bodyParser.json());

// Endpoint to get company suggestions
app.get("/api/companies", async (req, res) => {
  try {
    // console.log("here:-");
    const companies = await getCompanies();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get form data (balance sheet, income statement, cash flow)
app.get("/api/forms/:form/get", async (req, res) => {
  try {
    const { form } = req.params;
    const { baseYear, comparisonYear, company } = req.query;
    const data = await getFormDataByYearAndCompany(
      form,
      baseYear,
      comparisonYear,
      company
    );
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to save form data
app.post("/api/forms/:form/save", async (req, res) => {
  try {
    const { form } = req.params;
    const result = await saveFormData(form, req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to reset (delete) form data
app.post("/api/forms/:form/reset", async (req, res) => {
  try {
    const { form } = req.params;
    const { baseYear, comparisonYear, company } = req.body;
    await resetFormData(form, baseYear, comparisonYear, company);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to generate a report
app.post("/api/generate", async (req, res) => {
  try {
    const { baseYear, comparisonYear, company } = req.body;
    const report = await generateReport(baseYear, comparisonYear, company);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the internal HTTP server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
