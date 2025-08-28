const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing. Please check your environment variables.');
  console.log('Required environment variables:');
  console.log('- NEXT_PUBLIC_FIREBASE_API_KEY');
  console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  console.log('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  console.log('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  console.log('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  console.log('- NEXT_PUBLIC_FIREBASE_APP_ID');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearEnquiries() {
  try {
    console.log('🔄 Starting to clear all enquiries...');
    
    // Get all enquiries
    const enquiriesSnapshot = await getDocs(collection(db, 'enquiries'));
    
    if (enquiriesSnapshot.empty) {
      console.log('✅ No enquiries found in the database.');
      return;
    }
    
    console.log(`📊 Found ${enquiriesSnapshot.size} enquiries to delete.`);
    console.log('⚠️  This action cannot be undone!');
    
    // Confirmation prompt
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const confirmed = await new Promise((resolve) => {
      rl.question('Are you sure you want to delete ALL enquiries? (yes/no): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (!confirmed) {
      console.log('❌ Operation cancelled.');
      return;
    }
    
    console.log('🗑️  Deleting enquiries...');
    
    // Delete each enquiry
    const deletePromises = [];
    enquiriesSnapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, 'enquiries', docSnapshot.id)));
    });
    
    // Wait for all deletions to complete
    await Promise.all(deletePromises);
    
    console.log(`✅ Successfully deleted ${enquiriesSnapshot.size} enquiries.`);
    console.log('🎉 Database cleared! You can now start fresh.');
    
  } catch (error) {
    console.error('❌ Error clearing enquiries:', error);
  }
}

// Run the script
clearEnquiries().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 