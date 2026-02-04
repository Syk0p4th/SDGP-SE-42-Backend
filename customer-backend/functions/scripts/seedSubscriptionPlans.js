const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const subscriptionPlans = [
  {
    id: 'basic-monthly',
    name: 'Basic Monthly',
    description: 'Perfect for occasional cleaning',
    price: 2500,
    currency: 'LKR',
    duration: 'monthly',
    washesPerMonth: 4,
    features: [
      '4 basic washes per month',
      'Priority booking',
      'Cancel anytime',
    ],
    isActive: true,
  },
  {
    id: 'premium-monthly',
    name: 'Premium Monthly',
    description: 'For regular car care enthusiasts',
    price: 8000,
    currency: 'LKR',
    duration: 'monthly',
    washesPerMonth: 'unlimited',
    features: [
      'Unlimited basic washes',
      'Priority booking',
      '20% off premium services',
      'Free interior clean monthly',
      'Cancel anytime',
    ],
    isActive: true,
  },
  {
    id: 'premium-yearly',
    name: 'Premium Yearly',
    description: 'Best value for committed customers',
    price: 80000,
    currency: 'LKR',
    duration: 'yearly',
    washesPerMonth: 'unlimited',
    features: [
      'Unlimited basic washes',
      'Priority booking',
      '30% off premium services',
      'Free detailing twice a year',
      'Free interior clean monthly',
      '2 months free (compared to monthly)',
    ],
    isActive: true,
  },
  {
    id: 'fleet-monthly',
    name: 'Fleet Monthly (Per Vehicle)',
    description: 'For businesses with multiple vehicles',
    price: 6000,
    currency: 'LKR',
    duration: 'monthly',
    washesPerMonth: 'unlimited',
    features: [
      'Unlimited basic washes per vehicle',
      'Priority booking',
      '25% off premium services',
      'Dedicated account manager (5+ vehicles)',
      'Flexible scheduling',
    ],
    isActive: true,
  },
];

async function seedPlans() {
  try {
    console.log('\n💳 Seeding subscription plans...\n');

    for (const plan of subscriptionPlans) {
      await db.collection('subscription_plans').doc(plan.id).set(plan);
      console.log(`   ✅ ${plan.name} - LKR ${plan.price}/${plan.duration}`);
    }

    console.log(`\n✅ ${subscriptionPlans.length} subscription plans seeded successfully!\n`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedPlans();