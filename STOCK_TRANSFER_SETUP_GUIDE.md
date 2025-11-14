# Stock Transfer Setup Guide
## Intracompany & Intercompany Transfers

## Overview

The stock transfer module now supports two types of transfers:

1. **Intracompany Transfer** - Transfer inventory between centers of the same company
2. **Intercompany Transfer** - Transfer inventory between centers of different companies

---

## Database Setup Required

### Adding Company Information to Centers

To use this feature, you need to add a `company` field to each center in your Firebase `centers` collection.

#### Option 1: Using Firebase Console

1. Go to Firebase Console → Firestore Database
2. Navigate to the `centers` collection
3. For each center document, add/edit:
   - Field: `company`
   - Type: `string`
   - Value: Company name (e.g., "Hope Enterprises", "Hope Medical", "Hearing Solutions Ltd")

**Example Center Document:**
```json
{
  "name": "Rohini Center",
  "company": "Hope Enterprises",
  "address": "G-14, Ground Floor, King Mall, Sector-10, Rohini, Delhi",
  "branchId": "rohini-001",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Option 2: Using Firebase Script

Create a script to bulk update all centers:

```javascript
// scripts/add-company-to-centers.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addCompanyToCenters() {
  const centersRef = db.collection('centers');
  const snapshot = await centersRef.get();
  
  const batch = db.batch();
  
  snapshot.docs.forEach(doc => {
    // Set default company or map based on center name
    const defaultCompany = 'Hope Enterprises';
    
    // You can customize company assignment based on center names
    let company = defaultCompany;
    const centerName = doc.data().name || '';
    
    if (centerName.includes('Medical')) {
      company = 'Hope Medical';
    } else if (centerName.includes('Clinic')) {
      company = 'Hope Clinic';
    }
    
    batch.update(doc.ref, { company: company });
  });
  
  await batch.commit();
  console.log('✅ Successfully added company field to all centers');
}

