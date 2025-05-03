// api/server.js
const express = require("express");
const bodyParser = require("body-parser");
const {
  saveFormData,
  getFormDataByYearAndCompany,
  resetFormData,
  generateReport,
  getCompanies,
  resolveComparison,
} = require("../lib/database");

const app = express();
const PORT = 3000;

// Parse JSON request bodies
app.use(bodyParser.json());

// ─── GET /api/companies ────────────────────────────────────────────────────────
// Return an array of all company names
app.get("/api/companies", async (req, res) => {
  try {
    const companies = await getCompanies();
    res.json(companies);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/forms/:form/get ───────────────────────────────────────────────────
// Query params: company, year
app.get("/api/forms/:form/get", async (req, res) => {
  const { form } = req.params;
  const { company, year } = req.query;

  // Validate
  if (!company || !year) {
    console.error("Missing query params:", req.query);
    return res.status(400).json({ error: "company and year are required" });
  }

  try {
    console.log(`Fetching ${form} for`, company, year);
    const record = await getFormDataByYearAndCompany(form, year, company);
    // Always respond with { data }
    return res.json({ data: record ? record.data : null });
  } catch (err) {
    console.error("Error in GET /api/forms/:form/get →", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── New: Save comparison settings ─────────────────────────────────────────────
app.post("/api/comparison/save", async (req, res) => {
  const { company, baseYear, comparisonYear } = req.body;
  if (!company || !baseYear || !comparisonYear) {
    return res
      .status(400)
      .json({ error: "company, baseYear and comparisonYear are required" });
  }
  try {
    // resolveComparison will insert or find existing comparison row
    const comparisonId = await resolveComparison(
      company,
      baseYear,
      comparisonYear
    );
    res.json({ success: true, comparisonId });
  } catch (err) {
    console.error("Error saving comparison settings:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/forms/:form/save ─────────────────────────────────────────────────
// Body JSON: { company, year, data }
app.post("/api/forms/:form/save", async (req, res) => {
  const { form } = req.params;
  const { company, year, data } = req.body;

  // Validate
  if (!company || !year || typeof data !== "string") {
    return res
      .status(400)
      .json({ error: "company, year and data(string) are required" });
  }

  try {
    await saveFormData(form, { company, year, data });
    res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /api/forms/:form/save →", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/forms/:form/reset ────────────────────────────────────────────────
// Body JSON: { company, year }
app.post("/api/forms/:form/reset", async (req, res) => {
  const { form } = req.params;
  const { company, year } = req.body;

  // Validate
  if (!company || !year) {
    return res.status(400).json({ error: "company and year are required" });
  }

  try {
    await resetFormData(form, year, company);
    res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /api/forms/:form/reset →", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/generate ────────────────────────────────────────────────────────
// Body JSON: { company, baseYear, comparisonYear }
app.post("/api/generate", async (req, res) => {
  const { company, baseYear, comparisonYear } = req.body;

  // Validate
  if (!company || !baseYear || !comparisonYear) {
    return res
      .status(400)
      .json({ error: "company, baseYear and comparisonYear are required" });
  }

  try {
    const result = await generateReport(baseYear, comparisonYear, company);
    res.json(result);
  } catch (err) {
    console.error("Error in POST /api/generate →", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
