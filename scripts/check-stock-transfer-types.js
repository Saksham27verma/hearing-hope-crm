#!/usr/bin/env node

/**
 * Debug Script: Check Stock Transfer Product Types
 * 
 * This script checks what product types are currently in the materialInward collection
 * to help debug why "Stock Transfer" is still showing in inventory.
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs
} = require('firebase/firestore');

// Firebase configuration - using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStockTransferTypes() {
  console.log('🔍 Checking current product types in materialInward collection...');
  
  try {
    // Get all materialInward documents
    const materialInSnap = await getDocs(collection(db, 'materialInward'));
    
    const typeCount = new Map();
    let stockTransferCount = 0;
    let stockTransferDocs = [];
    
    materialInSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const supplierName = data.supplier?.name || '';
      
      (data.products || []).forEach(product => {
        const type = product.type || 'Unknown';
        typeCount.set(type, (typeCount.get(type) || 0) + 1);
        
        if (type === 'Stock Transfer') {
          stockTransferCount++;
          stockTransferDocs.push({
            docId: docSnap.id,
            supplier: supplierName,
            productName: product.name,
            productId: product.productId || product.id
          });
        }
      });
    });
    
    console.log('\n📊 Product Type Summary:');
    Array.from(typeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count} items`);
      });
    
    if (stockTransferCount > 0) {
      console.log(`\n⚠️  Found ${stockTransferCount} items with type "Stock Transfer":`);
      stockTransferDocs.forEach(item => {
        console.log(`   - ${item.productName} (${item.productId}) in doc ${item.docId}`);
        console.log(`     Supplier: ${item.supplier}`);
      });
    } else {
      console.log('\n✅ No items with type "Stock Transfer" found!');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  // Check if environment variables are set
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error('❌ Firebase environment variables not found.');
    console.error('   Make sure you have a .env.local file with your Firebase configuration.');
    process.exit(1);
  }
  
  await checkStockTransferTypes();
  process.exit(0);
}

main().catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});
