require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Inventory = require('../models/Inventory');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB for seeding');
};

// ── Sample Users ────────────────────────────────────────────
const users = [
  {
    name: 'Super Admin',
    email: 'admin@restaurant.com',
    password: 'Admin@123',
    role: 'admin',
    phone: '9876543210',
    isEmailVerified: true,
    isActive: true
  },
  {
    name: 'Head Chef Ravi',
    email: 'chef@restaurant.com',
    password: 'Chef@123',
    role: 'chef',
    phone: '9876543211',
    isEmailVerified: true,
    employeeId: 'EMP001',
    department: 'Kitchen',
    shift: 'morning',
    isActive: true
  },
  {
    name: 'Waiter Arjun',
    email: 'waiter@restaurant.com',
    password: 'Waiter@123',
    role: 'waiter',
    phone: '9876543212',
    isEmailVerified: true,
    employeeId: 'EMP002',
    department: 'Floor',
    shift: 'evening',
    isActive: true
  },
  {
    name: 'Priya Customer',
    email: 'customer@restaurant.com',
    password: 'Customer@123',
    role: 'customer',
    phone: '9876543213',
    isEmailVerified: true,
    isActive: true
  }
];

// ── Sample Menu Items ───────────────────────────────────────
const menuItems = [
  // Starters
  {
    name: 'Chicken Tikka',
    description: 'Tender chicken marinated in yogurt and spices, grilled to perfection in a tandoor oven.',
    category: 'starter',
    price: 320,
    isAvailable: true,
    isVegetarian: false,
    spiceLevel: 'medium',
    preparationTime: 20,
    calories: 280,
    tags: ['popular', 'tandoor', 'non-veg']
  },
  {
    name: 'Paneer Tikka',
    description: 'Soft cottage cheese cubes marinated with bell peppers and spices, grilled in tandoor.',
    category: 'starter',
    price: 280,
    isAvailable: true,
    isVegetarian: true,
    spiceLevel: 'mild',
    preparationTime: 15,
    tags: ['popular', 'tandoor', 'veg']
  },
  {
    name: 'Veg Spring Rolls',
    description: 'Crispy rolls stuffed with seasoned vegetables and glass noodles.',
    category: 'starter',
    price: 180,
    isAvailable: true,
    isVegetarian: true,
    isVegan: true,
    spiceLevel: 'mild',
    preparationTime: 12,
    tags: ['crispy', 'veg']
  },
  {
    name: 'Soup of the Day',
    description: 'Chef\'s special soup made fresh daily with seasonal ingredients.',
    category: 'soup',
    price: 150,
    isAvailable: true,
    isVegetarian: true,
    spiceLevel: 'none',
    preparationTime: 10,
    tags: ['fresh', 'healthy']
  },
  // Main Course
  {
    name: 'Butter Chicken',
    description: 'Succulent chicken in a rich, creamy tomato-based gravy with aromatic spices.',
    category: 'main_course',
    price: 420,
    isAvailable: true,
    isVegetarian: false,
    spiceLevel: 'medium',
    preparationTime: 25,
    calories: 520,
    tags: ['bestseller', 'creamy', 'non-veg']
  },
  {
    name: 'Dal Makhani',
    description: 'Slow-cooked black lentils in buttery tomato gravy, a North Indian classic.',
    category: 'main_course',
    price: 280,
    isAvailable: true,
    isVegetarian: true,
    spiceLevel: 'mild',
    preparationTime: 20,
    calories: 350,
    tags: ['classic', 'veg', 'healthy']
  },
  {
    name: 'Mutton Rogan Josh',
    description: 'Slow-cooked mutton in Kashmiri spice blend with whole spices.',
    category: 'main_course',
    price: 520,
    isAvailable: true,
    isVegetarian: false,
    spiceLevel: 'hot',
    preparationTime: 35,
    calories: 620,
    tags: ['signature', 'kashmiri']
  },
  {
    name: 'Palak Paneer',
    description: 'Fresh cottage cheese in smooth spinach gravy seasoned with Indian spices.',
    category: 'main_course',
    price: 300,
    isAvailable: true,
    isVegetarian: true,
    spiceLevel: 'mild',
    preparationTime: 20,
    calories: 380,
    tags: ['healthy', 'veg', 'popular']
  },
  // Bread
  {
    name: 'Garlic Naan',
    description: 'Soft leavened flatbread with garlic and butter, baked in tandoor.',
    category: 'bread',
    price: 60,
    isAvailable: true,
    isVegetarian: true,
    preparationTime: 8,
    tags: ['bread', 'veg']
  },
  {
    name: 'Butter Roti',
    description: 'Whole wheat flatbread served with fresh butter.',
    category: 'bread',
    price: 40,
    isAvailable: true,
    isVegetarian: true,
    preparationTime: 5,
    tags: ['bread', 'veg', 'healthy']
  },
  // Desserts
  {
    name: 'Gulab Jamun',
    description: 'Soft milk solid dumplings soaked in rose-flavored sugar syrup.',
    category: 'dessert',
    price: 120,
    isAvailable: true,
    isVegetarian: true,
    preparationTime: 5,
    calories: 300,
    tags: ['sweet', 'classic', 'popular']
  },
  {
    name: 'Mango Kulfi',
    description: 'Traditional Indian ice cream made with condensed milk and real Alphonso mangoes.',
    category: 'dessert',
    price: 150,
    isAvailable: true,
    isVegetarian: true,
    preparationTime: 3,
    calories: 220,
    tags: ['cold', 'mango', 'summer']
  },
  {
    name: 'Chocolate Lava Cake',
    description: 'Warm dark chocolate cake with a gooey molten center, served with vanilla ice cream.',
    category: 'dessert',
    price: 220,
    isAvailable: true,
    isVegetarian: true,
    preparationTime: 15,
    calories: 450,
    tags: ['chocolate', 'indulgent', 'bestseller']
  },
  // Beverages
  {
    name: 'Mango Lassi',
    description: 'Thick, creamy yogurt-based drink blended with fresh Alphonso mangoes.',
    category: 'beverage',
    price: 120,
    isAvailable: true,
    isVegetarian: true,
    isGlutenFree: true,
    preparationTime: 5,
    calories: 180,
    tags: ['cold', 'refreshing', 'mango']
  },
  {
    name: 'Fresh Lime Soda',
    description: 'Freshly squeezed lime with sparkling soda, choice of sweet or salted.',
    category: 'beverage',
    price: 80,
    isAvailable: true,
    isVegetarian: true,
    isVegan: true,
    isGlutenFree: true,
    preparationTime: 3,
    calories: 60,
    tags: ['refreshing', 'healthy', 'vegan']
  },
  {
    name: 'Masala Chai',
    description: 'Traditional Indian spiced tea brewed with ginger, cardamom, and fresh milk.',
    category: 'beverage',
    price: 60,
    isAvailable: true,
    isVegetarian: true,
    preparationTime: 5,
    calories: 80,
    tags: ['hot', 'classic', 'tea']
  },
  // Special
  {
    name: 'Weekend Thali',
    description: 'A royal spread: 2 curries, dal, rice, 3 rotis, salad, pickle, papad, and dessert.',
    category: 'special',
    price: 580,
    discountPrice: 499,
    isAvailable: true,
    isVegetarian: true,
    spiceLevel: 'medium',
    preparationTime: 20,
    calories: 950,
    isFeatured: true,
    tags: ['value', 'combo', 'special', 'veg']
  },
  {
    name: 'Biryani Combo',
    description: 'Aromatic basmati rice biryani with raita, mirchi ka salan, and Biryani gravy.',
    category: 'combo',
    price: 480,
    isAvailable: true,
    isVegetarian: false,
    spiceLevel: 'medium',
    preparationTime: 30,
    calories: 750,
    isPopular: true,
    isFeatured: true,
    tags: ['biryani', 'combo', 'popular']
  }
];

