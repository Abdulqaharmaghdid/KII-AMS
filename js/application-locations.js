/* Local location catalogue; no applicant information is sent to a location service.
 * world-cities.csv: https://github.com/datasets/world-cities (GeoNames, CC BY 4.0).
 * Licence: https://creativecommons.org/licenses/by/4.0/
 * Cities generally have populations over 15,000; the Iraqi list adds local towns.
 * University and institute names: KII 'Local Universities and Institutions Data' sheet (public and
 * private universities and private institutes), checked against https://gov.krd/mohe-en/publications/universities/
 * City-centre postal suggestions: https://en.wikipedia.org/wiki/Postal_codes_in_Iraq
 * Halabja: https://postalcoder.com/iraq/sulaymaniyah/halabja-postal-code
 * Local towns: https://wikimili.com/en/List_of_postal_codes_in_Iraq
 * Postal codes identify post offices, not whole cities; applicants may override them.
 */
window.KIILocations = (() => {
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const aliases = {
    Erbil: ["Hawler", "Hewler", "Arbil", "هەولێر", "أربيل"],
    Duhok: ["Dohuk", "Dahuk", "دهۆک", "دهوك"],
    Sulaimani: ["Sulaymaniyah", "Sulaymaniya", "As Sulaymaniyah", "Slemani", "Sulaimaniya", "سلێمانی", "السليمانية"],
    Halabja: ["Halabjah", "Halabha", "Helebce", "هەڵەبجە", "حلبجة"],
    Kirkuk: ["Kerkuk", "Karkuk", "کەرکووک", "كركوك"],
    Basra: ["Basrah", "Al Basrah", "البصرة"],
    Mosul: ["Al Mawsil", "الموصل"], Baghdad: ["Bagdad", "بغداد"],
    Koya: ["Koysinjaq", "Koy Sanjaq"], Ranya: ["Rania", "Raniyah"],
    Akre: ["Aqrah"], Kalar: ["Kelar"],
    Dukan: ["Dokan"], Darbandikhan: ["Darbandihkan"]
  };
  const iraqiCities = [
    "Erbil", "Duhok", "Sulaimani", "Halabja", "Kirkuk", "Baghdad", "Basra", "Mosul",
    "Zakho", "Soran", "Koya", "Ranya", "Akre", "Amedi", "Chamchamal", "Kalar", "Kifri",
    "Dukan", "Darbandikhan", "Shaqlawa", "Rawanduz", "Choman", "Qaladiza", "Penjwen",
    "Bardarash", "Shekhan", "Dibis", "Makhmur", "Shingal", "Tal Afar", "Alqosh",
    "Najaf", "Karbala", "Hillah", "Nasiriyah", "Amarah", "Kut", "Diwaniyah", "Samawah",
    "Baqubah", "Ramadi", "Fallujah", "Tikrit", "Samarra", "Balad", "Baiji", "Khanaqin",
    "Muqdadiyah", "Balad Ruz", "Mandali", "Hit", "Haditha", "Anah", "Al-Qaim",
    "Rutbah", "Zubair", "Umm Qasr", "Al-Faw", "Shatrah", "Suq al-Shuyukh"
  ];
  const postcodes = {
    Erbil: "44001", Duhok: "42001", Sulaimani: "46001", Halabja: "46006",
    Kirkuk: "36001", Baghdad: "10001", Basra: "61001", Mosul: "41001",
    Najaf: "54001", Karbala: "56001", Hillah: "51001", Nasiriyah: "64001",
    Amarah: "62001", Kut: "52001", Diwaniyah: "58001", Samawah: "66001",
    Baqubah: "32001", Ramadi: "31001", Tikrit: "34001",
    Zakho: "42002", Akre: "42004", Bardarash: "42006", Amedi: "42008", Shekhan: "42012",
    Shaqlawa: "44005", Soran: "44008", Rawanduz: "44009", Choman: "44010", Makhmur: "44020",
    Penjwen: "46007", Dukan: "46010", Ranya: "46012", Qaladiza: "46016",
    Darbandikhan: "46020", Kalar: "46021", Kifri: "46022", Chamchamal: "46023"
  };
  /* Address flow for Iraq: applicant picks a governorate, then an optional town inside it.
     "Other" keeps every Iraqi governorate reachable. */
  const iraqRegions = {
    "Baghdad": ["Abu Ghraib", "Al-Fawwar", "Mahmudiyah", "Madain", "Taji", "Tarmiyah", "Yusufiyah"],
    "Erbil": ["Ainkawa", "Bahirka", "Choman", "Diana", "Harir", "Kalak", "Khalifan", "Koya", "Makhmur", "Mergasur", "Pirmam", "Qushtapa", "Rawanduz", "Shaqlawa", "Soran"],
    "Sulaimani": ["Bazyan", "Chamchamal", "Chwarta", "Darbandikhan", "Dukan", "Kalar", "Kifri", "Penjwen", "Qaladiza", "Qaradagh", "Ranya", "Said Sadiq", "Sharbazher", "Sharazur"],
    "Kirkuk": ["Altun Kupri", "Daquq", "Dibis", "Hawija", "Laylan", "Shwan", "Taza", "Tuz Khurmatu"],
    "Halabja": ["Anab", "Bemo", "Byara", "Khurmal", "Sirwan", "Tawella"],
    "Duhok": ["Akre", "Amedi", "Bardarash", "Batifa", "Darkar", "Kani Masi", "Mangesh", "Semel", "Shekhan", "Zakho", "Zawita", "Sarsang"]
  };
  const regionOfSub = { "Baghdad": "Baghdad", "Arbil": "Erbil", "Erbil": "Erbil", "Diyala": "Other",
    "As-Sulaymaniyah": "Sulaimani", "Sulaymaniyah": "Sulaimani", "At-Ta'mim": "Kirkuk", "Kirkuk": "Kirkuk",
    "Halabja": "Halabja", "Dahuk": "Duhok", "Duhok": "Duhok" };
  const townToRegion = {};
  for (const [gov, towns] of Object.entries(iraqRegions)) towns.forEach(t => townToRegion[normalize(t)] = gov);
  const universities = {
    "Erbil": [
      "Ayinda Private Technical Institute",
      "Bayan University",
      "Best Technical and Vocational Institute",
      "British International University",
      "Catholic University",
      "Cihan University ? Erbil",
      "CMC Technical and Vocational Institute",
      "Erbil polytechnic university",
      "Gasha Private Technical Institute",
      "Haibat Sultan Technical Institute",
      "Hawler Medical University",
      "International University Erbil",
      "Knowledge Technical and Vocational Institute",
      "Knowledge University",
      "Kurdistan Board for Medical Specialties",
      "Lebanese French University",
      "Noble Technical Institute ? Private",
      "Paitaxt Technical Institute – Erbil",
      "Paytakhti Kurdistan Technical and Vocational Institute",
      "Pirmam Technical and Vocational Institute",
      "Prime Technical and Vocational Institute",
      "Qala University College",
      "Rawanduz Private Technical Institute",
      "Rozh Technical Institute",
      "Saffin Technical and Vocational Institute",
      "Salahaddin University",
      "Sava Technical Institute",
      "Tishk International University",
      "Universal Technical and Vocational Institute",
      "University of Kurdistan Hawler"
    ],
    "Sulaimani": [
      "American University of Iraq in Sulaimani",
      "Azmar Technical and Vocational Institute",
      "Bright Technical and Vocational Institute",
      "Cihan Technical and Vocational Institute – Sulaimani",
      "Cihan University ? Sulaimani",
      "Fam Technical and Vocational Institute",
      "Garmyan Technical and Vocational Institute",
      "Kalar Private Technical Institute",
      "Komar Technical and Vocational Institute",
      "Komar University of Science and Technology",
      "Kurdistan Institution for Strategic Studies and Scientific Research",
      "Kurdistan Technical Institute – Sulaimani",
      "Lutka Technical and Vocational Institute",
      "National Institute of Technology",
      "Nishtiman Technical and Vocational Institute",
      "Qaiwan International University for practical Sciences/ UTM",
      "Raparin Technical and Vocational Institute",
      "Sulaimani Polytechnic University",
      "Tishik University ? Sulaimani",
      "University College of Goizha",
      "University of Human Development",
      "University of Sulaimani"
    ],
    "Duhok": [
      "Ararat Private Technical Institute",
      "Behdinan Technical and Vocational Institute",
      "Bright Minds Technical and Vocational Institute",
      "Charsteen Private Technical Institute",
      "Cihan University ? Duhok",
      "Duhok Polytechnic University",
      "Duhok Private Technical Institute",
      "Nawroz University",
      "Rand Technical and Vocational Institute",
      "Rawanduz Technical Institute – Zakho Branch",
      "Sipa Technical and Vocational Institute",
      "The American University of Kurdistan",
      "University of Duhok"
    ],
    "Koya": [
      "Koya University"
    ],
    "Soran": [
      "Soran University"
    ],
    "Zakho": [
      "University of Zakho"
    ],
    "Ranya": [
      "University of Raparin"
    ],
    "Halabja": [
      "Halabja Technical and Vocational Institute",
      "Halabja University"
    ],
    "Kalar": [
      "Garmian Polytechnic University",
      "Garmian University"
    ],
    "Chamchamal": [
      "Charmo University"
    ],
    "Akre": [
      "Akre university for applied sciences"
    ]
  };
  const byCountry = new Map();
  const countryNames = {
    "Czechia": "Czech Republic", "Türkiye": "Turkey", "Côte d'Ivoire": "Ivory Coast",
    "Congo Republic": "Congo", "Republic of the Congo": "Congo",
    "State of Palestine": "Palestine", "Palestinian Territory": "Palestine", "Palestine, State of": "Palestine",
    "Bolivia, Plurinational State of": "Bolivia", "Iran, Islamic Republic of": "Iran",
    "Korea, Democratic People's Republic of": "North Korea", "Korea, Republic of": "South Korea",
    "Lao People's Democratic Republic": "Laos", "Moldova, Republic of": "Moldova",
    "Russian Federation": "Russia", "Syrian Arab Republic": "Syria", "Taiwan, Province of China": "Taiwan",
    "Tanzania, United Republic of": "Tanzania", "Venezuela, Bolivarian Republic of": "Venezuela", "Viet Nam": "Vietnam"
  };
  function canonicalCity(country, city) {
    if (country !== "Iraq") return city;
    return iraqiCities.find(name => normalize(name) === normalize(city) ||
      (aliases[name] || []).some(alias => normalize(alias) === normalize(city))) || city;
  }
  function csvColumns(line) {
    const cells = []; let cell = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
      else cell += char;
    }
    cells.push(cell); return cells;
  }
  const ready = fetch("js/world-cities.csv").then(response => {
    if (!response.ok) throw Error("The city list could not be loaded. Refresh the page and try again.");
    return response.text();
  }).then(csv => {
    for (const line of csv.split(/\r?\n/).slice(1)) {
      if (!line) continue;
      const [name, originalCountry, , subcountry] = csvColumns(line);
      const country = countryNames[originalCountry] || originalCountry;
      if (!country || !name) continue;
      if (!byCountry.has(country)) byCountry.set(country, new Set());
      const city = canonicalCity(country, name);
      byCountry.get(country).add(city);
      if (country === "Iraq") {
        const gov = regionOfSub[subcountry] || townToRegion[normalize(city)];
        if (gov && iraqRegions[gov] && !iraqRegions[gov].includes(city)) iraqRegions[gov].push(city);
      }
    }
    const iraq = byCountry.get("Iraq") || new Set();
    iraqiCities.forEach(city => iraq.add(city));
    byCountry.set("Iraq", iraq);
  });
  // Handle a failed request immediately; the form awaits and displays the same error.
  ready.catch(() => {});
  const iraqMain = ["Baghdad", "Erbil", "Sulaimani", "Kirkuk", "Halabja", "Duhok", "Mosul", "Basra", "Najaf",
    "Karbala", "Hillah", "Nasiriyah", "Amarah", "Kut", "Diwaniyah", "Samawah", "Baqubah", "Ramadi", "Fallujah", "Tikrit"];
  const townRegions = ["Erbil", "Sulaimani", "Kirkuk", "Halabja", "Duhok"];
  const mainCities = () => [...iraqMain, "Other"];
  const towns = gov => [...(iraqRegions[gov] || [])].sort((a, b) => a.localeCompare(b));
  const governorateOf = city => townToRegion[normalize(canonicalCity("Iraq", city))] ||
    Object.keys(iraqRegions).find(g => normalize(g) === normalize(city));
  /* Universities grouped by governorate: selecting "Erbil" also offers institutions in its towns (e.g. Koya). */
  const institutions = city => {
    if (!city) return null;
    const list = [...(universities[city] || []),
      ...(iraqRegions[city] ? towns(city).flatMap(t => universities[t] || []) : [])];
    return list.length ? [...new Set(list)] : null;
  };
  return {
    ready, normalize, universities, canonicalCity, iraqRegions, iraqMain, townRegions, mainCities, towns, governorateOf, institutions,
    countries: () => [...new Set([...COUNTRIES, ...byCountry.keys()])].sort((a, b) => a.localeCompare(b)),
    cities: country => [...(byCountry.get(country) || [])].sort((a, b) => a.localeCompare(b)),
    postal: (country, city) => country === "Iraq" ? postcodes[canonicalCity(country, city)] || "" : "",
    matches: (option, query) => normalize(option).includes(normalize(query)) ||
      (aliases[option] || []).some(alias => normalize(alias).includes(normalize(query)))
  };
})();
