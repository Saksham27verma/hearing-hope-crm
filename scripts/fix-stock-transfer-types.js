#!/usr/bin/env node

/**
 * Migration Script: Fix Stock Transfer Product Types
 * 
 * This script fixes existing materialInward entries that have products with type 'Stock Transfer'
 * by replacing them with the correct product types from the products collection.
 * 
 * Usage: node scripts/fix-stock-transfer-types.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc,
  serverTimestamp 
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

async function fixStockTransferTypes() {
  console.log('🔧 Starting to fix stock transfer product types...');
  
  try {
    // First, get all products to create a lookup map
    console.log('📦 Fetching products collection...');
    const productsSnap = await getDocs(collection(db, 'products'));
    const productTypeMap = new Map();
    const productNameMap = new Map(); // For name-based lookup
    
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      const productType = data.type || 'Hearing Aid'; // Default to Hearing Aid for hearing aid products
      productTypeMap.set(doc.id, productType);
      productNameMap.set(data.name?.toLowerCase(), productType);
      console.log(`  Product: ${data.name} (${doc.id}) → Type: ${productType}`);
    });
    
    console.log(`✅ Found ${productTypeMap.size} products`);
    
    // Get all materialInward documents
    console.log('📥 Fetching materialInward collection...');
    const materialInSnap = await getDocs(collection(db, 'materialInward'));
    
    let processedCount = 0;
    let updatedCount = 0;
    
    for (const docSnap of materialInSnap.docs) {
      const data = docSnap.data();
      const supplierName = data.supplier?.name || '';
      
      // Check if this is a stock transfer entry
      if (supplierName.includes('Stock Transfer from')) {
        console.log(`🔄 Processing stock transfer: ${docSnap.id}`);
        
        let hasUpdates = false;
        const updatedProducts = (data.products || []).map(product => {
          if (product.type === 'Stock Transfer' || product.type === 'Unknown') {
            const productId = product.productId || product.id;
            let correctType = productTypeMap.get(productId);
            
            // If not found by ID, try name-based lookup
            if (!correctType && product.name) {
              correctType = productNameMap.get(product.name.toLowerCase());
            }
            
            // Default to 'Hearing Aid' for hearing aid products if still not found
            if (!correctType || correctType === 'Unknown') {
              const productName = product.name?.toLowerCase() || '';
              if (productName.includes('hearing aid') || 
                  productName.includes('cic') || 
                  productName.includes('bte') || 
                  productName.includes('ite') ||
                  productName.includes('phonak') ||
                  productName.includes('siemens') ||
                  productName.includes('resound') ||
                  productName.includes('insio') ||
                  productName.includes('pure') ||
                  productName.includes('motion') ||
                  productName.includes('orion') ||
                  productName.includes('naida') ||
                  productName.includes('audeo') ||
                  productName.includes('silk') ||
                  productName.includes('styletto') ||
                  productName.includes('intuis') ||
                  productName.includes('prompt') ||
                  productName.includes('key') ||
                  productName.includes('nexia') ||
                  productName.includes('enjoy') ||
                  productName.includes('terra') ||
                  productName.includes('vesuvio') ||
                  productName.includes('run') ||
                  productName.includes('fast') ||
                  productName.includes('fun')) {
                correctType = 'Hearing Aid';
              } else if (productName.includes('battery') || 
                        productName.includes('675') || 
                        productName.includes('312') || 
                        productName.includes('13') || 
                        productName.includes('10')) {
                correctType = 'Battery';
              } else if (productName.includes('charger') || 
                        productName.includes('charging')) {
                correctType = 'Charger';
              } else if (productName.includes('receiver') || 
                        productName.includes('mould') || 
                        productName.includes('kit')) {
                correctType = 'Accessory';
              } else {
                correctType = 'Hearing Aid'; // Default for most items
              }
            }
            
            if (correctType !== 'Stock Transfer' && correctType !== product.type) {
              console.log(`  ➤ Fixing product ${product.name}: '${product.type}' → '${correctType}'`);
              hasUpdates = true;
              return {
                ...product,
                type: correctType
              };
            }
          }
          return product;
        });
        
        if (hasUpdates) {
          // Update the document
          await updateDoc(doc(db, 'materialInward', docSnap.id), {
            products: updatedProducts,
            updatedAt: serverTimestamp()
          });
          
          updatedCount++;
          console.log(`  ✅ Updated document ${docSnap.id}`);
        } else {
          console.log(`  ⏭️  No updates needed for ${docSnap.id}`);
        }
        
        processedCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Stock transfer documents processed: ${processedCount}`);
    console.log(`   Documents updated: ${updatedCount}`);
    console.log(`   Documents skipped (no changes needed): ${processedCount - updatedCount}`);
    
    if (updatedCount > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('🔄 Please refresh your inventory page to see the changes.');
    } else {
      console.log('\n✅ Migration completed - no updates were needed.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Confirmation prompt
function askForConfirmation() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('⚠️  This script will update existing materialInward documents.');
    console.log('   It will change product types from "Stock Transfer" to their correct types.');
    console.log('   This action cannot be easily undone.');
    console.log('');
    
    rl.question('Do you want to proceed? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main execution
async function main() {
  // Check if environment variables are set
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error('❌ Firebase environment variables not found.');
    console.error('   Make sure you have a .env.local file with your Firebase configuration.');
    process.exit(1);
  }
  
  const confirmed = await askForConfirmation();
  
  if (!confirmed) {
    console.log('❌ Migration cancelled by user.');
    process.exit(0);
  }
  
  await fixStockTransferTypes();
  process.exit(0);
}

main().catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});
