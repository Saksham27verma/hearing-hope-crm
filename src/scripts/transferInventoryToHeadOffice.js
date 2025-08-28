// Script to transfer all existing inventory to the head office
// This script updates all materialInward, purchases, and materialsOut records
// to ensure they are assigned to the designated head office

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query 
} from 'firebase/firestore';

// Firebase configuration (you may need to update this with your actual config)
const firebaseConfig = {
  // Add your Firebase config here
  // This should match your existing config in src/firebase/config.ts
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getHeadOfficeId() {
  try {
    console.log('🔍 Finding head office...');
    const centersQuery = collection(db, 'centers');
    const querySnapshot = await getDocs(centersQuery);
    
    const centers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Find the center marked as head office
    const headOffice = centers.find(center => center.isHeadOffice);
    
    if (headOffice) {
      console.log(`✅ Found head office: ${headOffice.name} (ID: ${headOffice.id})`);
      return headOffice.id;
    } else {
      console.log('⚠️  No head office found, using "rohini" as fallback');
      return 'rohini';
    }
  } catch (error) {
    console.error('❌ Error fetching head office:', error);
    return 'rohini'; // Fallback
  }
}

async function updateCollection(collectionName, headOfficeId) {
  try {
    console.log(`\n📦 Processing ${collectionName} collection...`);
    
    const collectionRef = collection(db, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    const updatePromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      
      // Check if document already has the correct location
      if (data.location === headOfficeId) {
        skippedCount++;
        return;
      }
      
      // Update the document with head office location
      try {
        await updateDoc(doc(db, collectionName, docSnap.id), {
          location: headOfficeId,
          updatedAt: new Date()
        });
        updatedCount++;
        console.log(`  ✅ Updated ${collectionName}/${docSnap.id}`);
      } catch (error) {
        console.error(`  ❌ Failed to update ${collectionName}/${docSnap.id}:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    
    console.log(`📊 ${collectionName} Summary:`);
    console.log(`   - Updated: ${updatedCount} documents`);
    console.log(`   - Skipped: ${skippedCount} documents (already correct)`);
    console.log(`   - Total: ${querySnapshot.docs.length} documents`);
    
    return { updated: updatedCount, skipped: skippedCount, total: querySnapshot.docs.length };
  } catch (error) {
    console.error(`❌ Error updating ${collectionName}:`, error);
    return { updated: 0, skipped: 0, total: 0 };
  }
}

async function transferAllInventoryToHeadOffice() {
  console.log('🚀 Starting inventory transfer to head office...\n');
  
  try {
    // Get the head office ID
    const headOfficeId = await getHeadOfficeId();
    
    if (!headOfficeId) {
      console.log('❌ Could not determine head office. Aborting transfer.');
      return;
    }
    
    // Collections to update
    const collections = ['materialInward', 'purchases', 'materialsOut'];
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;
    
    // Update each collection
    for (const collectionName of collections) {
      const result = await updateCollection(collectionName, headOfficeId);
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalProcessed += result.total;
    }
    
    console.log('\n🎉 Inventory transfer completed!');
    console.log('📊 Overall Summary:');
    console.log(`   - Total documents updated: ${totalUpdated}`);
    console.log(`   - Total documents skipped: ${totalSkipped}`);
    console.log(`   - Total documents processed: ${totalProcessed}`);
    console.log(`   - Head office ID: ${headOfficeId}`);
    
    console.log('\n✨ All existing inventory has been transferred to the head office!');
    console.log('💡 Note: Future inventory entries will automatically use the head office as default.');
    
  } catch (error) {
    console.error('❌ Error during inventory transfer:', error);
  }
}

// Run the transfer
transferAllInventoryToHeadOffice();