addCompanyToCenters().catch(console.error);
```

---

## Creating Companies Collection (Optional)

If you want to manage companies separately, create a `companies` collection:

### Firebase Console Method:

1. Create a new collection: `companies`
2. Add documents for each company:

**Document ID:** `hope-enterprises`
```json
{
  "name": "Hope Enterprises",
  "type": "Hearing Aid Retail",
  "gstNumber": "07AFNPM1470L1Z3",
  "address": "G-14, Ground Floor, King Mall, Sector-10, Rohini, Delhi - 110085",
  "phone": "9711871169",
  "email": "hearinghope@gmail.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Document ID:** `hope-medical`
```json
{
  "name": "Hope Medical",
  "type": "Medical Equipment",
  "gstNumber": "07XXXXX1234X1X1",
  "address": "Medical Plaza, Delhi",
  "phone": "9876543210",
  "email": "medical@hopehearing.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## How to Use Stock Transfer

### Intracompany Transfer (Same Company, Different Centers)

1. Click **"New Transfer"** button
2. Select **"Intracompany Transfer"**
3. Choose the **Company** (e.g., "Hope Enterprises")
4. Select **From Center** (e.g., "Rohini Center")
5. Select **To Center** (e.g., "Noida Center")
   - Only centers belonging to the selected company will be shown
6. Add products available at the From Center
7. Save the transfer

**Use Case:** Moving stock from your main warehouse to a branch location within the same company.

---

### Intercompany Transfer (Different Companies)

1. Click **"New Transfer"** button
2. Select **"Intercompany Transfer"**
3. Choose **From Company** (e.g., "Hope Enterprises")
4. Choose **From Center** (e.g., "Rohini Center")
   - Only centers of "Hope Enterprises" will be shown
5. Choose **To Company** (e.g., "Hope Medical")
6. Choose **To Center** (e.g., "Medical Plaza")
   - Only centers of "Hope Medical" will be shown
7. Add products available at the From Center
8. Save the transfer

**Use Case:** Transferring inventory between sister companies or business units.

---

## Key Features

### Intelligent Filtering

✅ **Company-Based Center Filtering**
- Centers are automatically filtered based on selected company
- You cannot accidentally transfer between wrong companies

✅ **Inventory Filtering**
- Only shows inventory available at the selected source center
- Prevents transfer of items that don't exist

✅ **Serial Number Tracking**
- Tracks each item by serial number
- Ensures accurate inventory movement

### Visual Indicators

- **Intra** badge (Blue) - Intracompany transfers
- **Inter** badge (Purple) - Intercompany transfers
- Company names shown under center names in the table

### Automatic Inventory Updates

When a transfer is saved:
1. Creates a "Material Out" entry at the source center
2. Creates a "Material In" entry at the destination center
3. Maintains pricing and product information
4. Updates inventory automatically

---

## Example Scenarios

### Scenario 1: Branch Stocking
**Type:** Intracompany  
**Company:** Hope Enterprises  
**From:** Rohini Center (Main Warehouse)  
**To:** Noida Branch  
**Items:** 10 hearing aids  
**Reason:** Branch Opening Stock

### Scenario 2: Inter-Division Transfer
**Type:** Intercompany  
**From Company:** Hope Enterprises  
**From Center:** Rohini Center  
**To Company:** Hope Medical  
**To Center:** Medical Plaza  
**Items:** 5 medical devices  
**Reason:** Business Unit Requirement

### Scenario 3: Stock Balancing
**Type:** Intracompany  
**Company:** Hope Enterprises  
**From:** Rohini Center (Overstocked)  
**To:** Dwarka Center (Low Stock)  
**Items:** 3 specific hearing aid models  
**Reason:** Stock Balancing

---

## Troubleshooting

### Centers Not Showing Up

**Problem:** No centers appear in the dropdown

**Solution:**
1. Verify all centers have a `company` field in Firestore
2. Check that the company name is spelled consistently
3. Refresh the page to reload data

### Wrong Inventory Shown

**Problem:** Products from wrong location are displayed

**Solution:**
1. Ensure you selected the correct "From Center"
2. The system only shows inventory at the selected source center
3. Check that inventory was properly recorded at that location

### Cannot Save Transfer

**Problem:** Save button disabled or error occurs

**Solution:**
- Ensure you selected:
  - ✅ Transfer type (intracompany/intercompany)
  - ✅ Company/Companies
  - ✅ From and To centers
  - ✅ At least one product
  - ✅ Transfer reason
- Verify from and to centers are different

---

## Data Structure Reference

### Updated StockTransfer Schema

```typescript
interface StockTransfer {
  transferNumber: string;
  transferType: 'intracompany' | 'intercompany';
  
  // For intracompany transfers
  company?: string;
  
  // For intercompany transfers
  fromCompany?: string;
  toCompany?: string;
  
  // Common fields
  fromBranch: string; // Center ID
  toBranch: string; // Center ID
  products: StockTransferProduct[];
  reason: string;
  notes?: string;
  transferDate: Timestamp;
}
```

### Center Schema (Required)

```typescript
interface Center {
  name: string;
  company: string; // ← REQUIRED for intra/intercompany transfers
  address?: string;
  branchId?: string;
  phone?: string;
  // ... other fields
}
```

---

## Benefits

### For Single Company Operations
- Track internal movements between branches
- Maintain accurate inventory levels
- Generate transfer reports

### For Multi-Company Operations
- Separate inventory by business unit
- Track inter-company transactions
- Maintain proper accounting
- Support franchise or sister company operations

---

## Next Steps

1. ✅ Add `company` field to all existing centers
2. ✅ (Optional) Create companies collection
3. ✅ Create your first intracompany transfer
4. ✅ Test intercompany transfer if applicable
5. ✅ Review transfer history in the table

---

## Support

For questions or issues:
- Email: hearinghope@gmail.com
- Phone: 9711871169

---

Last Updated: October 22, 2025
Version: 2.0 (Intracompany/Intercompany Support)