// ── Sample Tables ───────────────────────────────────────────
const tables = [
  { tableNumber: 1, capacity: 2, location: 'indoor', status: 'available', features: ['window_view'] },
  { tableNumber: 2, capacity: 2, location: 'indoor', status: 'available' },
  { tableNumber: 3, capacity: 4, location: 'indoor', status: 'available' },
  { tableNumber: 4, capacity: 4, location: 'indoor', status: 'available', features: ['near_stage'] },
  { tableNumber: 5, capacity: 6, location: 'indoor', status: 'available' },
  { tableNumber: 6, capacity: 6, location: 'indoor', status: 'available' },
  { tableNumber: 7, capacity: 8, location: 'indoor', status: 'available', features: ['private'] },
  { tableNumber: 8, capacity: 2, location: 'outdoor', status: 'available', features: ['window_view'] },
  { tableNumber: 9, capacity: 4, location: 'outdoor', status: 'available' },
  { tableNumber: 10, capacity: 4, location: 'outdoor', status: 'available' },
  { tableNumber: 11, capacity: 6, location: 'outdoor', status: 'available' },
  { tableNumber: 12, capacity: 10, location: 'private', status: 'available', features: ['private', 'accessible'] },
  { tableNumber: 13, capacity: 2, location: 'rooftop', status: 'available', features: ['window_view'] },
  { tableNumber: 14, capacity: 4, location: 'rooftop', status: 'available' },
  { tableNumber: 15, capacity: 4, location: 'bar', status: 'available', features: ['booth'] }
];

