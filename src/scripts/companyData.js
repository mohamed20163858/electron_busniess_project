// scripts/companyData.js
document.addEventListener("DOMContentLoaded", () => {
  // Cache DOM elements
  const companyEl = document.getElementById("company-input");
  const baseEl = document.getElementById("baseYear");
  const cmpEl = document.getElementById("comparisonYear");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const companiesDatalist = document.getElementById("companies");

  // 1. Fetch companies for autocomplete
  async function loadCompanySuggestions() {
    try {
      const res = await fetch("http://localhost:3000/api/companies");
      const companies = await res.json();
      companiesDatalist.innerHTML = "";
      companies.forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        companiesDatalist.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load company suggestions:", err);
    }
  }

  // 2. Load saved settings from localStorage
  function loadSettings() {
    const saved = localStorage.getItem("comparisonSettings");
    if (!saved) return;
    try {
      const { company, baseYear, comparisonYear } = JSON.parse(saved);
      companyEl.value = company;
      baseEl.value = baseYear;
      cmpEl.value = comparisonYear;
    } catch (err) {
      console.error("Error parsing saved settings:", err);
    }
  }

  // 3. Save settings to localStorage + backend
  async function saveSettings() {
    const company = companyEl.value.trim();
    const baseYear = baseEl.value;
    const comparisonYear = cmpEl.value;
    if (!company || !baseYear || !comparisonYear) {
      await window.electronAPI.showMessage("All fields are required.", "fault");
      return;
    }

    // Persist in localStorage
    localStorage.setItem(
      "comparisonSettings",
      JSON.stringify({ company, baseYear, comparisonYear })
    );

    // Persist to server (empty data payload for comparison record)
    try {
      const res = await fetch("http://localhost:3000/api/comparison/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          baseYear,
          comparisonYear,
          data: "{}",
        }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await window.electronAPI.showMessage("تم حفظ الإعدادات", "نجاح");
    } catch (err) {
      console.error("Error saving settings to server:", err);

      await window.electronAPI.showMessage(
        "حدث خطأ أثناء حفظ الإعدادات",
        "خطأ"
      );
    }
  }

  // 4. Reset settings
  function resetSettings() {
    localStorage.removeItem("comparisonSettings");
    companyEl.value = "";
    baseEl.value = "";
    cmpEl.value = "";
    window.electronAPI.showMessage("تم إعادة تعيين الإعدادات", "تم");
  }

  // Wire up buttons
  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetSettings);

  // Initialize
  loadCompanySuggestions();
  loadSettings();
});
