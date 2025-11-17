/**
 * Firebase Seed Script
 * 
 * This script populates your Firebase database with initial sample data.
 * Make sure to set up your Firebase project and update .env before running.
 * 
 * Usage: node seed-database.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  writeBatch,
  doc,
  setDoc
} = require('firebase/firestore');
const { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} = require('firebase/auth');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sample data
const products = [
  {
    name: 'Hearing Aid Pro X3',
    type: 'Hearing Aid',
    company: 'Siemens',
    mrp: 45000,
    dealerPrice: 29000,
    description: 'Premium digital hearing aid with noise cancellation',
    createdAt: serverTimestamp()
  },
  {
    name: 'Phonak Audéo Paradise',
    type: 'Hearing Aid',
    company: 'Phonak',
    mrp: 62000,
    dealerPrice: 40000,
    description: 'Premium hearing aid with Bluetooth connectivity',
    createdAt: serverTimestamp()
  },
  {
    name: 'Hearing Aid Battery Size 312',
    type: 'Battery',
    company: 'Rayovac',
    mrp: 120,
    dealerPrice: 60,
    description: 'Pack of 6 high-performance zinc-air batteries',
    createdAt: serverTimestamp()
  },
  {
    name: 'Hearing Aid Cleaner Kit',
    type: 'Accessory',
    company: 'Hearing Essentials',
    mrp: 850,
    dealerPrice: 400,
    description: 'Complete cleaning kit for hearing aids',
    createdAt: serverTimestamp()
  },
  {
    name: 'Sound Amplifier Mini',
    type: 'Hearing Aid',
    company: 'ReSound',
    mrp: 15000,
    dealerPrice: 7500,
    description: 'Discreet in-ear sound amplifier for mild hearing loss',
    createdAt: serverTimestamp()
  }
];

const customers = [
  {
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul.sharma@example.com',
    address: '123 Main Street, New Delhi',
    dateOfBirth: new Date('1975-05-15'),
    notes: 'First-time customer with mild hearing loss',
    createdAt: serverTimestamp()
  },
  {
    name: 'Priya Patel',
    phone: '8765432109',
    email: 'priya.patel@example.com',
    address: '456 Park Avenue, Mumbai',
    dateOfBirth: new Date('1982-11-23'),
    notes: 'Returning customer, prefers Phonak brand',
    createdAt: serverTimestamp()
  },
  {
    name: 'Amit Singh',
    phone: '7654321098',
    email: 'amit.singh@example.com',
    address: '789 Lake Road, Bangalore',
    dateOfBirth: new Date('1968-03-07'),
    notes: 'Has severe hearing loss in right ear',
    createdAt: serverTimestamp()
  }
];

const vendors = [
  {
    name: 'Siemens Hearing Solutions',
    contactPerson: 'Vikram Mehta',
    phone: '9988776655',
    email: 'vikram.mehta@siemens.com',
    address: '1 Corporate Park, Gurgaon',
    gstNumber: '29ABCDE1234F1Z5',
    notes: 'Primary supplier for Siemens hearing aids',
    createdAt: serverTimestamp()
  },
  {
    name: 'Phonak India Pvt Ltd',
    contactPerson: 'Anjali Desai',
    phone: '8877665544',
    email: 'anjali.desai@phonak.in',
    address: '234 Business Center, Mumbai',
    gstNumber: '27FGHIJ5678K2Z7',
    notes: 'Exclusive distributor for Phonak',
    createdAt: serverTimestamp()
  },
  {
    name: 'Hearing Accessories Wholesale',
    contactPerson: 'Rajesh Kumar',
    phone: '7766554433',
    email: 'rajesh@hearingacc.com',
    address: '567 Trading Complex, Delhi',
    gstNumber: '07KLMNO9012P3Z9',
    notes: 'Supplies batteries and accessories',
    createdAt: serverTimestamp()
  }
];

// Create some sample manufacturer incentives
const manufacturerIncentives = [
  {
    company: 'Hope Enterprises',
    manufacturer: 'Siemens',
    month: new Date().toISOString().substring(0, 7), // Current month in YYYY-MM format
    amount: 25000,
    description: 'Monthly incentive for exceeding sales target',
    createdAt: serverTimestamp()
  },
  {
    company: 'Hope Digital Innovations',
    manufacturer: 'Phonak',
    month: new Date().toISOString().substring(0, 7), // Current month in YYYY-MM format
    amount: 15000,
    description: 'Quarterly marketing bonus',
    createdAt: serverTimestamp()
  }
];

// Create some sample employee expenses
const employeeExpenses = [
  {
    employeeId: 'emp123',
    employeeName: 'Suresh Kumar',
    expenseType: 'salary',
    month: new Date().toISOString().substring(0, 7), // Current month in YYYY-MM format
    amount: 38000,
    description: 'Monthly salary',
    createdAt: serverTimestamp()
  },
  {
    employeeId: 'emp456',
    employeeName: 'Neha Gupta',
    expenseType: 'commission',
    month: new Date().toISOString().substring(0, 7), // Current month in YYYY-MM format
    amount: 12500,
    description: 'Sales commission',
    createdAt: serverTimestamp()
  }
];

// Authentication users to create
const authUsers = [
  {
    email: 'admin@hopehearing.com',
    password: 'admin123',
    role: 'admin',
    displayName: 'Admin User',
    allowedModules: ['users', 'inventory', 'customers', 'sales', 'purchases', 'reports', 'settings', 'interaction'],
  },
  {
    email: 'staff@hopehearing.com',
    password: 'staff123',
    role: 'staff',
    displayName: 'Staff User',
    allowedModules: ['inventory', 'customers', 'sales', 'interaction'],
  },
  {
    email: 'audiologist@hopehearing.com',
    password: 'audiologist123',
    role: 'audiologist',
    displayName: 'Audiologist User',
    allowedModules: ['inventory', 'appointments', 'interaction'],
  }
];

// Function to add documents with batch writes
async function seedCollection(collectionName, data) {
  try {
    const batch = writeBatch(db);
    
    data.forEach((item) => {
      const docRef = doc(collection(db, collectionName));
      batch.set(docRef, item);
    });
    
    await batch.commit();
    console.log(`✅ Successfully added ${data.length} documents to ${collectionName} collection`);
  } catch (error) {
    console.error(`❌ Error seeding ${collectionName} collection:`, error);
  }
}

// Function to create auth user and corresponding Firestore profile
async function createAuthUser(userData) {
  try {
    // Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const uid = userCredential.user.uid;
    
    // Create user profile in Firestore with the auth UID
    const userProfile = {
      uid: uid,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role,
      allowedModules: userData.allowedModules,
      createdAt: Date.now(),
    };
    
    // Set the document with the UID as the document ID
    await setDoc(doc(db, 'users', uid), userProfile);
    
    console.log(`✅ Created auth user and profile for ${userData.email}`);
    return uid;
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`⚠️ Auth user ${userData.email} already exists`);
      
      try {
        // If the user already exists, try to sign in to get the UID
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, userData.password);
        
        // Update the existing user profile in Firestore
        const userProfile = {
          uid: userCredential.user.uid,
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
          allowedModules: userData.allowedModules,
          updatedAt: Date.now(),
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), userProfile, { merge: true });
        console.log(`✅ Updated existing user profile for ${userData.email}`);
        return userCredential.user.uid;
      } catch (signInError) {
        console.error(`❌ Error signing in as existing user ${userData.email}:`, signInError);
        return null;
      }
    } else {
      console.error(`❌ Error creating auth user ${userData.email}:`, error);
      return null;
    }
  }
}

// Main function to seed all collections
async function seedDatabase() {
  console.log('🌱 Starting to seed database...');
  
  try {
    // First create the auth users since we need their UIDs for Firestore
    console.log('Creating authentication users...');
    const createdUIDs = [];
    for (const userData of authUsers) {
      const uid = await createAuthUser(userData);
      if (uid) createdUIDs.push(uid);
    }
    
    await seedCollection('products', products);
    await seedCollection('customers', customers);
    await seedCollection('vendors', vendors);
    await seedCollection('manufacturerIncentives', manufacturerIncentives);
    await seedCollection('employeeExpenses', employeeExpenses);
    
    // Don't seed users collection again since we created it with auth UIDs
    
    console.log('✅ Database seeding completed successfully!');
    
    // Sign out after seeding
    await auth.signOut();
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
  }
}

// Run the seed function
seedDatabase().then(() => {
  console.log('Script execution finished.');
  process.exit(0);
}).catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
}); 