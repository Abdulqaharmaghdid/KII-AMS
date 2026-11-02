/* ===== Auth logic: signup + login ===== */

function showAlert(msg, ok = false) {
  const a = document.getElementById("alert");
  a.textContent = msg;
  a.className = "alert " + (ok ? "alert-ok" : "alert-error");
  a.classList.remove("hidden");
}

/* ---------- Sign Up ---------- */
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  fillCountryCodes(document.getElementById("phoneCode"));
  document.getElementById("phoneCode").value = "+964 (IQ)";

  /* date of birth: year / month / day dropdowns (friendlier than the native date picker) */
  const dobY = document.getElementById("dobYear"), dobM = document.getElementById("dobMonth"), dobD = document.getElementById("dobDay");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  dobY.innerHTML = '<option value="">Year</option>' + Array.from({length: 90}, (_,i) => new Date().getFullYear() - 14 - i).map(y => `<option>${y}</option>`).join("");
  dobM.innerHTML = '<option value="">Month</option>' + months.map((m,i) => `<option value="${i+1}">${m}</option>`).join("");
  function fillDays() {
    const days = dobY.value && dobM.value ? new Date(+dobY.value, +dobM.value, 0).getDate() : 31;
    const keep = dobD.value;
    dobD.innerHTML = '<option value="">Day</option>' + Array.from({length: days}, (_,i) => `<option>${i+1}</option>`).join("");
    if (keep && +keep <= days) dobD.value = keep;
  }
  fillDays(); dobY.addEventListener("change", fillDays); dobM.addEventListener("change", fillDays);
  const dobValue = () => dobY.value && dobM.value && dobD.value
    ? `${dobY.value}-${String(dobM.value).padStart(2,"0")}-${String(dobD.value).padStart(2,"0")}` : "";

  /* country / province / town (two-level for Iraq, same as the application form) */
  const countryEl = document.getElementById("country"), provEl = document.getElementById("province"), townEl = document.getElementById("town"), townField = document.getElementById("townField");
  function fill(el, list, placeholder) { el.innerHTML = `<option value="">${placeholder}</option>` + list.map(o => `<option>${o}</option>`).join(""); }
  KIILocations.ready.then(() => {
    fill(countryEl, KIILocations.countries(), "Select country"); countryEl.value = "Iraq"; refreshProvince();
  }).catch(() => { fill(countryEl, ["Iraq"], "Select country"); countryEl.value = "Iraq"; });
  function refreshProvince() {
    fill(provEl, countryEl.value === "Iraq" ? KIILocations.mainCities() : KIILocations.cities(countryEl.value), "Select city");
    townField.hidden = true;
  }
  countryEl.addEventListener("change", refreshProvince);
  provEl.addEventListener("change", () => {
    const show = countryEl.value === "Iraq" && KIILocations.townRegions.includes(provEl.value);
    townField.hidden = !show; if (show) fill(townEl, KIILocations.towns(provEl.value), "Select town / district"); else townEl.value = "";
  });
  /* email local part + domain */
  const emailDomain = document.getElementById("emailDomain"), emailLocal = document.getElementById("emailLocal"), emailFull = document.getElementById("emailFull");
  emailDomain.addEventListener("change", () => {
    const custom = emailDomain.value === "__custom";
    emailFull.classList.toggle("hidden", !custom); emailLocal.disabled = custom; emailDomain.disabled = false;
    if (custom) emailFull.focus();
  });
  const emailValue = () => emailDomain.value === "__custom" ? emailFull.value.trim()
    : (emailLocal.value.trim() ? emailLocal.value.trim() + "@" + emailDomain.value : "");

  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const secondName = document.getElementById("secondName").value.trim();
    const thirdName = document.getElementById("thirdName").value.trim();
    const dob = dobValue();
    const passport = document.getElementById("passport").value.trim();
    const country = countryEl.value;
    const city = provEl.value;
    const town = townField.hidden ? "" : townEl.value;
    const phoneCode = document.getElementById("phoneCode").value;
    const phone = document.getElementById("phone").value.trim();
    const email = emailValue();
    const organization = document.getElementById("organization").value.trim();
    const website = document.getElementById("website").value.trim();
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;

    if (!firstName || !secondName || !thirdName)
      return showAlert("Please enter your full name (first, second and third name).");
    if (!dob) return showAlert("Please select your date of birth (year, month and day).");
    if (!passport) return showAlert("Please enter your passport number.");
    if (!country || !city) return showAlert("Please select your country and city.");
    if (!phoneCode || !phone) return showAlert("Please enter your phone number with country code.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return showAlert("Please enter a valid email address.");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return showAlert("Password must be at least 8 characters and include letters and numbers.");
    if (password !== password2) return showAlert("Passwords do not match.");
    if (website && !/^https?:\/\/\S+\.\S+/.test(website))
      return showAlert("Website / LinkedIn must be a full link starting with https://");
    const age = (Date.now() - new Date(dob)) / (365.25 * 86400000);
    if (!(age >= 14 && age <= 100)) return showAlert("Please enter a valid date of birth.");
    if (!document.getElementById("privacyConsent").checked)
      return showAlert("Please accept the privacy notice to create your account.");
    if (KII.findUser(email)) return showAlert("An account with this email already exists. Please sign in.");

    const pw = KII.makePassword(password);
    KII.addUser({
      firstName, secondName, thirdName,
      dob, passport, country, city, town,
      phone: phoneCode + " " + phone,
      email, organization, website,
      passHash: pw.hash, passSalt: pw.salt,
      privacyConsentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    KII.login(email);
    window.location.href = "dashboard.html";
  });
}

/* ---------- Sign In ---------- */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const mins = KII.isLocked(email);
    if (mins) return showAlert(`Too many failed attempts. Please try again in ${mins} minute(s).`);
    const user = KII.findUser(email);
    if (!user || !KII.checkPassword(user, password)) {
      KII.recordFail(email);
      return showAlert("Invalid email or password.");
    }
    KII.clearFails(email);
    if (!user.passHash) { // migrate legacy plain-text password
      const pw = KII.makePassword(password);
      KII.updateUser(user.email, { passHash: pw.hash, passSalt: pw.salt, password: undefined });
    }
    KII.login(user.email);
    window.location.href = "dashboard.html";
  });
}
