const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

// Simple Firebase configuration
// REPLACE THESE VALUES WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com", 
  projectId: "your-project-id-here",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id-here",
  appId: "your-app-id-here"
};

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
    
    // Delete each enquiry in batches to avoid overwhelming the database
    const batchSize = 10;
    const docs = enquiriesSnapshot.docs;
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const deletePromises = batch.map(docSnapshot => 
        deleteDoc(doc(db, 'enquiries', docSnapshot.id))
      );
      
      await Promise.all(deletePromises);
      console.log(`Deleted ${Math.min(i + batchSize, docs.length)}/${docs.length} enquiries...`);
    }
    
    console.log(`✅ Successfully deleted ${docs.length} enquiries.`);
    console.log('🎉 Database cleared! You can now start fresh.');
    
  } catch (error) {
    console.error('❌ Error clearing enquiries:', error);
    if (error.code === 'permission-denied') {
      console.log('💡 Make sure your Firebase rules allow deletion of documents.');
    }
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