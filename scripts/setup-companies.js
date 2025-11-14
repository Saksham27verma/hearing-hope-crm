/**
 * Script to set up companies in Firebase
 * This creates a 'companies' collection with Hope Enterprises and HDIPL
 * 
 * Run: node scripts/setup-companies.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin (you may need to adjust the path to your service account key)
try {
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('Error: Could not find serviceAccountKey.json');
  console.error('Please download your Firebase service account key and place it in the project root');
  process.exit(1);
}

const db = admin.firestore();

const companies = [
  {
    id: 'hope-enterprises',
    data: {
      name: 'Hope Enterprises',
      type: 'Hearing Aid Retail & Services',
      gstNumber: '07AFNPM1470L1Z3',
      address: 'G-14, Ground Floor, King Mall, Twin District Center, Opp. Baba Saheb Ambedkar Hospital Rohini, Rohini West Metro Station, Sector-10, Rohini, Delhi - 110085',
      phone: '9711871169',
      email: 'hearinghope@gmail.com',
      website: 'hearinghope.in',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  },
  {
    id: 'hdipl',
    data: {
      name: 'HDIPL',
      type: 'Hearing Devices India Private Limited',
      gstNumber: '', // Add your GST number
      address: '', // Add your address
      phone: '',
      email: '',
      website: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  }
];

async function setupCompanies() {
  console.log('🚀 Setting up companies in Firebase...\n');

  try {
    // Create companies collection
    for (const company of companies) {
      console.log(`📝 Creating company: ${company.data.name}...`);
      await db.collection('companies').doc(company.id).set(company.data, { merge: true });
      console.log(`✅ ${company.data.name} created successfully\n`);
    }

    console.log('✅ All companies set up successfully!\n');
    
    // Now update centers to assign them to companies
    console.log('📍 Checking centers to assign companies...\n');
    
    const centersSnapshot = await db.collection('centers').get();
    const batch = db.batch();
    let updateCount = 0;

    centersSnapshot.docs.forEach(doc => {
      const centerData = doc.data();
      const centerName = centerData.name || '';
      
      // If center already has a company, skip it
      if (centerData.company) {
        console.log(`  ℹ️ ${centerName} already has company: ${centerData.company}`);
        return;
      }

      // Assign default company (you can customize this logic)
      // For now, assign all centers to Hope Enterprises
      // You can modify this to assign specific centers to HDIPL
      let assignedCompany = 'Hope Enterprises';
      
      // Example: If center name contains "HDIPL" or specific keywords, assign to HDIPL
      if (centerName.toLowerCase().includes('hdipl') || 
          centerName.toLowerCase().includes('devices')) {
        assignedCompany = 'HDIPL';
      }

      batch.update(doc.ref, { company: assignedCompany });
      updateCount++;
      console.log(`  ✓ Assigning ${centerName} → ${assignedCompany}`);
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`\n✅ Updated ${updateCount} centers with company assignments\n`);
    } else {
      console.log('\nℹ️ All centers already have company assignments\n');
    }

    console.log('🎉 Setup complete!\n');
    console.log('You can now:');
    console.log('1. Refresh your Stock Transfer page');
    console.log('2. Both "Hope Enterprises" and "HDIPL" should appear in the company dropdown\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up companies:', error);
    process.exit(1);
  }
}

setupCompanies();

