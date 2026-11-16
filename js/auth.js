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

  /* date of birth: shared calendar picker (dd-mm-yyyy display, ISO stored) */
  const dobEl = document.getElementById("dob");
  const dobMax = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
  if (window.KIIDatePicker) KIIDatePicker(dobEl, { max: dobMax });
  const dobValue = () => dobEl.dataset.iso || "";

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

  signupForm.addEventListener("submit", async (e) => {
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
    if (!dob) return showAlert("Please select your date of birth from the calendar.");
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
    const invite = document.getElementById("invite")?.value.trim() || "";
    if (!invite) return showAlert("Please enter the invite code given to you by the KII team.");
    if (window.KIIServer?.enabled) {
      const r = await KIIServer.post("/api/signup", { password, invite, user: { firstName, secondName, thirdName, dob, passport, country, city, town,
        phone: phoneCode + " " + phone, email, organization, website, privacyConsentAt: new Date().toISOString() } });
      if (!r.ok) return showAlert(r.json.error || "Could not create the account. Please try again.");
      window.location.href = "dashboard.html";
      return;
    }
    const localInvite = JSON.parse(localStorage.getItem("kii_invite") || "{}").code;
    if (localInvite && invite !== localInvite)
      return showAlert("Invalid invite code. Please ask KII staff for the correct code.");
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
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (window.KIIServer?.enabled) {
      const r = await KIIServer.post("/api/login", { email, password });
      if (!r.ok) return showAlert(r.json.error || "Invalid email or password.");
      window.location.href = "dashboard.html";
      return;
    }
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
