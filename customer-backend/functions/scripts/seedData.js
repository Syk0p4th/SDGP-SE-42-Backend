const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ============================================================
// CATEGORIES
// ============================================================
const categories = [
  {
    id: 'basic-wash',
    name: 'Basic Wash',
    icon: 'droplets',
    description: 'Standard exterior wash to remove dirt and grime',
    isActive: true,
  },
  {
    id: 'premium-wash',
    name: 'Premium Wash',
    icon: 'sparkles',
    description: 'Full exterior and interior deep cleaning',
    isActive: true,
  },
  {
    id: 'detailing',
    name: 'Detailing',
    icon: 'star',
    description: 'Professional detailing with wax and polish',
    isActive: true,
  },
  {
    id: 'interior-clean',
    name: 'Interior Clean',
    icon: 'car',
    description: 'Complete interior vacuum and sanitize',
    isActive: true,
  },
  {
    id: 'ceramic-coating',
    name: 'Ceramic Coating',
    icon: 'shield',
    description: 'Long-lasting ceramic coating protection',
    isActive: true,
  },
  {
    id: 'tire-cleaning',
    name: 'Tire & Wheel',
    icon: 'circle',
    description: 'Tire and wheel cleaning and polishing',
    isActive: true,
  },
];

// ============================================================
// PROVIDERS (Individual washers - like Uber drivers)
// ============================================================
const providers = [
  {
    uid: 'provider_001',
    displayName: 'Rajesh Perera',
    email: 'rajesh.perera@email.com',
    phoneNumber: '+94771111111',
    photoURL: 'https://i.pravatar.cc/150?img=1',
    area: 'Colombo 3',
    location: { latitude: 6.9027, longitude: 79.8463 },
    rating: 4.8,
    totalReviews: 124,
    totalBookings: 350,
    isActive: true,
    isVerified: true,
    memberSince: '2023-03-15',
    bio: 'I\'ve been washing cars for over 5 years. Careful with every vehicle, guaranteed satisfaction.',
    workingHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '17:00' },
      sunday: { open: '10:00', close: '15:00' },
    },
  },
  {
    uid: 'provider_002',
    displayName: 'Nuwan Silva',
    email: 'nuwan.silva@email.com',
    phoneNumber: '+94772222222',
    photoURL: 'https://i.pravatar.cc/150?img=2',
    area: 'Colombo 4',
    location: { latitude: 6.8943, longitude: 79.8482 },
    rating: 4.6,
    totalReviews: 89,
    totalBookings: 210,
    isActive: true,
    isVerified: true,
    memberSince: '2023-06-20',
    bio: 'I only use eco-friendly products. Your car stays clean, the environment stays safe.',
    workingHours: {
      monday: { open: '07:00', close: '19:00' },
      tuesday: { open: '07:00', close: '19:00' },
      wednesday: { open: '07:00', close: '19:00' },
      thursday: { open: '07:00', close: '19:00' },
      friday: { open: '07:00', close: '19:00' },
      saturday: { open: '08:00', close: '18:00' },
      sunday: { open: 'closed', close: 'closed' },
    },
  },
  {
    uid: 'provider_003',
    displayName: 'Ashen Jayawardena',
    email: 'ashen.jay@email.com',
    phoneNumber: '+94773333333',
    photoURL: 'https://i.pravatar.cc/150?img=3',
    area: 'Colombo 7',
    location: { latitude: 6.9165, longitude: 79.8428 },
    rating: 4.9,
    totalReviews: 203,
    totalBookings: 520,
    isActive: true,
    isVerified: true,
    memberSince: '2022-11-01',
    bio: 'Certified detailer with professional training. I treat every car like it\'s my own.',
    workingHours: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: { open: '10:00', close: '16:00' },
      sunday: { open: 'closed', close: 'closed' },
    },
  },
  {
    uid: 'provider_004',
    displayName: 'Chaminda Rathnayake',
    email: 'chaminda.r@email.com',
    phoneNumber: '+94774444444',
    photoURL: 'https://i.pravatar.cc/150?img=4',
    area: 'Nugegoda',
    location: { latitude: 6.8835, longitude: 79.8764 },
    rating: 4.3,
    totalReviews: 56,
    totalBookings: 140,
    isActive: true,
    isVerified: true,
    memberSince: '2024-01-10',
    bio: 'Mobile washer — I come to you! No need to drive anywhere. Fast and reliable.',
    workingHours: {
      monday: { open: '08:00', close: '20:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { open: '08:00', close: '20:00' },
      thursday: { open: '08:00', close: '20:00' },
      friday: { open: '08:00', close: '20:00' },
      saturday: { open: '08:00', close: '20:00' },
      sunday: { open: '09:00', close: '18:00' },
    },
  },
  {
    uid: 'provider_005',
    displayName: 'Dilantha Mendis',
    email: 'dilantha.m@email.com',
    phoneNumber: '+94775555555',
    photoURL: 'https://i.pravatar.cc/150?img=5',
    area: 'Kotte',
    location: { latitude: 6.9006, longitude: 79.8934 },
    rating: 4.5,
    totalReviews: 72,
    totalBookings: 180,
    isActive: true,
    isVerified: true,
    memberSince: '2023-08-05',
    bio: 'I use waterless washing technology. Saves water and keeps your car looking great.',
    workingHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '17:00' },
      sunday: { open: 'closed', close: 'closed' },
    },
  },
];

