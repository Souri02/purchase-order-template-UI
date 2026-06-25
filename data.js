// Sample product "database". In a real app this would be a backend lookup
// keyed by the scanned barcode. Here we simulate a scan returning one of these.
const PRODUCT_DB = [
  {
    barcode: "012000161155",
    name: "Pepsi Cola",
    variant: "12 oz Can · 24-pack",
    sku: "PEP-12OZ-24",
    unitPrice: 11.49,
    image: "🥤",
  },
  {
    barcode: "049000050103",
    name: "Coca-Cola Classic",
    variant: "20 oz Bottle · 24-pack",
    sku: "COK-20OZ-24",
    unitPrice: 23.99,
    image: "🧴",
  },
  {
    barcode: "028400090858",
    name: "Lay's Classic Chips",
    variant: "1 oz Bag · 64-count",
    sku: "LAY-1OZ-64",
    unitPrice: 28.5,
    image: "🥔",
  },
  {
    barcode: "012000005237",
    name: "Mountain Dew",
    variant: "12 oz Can · 12-pack",
    sku: "MTD-12OZ-12",
    unitPrice: 6.99,
    image: "🥤",
  },
  {
    barcode: "078000113464",
    name: "7UP Lemon Lime",
    variant: "2 L Bottle · 8-pack",
    sku: "7UP-2L-08",
    unitPrice: 14.25,
    image: "🧴",
  },
  {
    barcode: "044000032029",
    name: "Oreo Cookies",
    variant: "14.3 oz Pack · 12-count",
    sku: "ORE-14OZ-12",
    unitPrice: 39.0,
    image: "🍪",
  },
  // Fresh produce / items with no (or damaged) barcode — found via name search only
  {
    barcode: null,
    name: "Bananas",
    variant: "Fresh · per lb",
    sku: "PRD-BANANA",
    unitPrice: 0.59,
    image: "🍌",
  },
  {
    barcode: null,
    name: "Roma Tomatoes",
    variant: "Fresh · per lb",
    sku: "PRD-TOMATO",
    unitPrice: 1.29,
    image: "🍅",
  },
  {
    barcode: null,
    name: "Gala Apples",
    variant: "Fresh · per case",
    sku: "PRD-APPLE",
    unitPrice: 24.0,
    image: "🍎",
  },
  {
    barcode: null,
    name: "Yellow Onions",
    variant: "Fresh · 50 lb bag",
    sku: "PRD-ONION",
    unitPrice: 18.5,
    image: "🧅",
  },
];

// Store-access config. A basic user is tied to their own store by default.
// If they have multi-store access, the Ship-to becomes a multi-option select.
const USER_PROFILE = {
  name: "Fremont User",
  homeStore: "Fremont Store — 39201 Cherry St, Fremont, CA",
  // set to true to demonstrate multi-store access
  multiStoreAccess: true,
  accessibleStores: [
    "Fremont Store — 39201 Cherry St, Fremont, CA",
    "San Jose Store — 1410 Monterey Rd, San Jose, CA",
    "Hayward Store — 880 A St, Hayward, CA",
  ],
};
