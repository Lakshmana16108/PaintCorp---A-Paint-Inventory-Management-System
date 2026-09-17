// Initial paint inventory items
export const initialPaints = [
  {
    id: "PNT001",
    name: "WeatherShield Max",
    brand: "Dulux",
    category: "Exterior",
    color: "Arctic White",
    finish: "Semi-Gloss",
    price: 3679.20,
    quantity: 120,
    status: "In Stock"
  },
  {
    id: "PNT002",
    name: "Royale Luxury Emulsion",
    brand: "Asian Paints",
    category: "Interior",
    color: "Soft Beige",
    finish: "Matte",
    price: 3160.00,
    quantity: 85,
    status: "In Stock"
  },
  {
    id: "PNT003",
    name: "Super Premium Enamel",
    brand: "Nippon",
    category: "Wood & Metal",
    color: "Forest Green",
    finish: "Gloss",
    price: 2399.20,
    quantity: 15,
    status: "Low Stock"
  },
  {
    id: "PNT004",
    name: "Aquashield Waterproofing",
    brand: "Berger",
    category: "Exterior",
    color: "Slate Gray",
    finish: "Matte",
    price: 4320.00,
    quantity: 60,
    status: "In Stock"
  },
  {
    id: "PNT005",
    name: "EasyClean Stain Resistant",
    brand: "Dulux",
    category: "Interior",
    color: "Lemon Yellow",
    finish: "Satin",
    price: 2799.20,
    quantity: 8,
    status: "Low Stock"
  },
  {
    id: "PNT006",
    name: "UltraHide Primer",
    brand: "Nippon",
    category: "Primer",
    color: "Neutral White",
    finish: "Matte",
    price: 1960.00,
    quantity: 0,
    status: "Out of Stock"
  },
  {
    id: "PNT007",
    name: "Apex Ultima Protect",
    brand: "Asian Paints",
    category: "Exterior",
    color: "Terracotta Red",
    finish: "Satin",
    price: 4660.00,
    quantity: 110,
    status: "In Stock"
  }
];

// Initial warehouse stock configurations
export const initialStock = [
  {
    paintId: "PNT001",
    paintName: "WeatherShield Max",
    brand: "Dulux",
    warehouse: "Central Warehouse A",
    quantity: 80,
    minQuantity: 20,
    status: "In Stock" // Green
  },
  {
    paintId: "PNT001",
    paintName: "WeatherShield Max",
    brand: "Dulux",
    warehouse: "East Wing Depot",
    quantity: 40,
    minQuantity: 15,
    status: "In Stock" // Green
  },
  {
    paintId: "PNT002",
    paintName: "Royale Luxury Emulsion",
    brand: "Asian Paints",
    warehouse: "Central Warehouse A",
    quantity: 50,
    minQuantity: 20,
    status: "In Stock" // Green
  },
  {
    paintId: "PNT002",
    paintName: "Royale Luxury Emulsion",
    brand: "Asian Paints",
    warehouse: "South Gate facility",
    quantity: 35,
    minQuantity: 15,
    status: "In Stock" // Green
  },
  {
    paintId: "PNT003",
    paintName: "Super Premium Enamel",
    brand: "Nippon",
    warehouse: "Central Warehouse A",
    quantity: 5,
    minQuantity: 20,
    status: "Low Stock" // Red (<= minQuantity)
  },
  {
    paintId: "PNT003",
    paintName: "Super Premium Enamel",
    brand: "Nippon",
    warehouse: "East Wing Depot",
    quantity: 10,
    minQuantity: 12,
    status: "Low Stock" // Red
  },
  {
    paintId: "PNT004",
    paintName: "Aquashield Waterproofing",
    brand: "Berger",
    warehouse: "Central Warehouse A",
    quantity: 60,
    minQuantity: 20,
    status: "In Stock" // Green
  },
  {
    paintId: "PNT005",
    paintName: "EasyClean Stain Resistant",
    brand: "Dulux",
    warehouse: "Central Warehouse A",
    quantity: 8,
    minQuantity: 15,
    status: "Low Stock" // Red
  },
  {
    paintId: "PNT006",
    paintName: "UltraHide Primer",
    brand: "Nippon",
    warehouse: "East Wing Depot",
    quantity: 0,
    minQuantity: 25,
    status: "Out of Stock" // Red
  },
  {
    paintId: "PNT007",
    paintName: "Apex Ultima Protect",
    brand: "Asian Paints",
    warehouse: "South Gate facility",
    quantity: 110,
    minQuantity: 30,
    status: "In Stock" // Green
  }
];

// Initial customer orders
export const initialOrders = [
  {
    id: "ORD101",
    customerName: "Alex Mercer",
    customerPhone: "+1 (555) 019-2834",
    customerAddress: "452 Pine St, New York, NY",
    paintName: "WeatherShield Max",
    paintId: "PNT001",
    quantity: 10,
    price: 3679.20,
    date: "2026-08-07",
    status: "Delivered"
  },
  {
    id: "ORD102",
    customerName: "Sarah Connor",
    customerPhone: "+1 (555) 022-9110",
    customerAddress: "882 Oak Ave, Los Angeles, CA",
    paintName: "Royale Luxury Emulsion",
    paintId: "PNT002",
    quantity: 5,
    price: 3160.00,
    date: "2026-08-08",
    status: "Pending"
  },
  {
    id: "ORD103",
    customerName: "Bruce Wayne",
    customerPhone: "+1 (555) 007-1939",
    customerAddress: "1007 Mountain Drive, Gotham",
    paintName: "Aquashield Waterproofing",
    paintId: "PNT004",
    quantity: 25,
    price: 4320.00,
    date: "2026-08-08",
    status: "Processing"
  },
  {
    id: "ORD104",
    customerName: "Clark Kent",
    customerPhone: "+1 (555) 045-1234",
    customerAddress: "344 Clinton St, Metropolis",
    paintName: "Super Premium Enamel",
    paintId: "PNT003",
    quantity: 2,
    price: 2399.20,
    date: "2026-08-08",
    status: "Packed"
  }
];
