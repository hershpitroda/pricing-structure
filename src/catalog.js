// BUROSYS desking catalog — single source of truth for finishes, prices, rules.
// Prices in INR. Base per-user figures derive from the Flexi (MS understructure)
// rows of the 09.05.26 pricelist, with the bundled drawer pedestal unbundled so
// pedestals can be priced as add-ons. Anything marked TBC is a placeholder.

export const CURRENCY = '₹';
export const money = (n) => CURRENCY + Math.round(n).toLocaleString('en-IN');

export const TOPS = [
  { id: 'walnut', name: 'Walnut',      hex: '#5A3A26', rough: 0.55 },
  { id: 'maple',  name: 'Maple',       hex: '#D9B47F', rough: 0.55 },
  { id: 'oak',    name: 'Oak',         hex: '#B0864F', rough: 0.55 },
  { id: 'white',  name: 'White',       hex: '#EFEEE9', rough: 0.45 },
  { id: 'silver', name: 'Silver Grey', hex: '#B6B6B1', rough: 0.5  },
];

export const FRAMES = [
  { id: 'lightgrey', name: 'Light Grey',   hex: '#C4C4BF' },
  { id: 'beige',     name: 'Beige',        hex: '#CFC1A6' },
  { id: 'pista',     name: 'Pista Green',  hex: '#8FAE7C' },
  { id: 'orange',    name: 'Burnt Orange', hex: '#B8511F' },
  { id: 'black',     name: 'Black',        hex: '#1B1B1A' },
  { id: 'white',     name: 'White',        hex: '#F1F1ED' },
];

export const GLASS = [
  { id: 'pista',   name: 'Light Pista',  hex: '#A9C79D' },
  { id: 'clear',   name: 'Clear',        hex: '#CBDDE4' },
  { id: 'frosted', name: 'Frosted White',hex: '#E2E6E3' },
  { id: 'orange',  name: 'Burnt Orange', hex: '#DC8B58' },
  { id: 'sky',     name: 'Sky Blue',     hex: '#93B9D6' },
];

export const PEDCOLS = [
  { id: 'white',     name: 'White',       hex: '#F1F1ED' },
  { id: 'lightgrey', name: 'Light Grey',  hex: '#C4C4BF' },
  { id: 'silver',    name: 'Silver Grey', hex: '#B6B6B1' },
  { id: 'beige',     name: 'Beige',       hex: '#CFC1A6' },
  { id: 'black',     name: 'Black',       hex: '#1B1B1A' },
];

export const find = (list, id) => list.find((x) => x.id === id) || list[0];

// ---------------------------------------------------------------- products

export const PRODUCTS = [
  { id: 'share2',  group: 'Sharing',     name: 'Sharing 2 PAX',      seats: 2, formation: 'sharing',    size: 'L1200 × D600 / user', unit: 15400 },
  { id: 'share4',  group: 'Sharing',     name: 'Sharing 4 PAX',      seats: 4, formation: 'sharing',    size: 'L1200 × D600 / user', unit: 15400 },
  { id: 'share6',  group: 'Sharing',     name: 'Sharing 6 PAX',      seats: 6, formation: 'sharing',    size: 'L1200 × D600 / user', unit: 15400 },
  { id: 'share8',  group: 'Sharing',     name: 'Sharing 8 PAX',      seats: 8, formation: 'sharing',    size: 'L1200 × D600 / user', unit: 15400 },
  { id: 'single1', group: 'Non Sharing', name: 'Single Workstation', seats: 1, formation: 'single',     size: 'L1200 × D600',        unit: 33300 },
  { id: 'ns2',     group: 'Non Sharing', name: 'Non Sharing 2 PAX',  seats: 2, formation: 'nonsharing', size: 'L1200 × D600 / user', unit: 25300 },
  { id: 'ns3',     group: 'Non Sharing', name: 'Non Sharing 3 PAX',  seats: 3, formation: 'nonsharing', size: 'L1200 × D600 / user', unit: 25300 },
  { id: 'manager', group: 'Cabins',      name: 'Manager + Return',   seats: 1, formation: 'manager',    size: 'L1500 × D750 + return', unit: 51800 },
  { id: 'cabin',   group: 'Cabins',      name: 'Cabin + Side Unit',  seats: 1, formation: 'cabin',      size: 'L1800 × D750 + 1800 SU', unit: 54100 },
  { id: 'meet24',  group: 'Meeting',     name: 'Meeting 6 Seater',   seats: 6, formation: 'meet24',     size: '2400 × 1200',         unit: 8450 },
  { id: 'meet36',  group: 'Meeting',     name: 'Meeting 10 Seater',  seats: 10, formation: 'meet36',    size: '3600 × 1200',         unit: 7170 },
];

