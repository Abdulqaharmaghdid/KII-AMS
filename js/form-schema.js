/* Built-in application questions (generated from js/application-merged.js; the form refreshes this list at runtime). */
window.KII_FORM_SCHEMA = [
 {
  "id": "instruction",
  "title": "Instructions",
  "fields": [
   {
    "key": "agreeApp",
    "type": "checkbox",
    "required": true,
    "label": "I agree to the Application terms",
    "hint": "Provide truthful information and materials you have permission to share. KII will use your application to assess eligibility and support needs. Submission does not guarantee acceptance or funding. You may submit more than one idea using the same account.",
    "conditional": false
   }
  ]
 },
 {
  "id": "personal",
  "title": "Personal Background",
  "fields": [
   {
    "key": "firstName",
    "type": "text",
    "required": true,
    "label": "First name (exactly as in passport)",
    "hint": "",
    "conditional": false
   },
   {
    "key": "secondName",
    "type": "text",
    "required": true,
    "label": "Second name (exactly as in passport)",
    "hint": "",
    "conditional": false
   },
   {
    "key": "thirdName",
    "type": "text",
    "required": true,
    "label": "Third name (exactly as in passport)",
    "hint": "",
    "conditional": false
   },
   {
    "key": "passportNo",
    "type": "text",
    "required": true,
    "label": "Passport number",
    "hint": "",
    "conditional": false
   },
   {
    "key": "birthDate",
    "type": "dob",
    "required": true,
    "label": "Date of birth",
    "hint": "Select the month, then type the day and year.",
    "conditional": false
   },
   {
    "key": "gender",
    "type": "select",
    "required": true,
    "label": "Gender",
    "hint": "",
    "conditional": false
   },
   {
    "key": "country",
    "type": "search",
    "required": true,
    "label": "Address – Country",
    "hint": "",
    "conditional": false
   },
   {
    "key": "city",
    "type": "search",
    "required": true,
    "label": "city",
    "hint": "",
    "conditional": false
   },
   {
    "key": "cityOther",
    "type": "multitext",
    "required": true,
    "label": "Specify your governorate or city",
    "hint": "",
    "conditional": true
   },
   {
    "key": "town",
    "type": "search",
    "required": false,
    "label": "Town / district",
    "hint": "Optional – select the town or district inside your province.",
    "conditional": true
   },
   {
    "key": "street",
    "type": "text",
    "required": true,
    "label": "Street address",
    "hint": "",
    "conditional": false
   },
   {
    "key": "postal",
    "type": "text",
    "required": false,
    "label": "Postal code",
    "hint": "A central postal code is suggested where available. Replace it with your neighbourhood’s code if different.",
    "conditional": false
   },
   {
    "key": "email",
    "type": "email",
    "required": true,
    "label": "Email",
    "hint": "Use an active email, preferably a personal address that won't expire. Academic and other email types are accepted. Your account can be used for multiple ideas.",
    "conditional": false
   },
   {
    "key": "phoneCode",
    "type": "select",
    "required": true,
    "label": "Phone country code",
    "hint": "",
    "conditional": false
   },
   {
    "key": "phone",
    "type": "digits",
    "required": true,
    "label": "Phone number (WhatsApp)",
    "hint": "Prefilled from your account. Enter digits only, without the country code.",
    "conditional": false
   },
   {
    "key": "linkedIn",
    "type": "multitext",
    "required": false,
    "label": "Online profile or website",
    "hint": "Optional: social media profiles, LinkedIn pages, portfolios or personal websites. Include https://. Use + to add more.",
    "conditional": false
   },
   {
    "key": "educationType",
    "type": "select",
    "required": true,
    "label": "Highest level of education",
    "hint": "",
    "conditional": false
   },
   {
    "key": "hsSchool",
    "type": "text",
    "required": false,
    "label": "School / institution",
    "hint": "",
    "conditional": true
   },
   {
    "key": "schoolCertificate",
    "type": "file",
    "required": false,
    "label": "Transcript or certificate",
    "hint": "",
    "conditional": true
   },
   {
    "key": "education",
    "type": "repeat",
    "required": true,
    "label": "Higher education",
    "hint": "",
    "conditional": true
   },
   {
    "key": "photo",
    "type": "file",
    "required": false,
    "label": "Photograph",
    "hint": "",
    "conditional": false
   },
   {
    "key": "cv",
    "type": "file",
    "required": false,
    "label": "CV / Resume",
    "hint": "",
    "conditional": false
   },
   {
    "key": "courses",
    "type": "repeat",
    "required": false,
    "label": "Non-degree courses and certifications (optional)",
    "hint": "Online courses, bootcamps, professional certificates or training. Add one row per course.",
    "conditional": false
   }
  ]
 },
 {
  "id": "innovation",
  "title": "Project Information",
  "fields": [
   {
    "key": "title",
    "type": "text",
    "required": true,
    "label": "Innovation title",
    "hint": "",
    "conditional": false
   },
   {
    "key": "sector",
    "type": "select",
    "required": true,
    "label": "Sector",
    "hint": "",
    "conditional": false
   },
   {
    "key": "sectorOther",
    "type": "multitext",
    "required": true,
    "label": "Specify sector",
    "hint": "",
    "conditional": true
   },
   {
    "key": "subSector",
    "type": "select",
    "required": true,
    "label": "Sub-sector",
    "hint": "",
    "conditional": true
   },
   {
    "key": "subSectorOther",
    "type": "multitext",
    "required": true,
    "label": "Specify sub-sector",
    "hint": "",
    "conditional": true
   },
   {
    "key": "explain",
    "type": "textarea",
    "required": true,
    "label": "Short description of your innovation",
    "hint": "",
    "conditional": false
   },
   {
    "key": "problem",
    "type": "textarea",
    "required": true,
    "label": "What specific problem or challenge does your innovation solve, and how does it solve it?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "innovationPoint",
    "type": "textarea",
    "required": true,
    "label": "What makes your idea innovative or better than what already exists in the market?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "beneficiaries",
    "type": "textarea",
    "required": true,
    "label": "Who benefits from your innovation?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "workDuration",
    "type": "select",
    "required": true,
    "label": "How long have you worked on your project?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "implemented",
    "type": "select",
    "required": true,
    "label": "Have similar innovations been successfully implemented elsewhere?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "implementedWhere",
    "type": "textarea",
    "required": true,
    "label": "Where were they implemented, and with what results? Please give examples.",
    "hint": "",
    "conditional": true
   },
   {
    "key": "sdgs",
    "type": "checks",
    "required": false,
    "label": "UN Sustainable Development Goals supported by your innovation",
    "hint": "",
    "conditional": false
   }
  ]
 },
 {
  "id": "team",
  "title": "Your Team",
  "fields": [
   {
    "key": "roles",
    "type": "checks",
    "required": true,
    "label": "Your role in the innovation",
    "hint": "Select all that apply.",
    "conditional": false
   },
   {
    "key": "roleOther",
    "type": "multitext",
    "required": true,
    "label": "Specify your role",
    "hint": "",
    "conditional": true
   },
   {
    "key": "members",
    "type": "repeat",
    "required": true,
    "label": "Team members",
    "hint": "Include yourself and anyone else building the innovation. If you work alone, your own row is sufficient.",
    "conditional": false
   },
   {
    "key": "skills",
    "type": "checks",
    "required": true,
    "label": "What technical capabilities and relevant experience does your team have?",
    "hint": "Select all that apply.",
    "conditional": false
   },
   {
    "key": "skillsOther",
    "type": "multitext",
    "required": true,
    "label": "Specify other capabilities",
    "hint": "",
    "conditional": true
   }
  ]
 },
 {
  "id": "technical",
  "title": "Technical Background",
  "fields": [
   {
    "key": "technical",
    "type": "textarea",
    "required": true,
    "label": "How does your solution work technically? Describe the key components, technologies and materials involved.",
    "hint": "",
    "conditional": false
   },
   {
    "key": "prototypeStage",
    "type": "select",
    "required": true,
    "label": "Do you have a prototype?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "tested",
    "type": "select",
    "required": true,
    "label": "Have you tested your prototype?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "testedHow",
    "type": "textarea",
    "required": true,
    "label": "Describe how it was tested and the results.",
    "hint": "",
    "conditional": true
   },
   {
    "key": "testingPlan",
    "type": "textarea",
    "required": true,
    "label": "If not yet tested, explain what testing is planned.",
    "hint": "",
    "conditional": true
   },
   {
    "key": "builtBy",
    "type": "select",
    "required": true,
    "label": "Who developed the prototype?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "prototypePhotos",
    "type": "file",
    "required": false,
    "label": "Prototype photos",
    "hint": "Required for a working prototype or later stage.",
    "conditional": true
   },
   {
    "key": "prototypeDemo",
    "type": "file",
    "required": false,
    "label": "Prototype demo video",
    "hint": "",
    "conditional": true
   },
   {
    "key": "drawings",
    "type": "file",
    "required": false,
    "label": "Drawings, sketches, schematics or CAD files",
    "hint": "",
    "conditional": false
   }
  ]
 },
 {
  "id": "protection",
  "title": "Protection & Rules",
  "fields": [
   {
    "key": "ipStatus",
    "type": "select",
    "required": true,
    "label": "Intellectual property status",
    "hint": "",
    "conditional": false
   },
   {
    "key": "ipOwner",
    "type": "select",
    "required": false,
    "label": "Who owns the IP?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "ipOwnerOther",
    "type": "multitext",
    "required": true,
    "label": "Specify IP owner",
    "hint": "",
    "conditional": true
   },
   {
    "key": "regulatory",
    "type": "select",
    "required": true,
    "label": "Does it need a regulatory approval, certification or safety standard (e.g. medical, food, electrical)?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "regulatoryDetail",
    "type": "textarea",
    "required": true,
    "label": "Which approvals, certifications or standards?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "standardsCompliance",
    "type": "select",
    "required": false,
    "label": "Do the materials, components or system in your solution need to comply with recognised technical standards (e.g. ASTM, API, ISO)?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "standardsDetail",
    "type": "textarea",
    "required": true,
    "label": "Which standards apply, and how will you check or prove compliance?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "legalEntity",
    "type": "select",
    "required": false,
    "label": "Legal entity status",
    "hint": "",
    "conditional": false
   }
  ]
 },
 {
  "id": "market",
  "title": "Market & Business",
  "fields": [
   {
    "key": "targetCustomers",
    "type": "textarea",
    "required": true,
    "label": "Who are your target customers or users, and who benefits from it?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "competitors",
    "type": "textarea",
    "required": true,
    "label": "Who are your competitors or alternatives?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "businessPotential",
    "type": "select",
    "required": true,
    "label": "Could your idea become a business?",
    "hint": "Yes — clear potential; Maybe — not sure yet; No.",
    "conditional": false
   },
   {
    "key": "businessModel",
    "type": "select",
    "required": false,
    "label": "Business model",
    "hint": "",
    "conditional": false
   }
  ]
 },
 {
  "id": "support",
  "title": "Support from KII",
  "fields": [
   {
    "key": "supportTypes",
    "type": "checks",
    "required": true,
    "label": "What support do you need from KII?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "facilities",
    "type": "checks",
    "required": true,
    "label": "Which facilities do you need from KII?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "facilitiesOther",
    "type": "multitext",
    "required": true,
    "label": "Specify other facilities",
    "hint": "",
    "conditional": true
   },
   {
    "key": "prototypeNeeds",
    "type": "checks",
    "required": true,
    "label": "What do you need to build your first or next prototype?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "needsDetail",
    "type": "textarea",
    "required": true,
    "label": "Describe what you need for the prototype",
    "hint": "",
    "conditional": false
   },
   {
    "key": "reqCurrency",
    "type": "select",
    "required": true,
    "label": "Currency for the whole request",
    "hint": "One currency applies to every item below.",
    "conditional": true
   },
   {
    "key": "requirements",
    "type": "repeat",
    "required": true,
    "label": "Financial support request",
    "hint": "Costs are in the currency selected above.",
    "conditional": true
   },
   {
    "key": "otherSupport",
    "type": "select",
    "required": true,
    "label": "Have you received or applied for support from another organisation?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "organisations",
    "type": "repeat",
    "required": true,
    "label": "Other support",
    "hint": "",
    "conditional": true
   }
  ]
 },
 {
  "id": "statement",
  "title": "Applicant Statement & References",
  "fields": [
   {
    "key": "video",
    "type": "file",
    "required": true,
    "label": "Video statement",
    "hint": "Introduce yourself, your idea, and what you hope to gain from KII. Record directly in the browser or upload an MP4/WebM video, up to 60 seconds.",
    "conditional": false
   },
   {
    "key": "appliedBefore",
    "type": "select",
    "required": true,
    "label": "Have you applied to or joined KII before?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "beforeDetail",
    "type": "text",
    "required": true,
    "label": "When and which program?",
    "hint": "",
    "conditional": true
   },
   {
    "key": "heardFrom",
    "type": "select",
    "required": true,
    "label": "How did you hear about KII?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "heardOther",
    "type": "multitext",
    "required": true,
    "label": "Specify how you heard about KII",
    "hint": "",
    "conditional": true
   },
   {
    "key": "anythingElse",
    "type": "textarea",
    "required": false,
    "label": "Anything else you'd like us to know?",
    "hint": "",
    "conditional": false
   },
   {
    "key": "additional",
    "type": "file",
    "required": false,
    "label": "Additional document (optional)",
    "hint": "",
    "conditional": false
   }
  ]
 }
];
