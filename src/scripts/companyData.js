const companyEl = document.getElementById("company");
const baseEl = document.getElementById("baseYear");
const cmpEl = document.getElementById("comparisonYear");

// Load saved settings from localStorage
function loadSettings() {
  const settings = JSON.parse(
    localStorage.getItem("comparisonSettings") || "null"
  );
  if (settings) {
    companyEl.value = settings.company;
    baseEl.value = settings.baseYear;
    cmpEl.value = settings.comparisonYear;
  }
}

// Save settings to localStorage and to DB
document.getElementById("save-btn").addEventListener("click", async () => {
  const company = companyEl.value.trim();
  const baseYear = baseEl.value;
  const comparisonYear = cmpEl.value;
  if (!company || !baseYear || !comparisonYear) return;

  // Persist in localStorage
  localStorage.setItem(
    "comparisonSettings",
    JSON.stringify({ company, baseYear, comparisonYear })
  );

  // Optionally, persist to server-side for DB storage
  await fetch("/api/forms/comparison/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company, baseYear, comparisonYear, data: "{}" }),
  });

  alert("تم حفظ الإعدادات");
});

// Reset settings
document.getElementById("reset-btn").addEventListener("click", () => {
  localStorage.removeItem("comparisonSettings");
  companyEl.value = "";
  baseEl.value = "";
  cmpEl.value = "";
  alert("تم إعادة تعيين الإعدادات");
});

// On page load
loadSettings();