export const SPEC_LINES = {
  sharing:    ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', 'Full modesty + glass upper screen', '450 mm access flap electrification', 'Cable tray concealed under top'],
  nonsharing: ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', 'Rear modesty + glass upper screen', '450 mm access flap electrification', 'Cable tray concealed under top'],
  single:     ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', 'Rear modesty + glass upper screen', '450 mm access flap electrification'],
  manager:    ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', 'Side return 900 × 450', '450 mm access flap electrification'],
  cabin:      ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', 'Standard PLPB side unit 1800', '450 mm access flap electrification', 'Apron'],
  meet24:     ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', '2-way access flap electrification, 2 nos'],
  meet36:     ['PLMDF top, BSL edge', 'PC MS understructure (Flexi)', '2-way access flap electrification, 3 nos'],
};

// Pedestals (per user). TBC pricing.
export const PEDESTALS = [
  { id: 'none',  name: 'None',                  price: 0 },
  { id: 'd3',    name: '3-drawer mobile',       price: 6500, drawers: 3 },
  { id: 'd2f',   name: '2-drawer + filing',     price: 7200, drawers: 2, filing: true },
  { id: 'caddy', name: 'Mobile caddy, cushion', price: 5400, drawers: 1, cushion: true },
];

// Per-seat add-ons. TBC pricing.
export const ADDONS = [
  { id: 'arm',     name: 'Monitor arm',        price: 4800 },
  { id: 'stand',   name: 'Monitor stand',      price: 2400 },
  { id: 'kbtray',  name: 'Keyboard tray',      price: 1800 },
  { id: 'cpu',     name: 'CPU holder',         price: 1900 },
  { id: 'footrest',name: 'Footrest',           price: 1600 },
  { id: 'mat',     name: 'Desk mat',           price: 1200 },
  { id: 'light',   name: 'Table light',        price: 3600 },
  { id: 'charger', name: 'Wireless charger',   price: 2800 },
  { id: 'power',   name: 'Power / data box',   price: 4200 },
  { id: 'grommet', name: 'Cable riser grommet',price: 600  },
  { id: 'sidescr', name: 'Side screen',        price: 3200 },
  { id: 'planter', name: 'Planter box on screen', price: 3400 },
];

export const CHAIR = { id: 'chair', name: 'Task chair', price: 9500 };

// Styling & extras, priced per office. TBC pricing.
export const STYLING = [
  { id: 'rug',     name: 'Rugs',              price: 8000,  per: 'zone' },
  { id: 'planters',name: 'Planters',          price: 2500,  per: 'unit' },
  { id: 'lighting',name: 'Pendant lighting',  price: 4000,  per: 'unit' },
  { id: 'tech',    name: 'Tech accessories',  price: 6000,  per: 'pack' },
  { id: 'merch',   name: 'Company merch',     price: 5000,  per: 'pack' },
  { id: 'lockers', name: 'Storage / lockers', price: 18000, per: 'bank' },
  { id: 'soft',    name: 'Soft seating',      price: 35000, per: 'set' },
];

// ------------------------------------------------------- space planning
// Industry norm figures, shown on screen so they can be challenged.
export const RULES = {
  circulation: 0.12,        // of gross area
  sqftPerWorkstation: 28,   // bench sharing footprint + immediate access
  cabinSqft: 85,
  meetingSqft: 110,
  staffPerCabin: 10,
  staffPerMeetingRoom: 15,
};

export function planOffice(sqft, headcount) {
  const usable = sqft * (1 - RULES.circulation);
  const cabins = Math.max(1, Math.round(headcount / RULES.staffPerCabin));
  const meetings = Math.max(1, Math.round(headcount / RULES.staffPerMeetingRoom));
  const wsStaff = Math.max(0, headcount - cabins);

  // Prefer 4 PAX sharing clusters; remainder becomes a smaller sharing cluster.
  const clusters = [];
  let left = wsStaff;
  while (left >= 4) { clusters.push({ product: 'share4', seats: 4 }); left -= 4; }
  if (left === 3) clusters.push({ product: 'ns3', seats: 3 });
  if (left === 2) clusters.push({ product: 'share2', seats: 2 });
  if (left === 1) clusters.push({ product: 'single1', seats: 1 });

  const need = wsStaff * RULES.sqftPerWorkstation + cabins * RULES.cabinSqft + meetings * RULES.meetingSqft;
  return {
    sqft, headcount, usable: Math.round(usable), required: Math.round(need),
    fits: need <= usable, clusters, cabins, meetings, wsStaff,
    utilisation: Math.min(999, Math.round((need / usable) * 100)),
  };
}

export const SETS = [
  { id: 's500',  sqft: 500,  headcount: 9,  name: 'Studio',    blurb: '8 seats · 1 meeting · 1 cabin' },
  { id: 's800',  sqft: 800,  headcount: 14, name: 'Practice',  blurb: '13 seats · 1 meeting · 1 cabin' },
  { id: 's1200', sqft: 1200, headcount: 21, name: 'Floorplate',blurb: '19 seats · 1 meeting · 2 cabins' },
];

export const OFFER = { pct: 15, window: '60 minutes', note: 'Book within 60 minutes of your quote to claim 15% off list.' };
export const ENQUIRY_EMAIL = 'hello@burosys.com';