// ── Sample Inventory ────────────────────────────────────────
const inventory = [
  { name: 'Chicken', category: 'meat', unit: 'kg', currentStock: 25, minimumStock: 5, unitPrice: 220, supplier: { name: 'Fresh Farms', phone: '9876500001' } },
  { name: 'Mutton', category: 'meat', unit: 'kg', currentStock: 15, minimumStock: 3, unitPrice: 650, supplier: { name: 'Fresh Farms', phone: '9876500001' } },
  { name: 'Paneer', category: 'dairy', unit: 'kg', currentStock: 10, minimumStock: 2, unitPrice: 280 },
  { name: 'Tomatoes', category: 'vegetable', unit: 'kg', currentStock: 20, minimumStock: 5, unitPrice: 40 },
  { name: 'Onions', category: 'vegetable', unit: 'kg', currentStock: 30, minimumStock: 10, unitPrice: 30 },
  { name: 'Ginger', category: 'vegetable', unit: 'kg', currentStock: 5, minimumStock: 1, unitPrice: 120 },
  { name: 'Garlic', category: 'vegetable', unit: 'kg', currentStock: 4, minimumStock: 1, unitPrice: 150 },
  { name: 'Butter', category: 'dairy', unit: 'kg', currentStock: 8, minimumStock: 2, unitPrice: 450 },
  { name: 'Cream', category: 'dairy', unit: 'l', currentStock: 10, minimumStock: 2, unitPrice: 120 },
  { name: 'Basmati Rice', category: 'grain', unit: 'kg', currentStock: 50, minimumStock: 10, unitPrice: 90 },
  { name: 'Wheat Flour', category: 'grain', unit: 'kg', currentStock: 40, minimumStock: 10, unitPrice: 45 },
  { name: 'Cumin Seeds', category: 'spice', unit: 'kg', currentStock: 3, minimumStock: 0.5, unitPrice: 350 },
  { name: 'Garam Masala', category: 'spice', unit: 'kg', currentStock: 2, minimumStock: 0.3, unitPrice: 800 },
  { name: 'Sunflower Oil', category: 'oil', unit: 'l', currentStock: 20, minimumStock: 5, unitPrice: 130 },
  { name: 'Mango Pulp', category: 'fruit', unit: 'kg', currentStock: 8, minimumStock: 2, unitPrice: 180 },
  { name: 'Milk', category: 'dairy', unit: 'l', currentStock: 30, minimumStock: 10, unitPrice: 60 },
  { name: 'Lemons', category: 'fruit', unit: 'kg', currentStock: 5, minimumStock: 1, unitPrice: 80 },
  { name: 'Spinach', category: 'vegetable', unit: 'kg', currentStock: 6, minimumStock: 2, unitPrice: 50 },
  { name: 'Chocolate', category: 'other', unit: 'kg', currentStock: 4, minimumStock: 1, unitPrice: 700 },
  { name: 'Yogurt', category: 'dairy', unit: 'kg', currentStock: 12, minimumStock: 3, unitPrice: 80 }
];

// ── Seeder ──────────────────────────────────────────────────
const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('\n🌱 Starting database seeding...\n');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      MenuItem.deleteMany({}),
      Table.deleteMany({}),
      Inventory.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing data');

    // Seed Users (password hashing handled by model hook)
    const createdUsers = await User.insertMany(
      await Promise.all(users.map(async (u) => ({
        ...u,
        password: await bcrypt.hash(u.password, 12)
      })))
    );
    console.log(`👥 Seeded ${createdUsers.length} users`);

    const admin = createdUsers.find(u => u.role === 'admin');

    // Seed Menu Items
    const menuWithCreator = menuItems.map(item => ({ ...item, createdBy: admin._id }));
    const createdMenu = await MenuItem.insertMany(menuWithCreator);
    console.log(`🍽️  Seeded ${createdMenu.length} menu items`);

    // Seed Tables
    const createdTables = await Table.insertMany(tables);
    console.log(`🪑 Seeded ${createdTables.length} tables`);

    // Seed Inventory
    const createdInventory = await Inventory.insertMany(inventory);
    console.log(`📦 Seeded ${createdInventory.length} inventory items`);

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('━'.repeat(50));
    console.log('📋 Test Credentials:');
    console.log('━'.repeat(50));
    console.log(`👑 Admin    → admin@restaurant.com    / Admin@123`);
    console.log(`👨‍🍳 Chef     → chef@restaurant.com     / Chef@123`);
    console.log(`🧑‍💼 Waiter   → waiter@restaurant.com   / Waiter@123`);
    console.log(`👤 Customer → customer@restaurant.com  / Customer@123`);
    console.log('━'.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