// ============================================================
// SERVICES
// ============================================================
const services = [
  // Rajesh Perera
  {
    id: 'svc_001',
    providerId: 'provider_001',
    categoryId: 'basic-wash',
    name: 'Basic Exterior Wash',
    description: 'Full exterior wash including body, wheels, and windows.',
    price: 800,
    currency: 'LKR',
    duration: 30,
    isActive: true,
    rating: 4.7,
    reviewCount: 45,
    images: [],
  },
  {
    id: 'svc_002',
    providerId: 'provider_001',
    categoryId: 'premium-wash',
    name: 'Premium Full Wash',
    description: 'Full interior and exterior wash. Includes vacuuming, dashboard cleaning, seat shampoo, and exterior polish.',
    price: 2500,
    currency: 'LKR',
    duration: 90,
    isActive: true,
    rating: 4.8,
    reviewCount: 38,
    images: [],
  },
  {
    id: 'svc_003',
    providerId: 'provider_001',
    categoryId: 'tire-cleaning',
    name: 'Tire & Wheel Detailing',
    description: 'Deep clean and polish all four tires and wheels.',
    price: 600,
    currency: 'LKR',
    duration: 25,
    isActive: true,
    rating: 4.6,
    reviewCount: 20,
    images: [],
  },
  // Nuwan Silva
  {
    id: 'svc_004',
    providerId: 'provider_002',
    categoryId: 'basic-wash',
    name: 'Eco Exterior Wash',
    description: 'Exterior wash using only biodegradable products.',
    price: 750,
    currency: 'LKR',
    duration: 35,
    isActive: true,
    rating: 4.5,
    reviewCount: 30,
    images: [],
  },
  {
    id: 'svc_005',
    providerId: 'provider_002',
    categoryId: 'interior-clean',
    name: 'Deep Interior Clean',
    description: 'Thorough interior cleaning including seats, carpets, dashboard, and air freshening.',
    price: 1800,
    currency: 'LKR',
    duration: 60,
    isActive: true,
    rating: 4.7,
    reviewCount: 25,
    images: [],
  },
  {
    id: 'svc_006',
    providerId: 'provider_002',
    categoryId: 'premium-wash',
    name: 'Eco Full Wash',
    description: 'Complete interior and exterior wash using eco-friendly products.',
    price: 2200,
    currency: 'LKR',
    duration: 80,
    isActive: true,
    rating: 4.6,
    reviewCount: 18,
    images: [],
  },
  // Ashen Jayawardena
  {
    id: 'svc_007',
    providerId: 'provider_003',
    categoryId: 'detailing',
    name: 'Full Detailing',
    description: 'Professional full detailing. Clay bar, paint correction, interior steam clean.',
    price: 8000,
    currency: 'LKR',
    duration: 240,
    isActive: true,
    rating: 4.9,
    reviewCount: 67,
    images: [],
  },
  {
    id: 'svc_008',
    providerId: 'provider_003',
    categoryId: 'ceramic-coating',
    name: 'Ceramic Coating',
    description: 'Professional-grade ceramic coating. Protects your paint for 2+ years.',
    price: 15000,
    currency: 'LKR',
    duration: 360,
    isActive: true,
    rating: 4.9,
    reviewCount: 42,
    images: [],
  },
  {
    id: 'svc_009',
    providerId: 'provider_003',
    categoryId: 'premium-wash',
    name: 'Luxury Hand Wash & Wax',
    description: 'Hand wash with premium carnauba wax finish. Includes wheel detailing.',
    price: 3500,
    currency: 'LKR',
    duration: 120,
    isActive: true,
    rating: 4.8,
    reviewCount: 55,
    images: [],
  },
  // Chaminda Rathnayake
  {
    id: 'svc_010',
    providerId: 'provider_004',
    categoryId: 'basic-wash',
    name: 'Mobile Exterior Wash',
    description: 'Quick exterior wash at your location. I bring everything needed.',
    price: 1000,
    currency: 'LKR',
    duration: 30,
    isActive: true,
    rating: 4.2,
    reviewCount: 28,
    images: [],
  },
  {
    id: 'svc_011',
    providerId: 'provider_004',
    categoryId: 'premium-wash',
    name: 'Mobile Full Wash',
    description: 'Full interior and exterior wash done at your doorstep.',
    price: 2800,
    currency: 'LKR',
    duration: 90,
    isActive: true,
    rating: 4.3,
    reviewCount: 15,
    images: [],
  },
  {
    id: 'svc_012',
    providerId: 'provider_004',
    categoryId: 'interior-clean',
    name: 'Mobile Interior Clean',
    description: 'Interior deep clean at your location. Vacuum, wipe down, and sanitize.',
    price: 1500,
    currency: 'LKR',
    duration: 50,
    isActive: true,
    rating: 4.4,
    reviewCount: 12,
    images: [],
  },
  // Dilantha Mendis
  {
    id: 'svc_013',
    providerId: 'provider_005',
    categoryId: 'basic-wash',
    name: 'Waterless Exterior Wash',
    description: 'Advanced waterless wash. Cleans and protects in one step. Zero water used.',
    price: 900,
    currency: 'LKR',
    duration: 40,
    isActive: true,
    rating: 4.4,
    reviewCount: 33,
    images: [],
  },
  {
    id: 'svc_014',
    providerId: 'provider_005',
    categoryId: 'detailing',
    name: 'Eco Full Detailing',
    description: 'Full detailing using only green, non-toxic products.',
    price: 5500,
    currency: 'LKR',
    duration: 180,
    isActive: true,
    rating: 4.6,
    reviewCount: 22,
    images: [],
  },
  {
    id: 'svc_015',
    providerId: 'provider_005',
    categoryId: 'tire-cleaning',
    name: 'Eco Tire & Wheel Clean',
    description: 'Tire and wheel cleaning using non-toxic, eco-friendly products.',
    price: 500,
    currency: 'LKR',
    duration: 20,
    isActive: true,
    rating: 4.3,
    reviewCount: 10,
    images: [],
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================
async function seedDatabase() {
  try {
    console.log('\n🌱 Starting database seed...\n');

    // Seed Categories
    console.log('📁 Seeding categories...');
    for (const category of categories) {
      await db.collection('categories').doc(category.id).set(category);
      console.log(`   ✅ ${category.name}`);
    }

    // Seed Providers
    console.log('\n🚗 Seeding providers...');
    for (const provider of providers) {
      await db.collection('providers').doc(provider.uid).set({
        ...provider,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${provider.displayName} (${provider.area})`);
    }

    // Seed Services
    console.log('\n🛁 Seeding services...');
    for (const service of services) {
      await db.collection('services').doc(service.id).set({
        ...service,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ ${service.name} - LKR ${service.price}`);
    }

    console.log('\n✅ Database seeded successfully!');
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Providers:  ${providers.length}`);
    console.log(`   Services:   ${services.length}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedDatabase();