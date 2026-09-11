/* =========================================================================
   SOLEMN ASSEMBLY 2026 — site configuration
   The ONLY line most people need to edit is API_URL.
   Use the SAME config.js on both the registrar site and the public site.
   ========================================================================= */
window.SA = {
  // Paste the Apps Script web app URL (ends in /exec) between the quotes.
  API_URL: "https://script.google.com/macros/s/AKfycby9mM6dGBNmVPEBUzUdA7RA6K3s--p5xQofr8JQdlY8--KLMjYy0os_7N0di-yV3HnR/exec",

  CODE_PREFIX: "SA26-",
  CODE_DIGITS: 4,

  EVENT: {
    host: "Revival Labour in Rivers State",
    name: "A Solemn Assembly of Believers",
    shortName: "Solemn Assembly 2026",
    theme: "Knowing & Sustaining God’s Purpose for Your Life",
    dates: "Wed 16 – Sun 20 September 2026",
    datesShort: "16–20 Sept 2026",
    times: "Wednesday 4:00 PM · Thursday to Saturday 7:30 AM",
    ministering: "Bro Mike Imoyera & Livingseed Team",
    venue: "The Presbyterian Church of Nigeria, Rumuomasi Parish",
    address: "10 Presbyterian Close, off Stadium Road, behind Casoni Hotel, Port Harcourt, Rivers State",
    office: "Peace House Office, #3 Iriebe Street, off Khana Street, D-Line, Port Harcourt",
    phone: "08065686286",
    email: "peacehouseport@yahoo.com",
    website: "https://www.livingseed.org"
  },

  TITLES: ["Bro.", "Sis.", "Mr.", "Mrs.", "Miss", "Dr.", "Pastor", "Rev.", "Evang.", "Elder", "Deacon",
    "Deaconess", "Prof.", "Engr.", "Barr.", "Chief", "Hon."],

  // The program is for Rivers State. "Rivers" is the saved value (the Dashboard counts it).
  STATES: [
    { value: "Rivers", label: "Rivers State" },
    { value: "Outside Rivers State", label: "Outside Rivers State" }
  ],

  RIVERS_LGAS: ["Abua/Odual", "Ahoada East", "Ahoada West", "Akuku-Toru", "Andoni", "Asari-Toru", "Bonny",
    "Degema", "Eleme", "Emohua", "Etche", "Gokana", "Ikwerre", "Khana", "Obio/Akpor",
    "Ogba/Egbema/Ndoni", "Ogu/Bolo", "Okrika", "Omuma", "Opobo/Nkoro", "Oyigbo", "Port Harcourt", "Tai"],

  HOW: ["Church announcement", "Discipleship class", "Friend / neighbour invite", "Flyer / handbill",
    "Social media", "WhatsApp", "Radio", "SMS", "Other"],

  TAG_TYPES: {
    participant: "Participant",
    resource: "Resource Person",
    ministering: "Ministering Team"
  }
};
