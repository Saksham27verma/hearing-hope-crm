# Hearing Hope CRM & Inventory API Documentation

This document provides comprehensive information about the Firebase API endpoints and data models used in the Hearing Hope CRM & Inventory Management System. It serves as a reference for mobile app development and future integrations.

## Authentication

The system uses Firebase Authentication for user management.

### Auth Endpoints

- **Sign In**: `signInWithEmailAndPassword(auth, email, password)`
- **Sign Out**: `signOut(auth)`
- **Create User**: `createUserWithEmailAndPassword(auth, email, password)`

### User Document Structure

After authentication, each user has a corresponding document in the `users` collection with the following structure:

```typescript
interface UserProfile {
  uid: string;               // Firebase Authentication UID
  email: string;             // User email
  displayName?: string;      // User display name
  role: 'admin' | 'staff';   // User role
  allowedModules?: string[]; // Modules the user has access to
  createdAt: number;         // Timestamp of creation
  branchId?: string;         // Branch/Center the user belongs to
}
```

## Data Models

### Products

**Collection**: `products`

```typescript
interface Product {
  id: string;                // Document ID
  name: string;              // Product name
  type: string;              // Product type (Hearing Aid, Accessory, etc.)
  company: string;           // Manufacturer company
  mrp: number;               // Maximum Retail Price
  category: string;          // Category (Free Accessory, Charged Accessory, etc.)
  barcode?: string;          // Optional barcode
  accessories?: string[];    // Optional linked accessories
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Products**: `getDocs(collection(db, 'products'))`
- **Get Product**: `getDoc(doc(db, 'products', productId))`
- **Add Product**: `addDoc(collection(db, 'products'), productData)`
- **Update Product**: `updateDoc(doc(db, 'products', productId), productData)`
- **Delete Product**: `deleteDoc(doc(db, 'products', productId))`

### Parties (Suppliers)

**Collection**: `parties`

```typescript
interface Party {
  id: string;                // Document ID
  name: string;              // Party/Supplier name
  gstType: string;           // GST Type (LGST, IGST, Exempt)
  gstNumber: string;         // GST Registration Number
  address: string;           // Address
  contactPerson?: string;    // Optional contact person
  phone?: string;            // Optional phone number
  email?: string;            // Optional email address
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Parties**: `getDocs(collection(db, 'parties'))`
- **Get Party**: `getDoc(doc(db, 'parties', partyId))`
- **Add Party**: `addDoc(collection(db, 'parties'), partyData)`
- **Update Party**: `updateDoc(doc(db, 'parties', partyId), partyData)`
- **Delete Party**: `deleteDoc(doc(db, 'parties', partyId))`

### Visitors (CRM)

**Collection**: `visitors`

```typescript
interface Visitor {
  id: string;                          // Document ID
  name: string;                        // Visitor name
  age: number;                         // Age
  gender: string;                      // Gender
  phone: string;                       // Phone number
  alternatePhone?: string;             // Optional alternate phone
  email?: string;                      // Optional email
  address?: string;                    // Optional address
  centerVisited: string;               // Center/Branch visited
  referredBy?: string;                 // Optional referral source
  issueDescription?: string;           // Optional issue description
  followUpDate?: Timestamp;            // Optional follow-up date
  status: 'New' | 'In Progress' | 'Converted' | 'Lost'; // Status
  notes?: string;                      // Optional notes
  createdAt: Timestamp;                // Creation timestamp
  updatedAt: Timestamp;                // Last update timestamp
}
```

**API Operations**:
- **List Visitors**: `getDocs(query(collection(db, 'visitors'), orderBy('createdAt', 'desc')))`
- **Get Visitor**: `getDoc(doc(db, 'visitors', visitorId))`
- **Add Visitor**: `addDoc(collection(db, 'visitors'), visitorData)`
- **Update Visitor**: `updateDoc(doc(db, 'visitors', visitorId), visitorData)`
- **Delete Visitor**: `deleteDoc(doc(db, 'visitors', visitorId))`
- **Filter Visitors**: Various query combinations with `where()` clauses
  - By center: `where('centerVisited', '==', centerName)`
  - By status: `where('status', '==', status)`
  - By date: Date filtering done client-side
  - By search term: Text search done client-side

### Stock (Inventory)

#### Product In (Purchases)

**Collection**: `purchases`

```typescript
interface Purchase {
  id: string;                // Document ID
  invoiceNo: string;         // Invoice number (required)
  party: {                   // Supplier reference
    id: string;              // Party ID
    name: string;            // Party name
  };
  company: string;           // Company (Hope Enterprises or Hope Digital Innovations)
  products: {                // Products purchased
    productId: string;       // Product ID
    name: string;            // Product name
    serialNumbers: string[]; // Serial numbers
    quantity: number;        // Quantity
    dealerPrice: number;     // Dealer price
    mrp: number;             // MRP
  }[];
  gstType: string;           // GST Type
  gstPercentage: number;     // GST Percentage
  totalAmount: number;       // Total amount
  reference?: string;        // Optional reference
  invoiceFile?: string;      // Optional invoice file URL
  purchaseDate: Timestamp;   // Purchase date
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Purchases**: `getDocs(collection(db, 'purchases'))`
- **Get Purchase**: `getDoc(doc(db, 'purchases', purchaseId))`
- **Add Purchase**: `addDoc(collection(db, 'purchases'), purchaseData)`
- **Update Purchase**: `updateDoc(doc(db, 'purchases', purchaseId), purchaseData)`
- **Delete Purchase**: `deleteDoc(doc(db, 'purchases', purchaseId))`

#### Product Out (Sales)

**Collection**: `sales`

```typescript
interface Sale {
  id: string;                // Document ID
  patientId?: string;        // Optional visitor/patient reference
  patientName: string;       // Patient name
  products: {                // Products sold
    productId: string;       // Product ID
    name: string;            // Product name
    serialNumber: string;    // Serial number
    dealerPrice: number;     // Dealer price
    sellingPrice: number;    // Selling price
    discount: number;        // Discount amount
    discountPercent: number; // Discount percentage
  }[];
  accessories: {             // Accessories included
    productId: string;       // Accessory Product ID
    name: string;            // Accessory name
    quantity: number;        // Quantity
    isFree: boolean;         // Whether it's free or charged
    price: number;           // Price (if charged)
  }[];
  referenceDoctor?: {        // Optional referring doctor
    id?: string;             // Doctor ID (if in system)
    name: string;            // Doctor name
  };
  salesperson: {             // Salesperson who made the sale
    id: string;              // User ID
    name: string;            // User name
  };
  totalAmount: number;       // Total amount
  gstAmount: number;         // GST amount
  gstPercentage: number;     // GST percentage
  netProfit: number;         // Net profit
  branch: string;            // Branch/Center where sale was made
  saleDate: Timestamp;       // Sale date
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Sales**: `getDocs(collection(db, 'sales'))`
- **Get Sale**: `getDoc(doc(db, 'sales', saleId))`
- **Add Sale**: `addDoc(collection(db, 'sales'), saleData)`
- **Update Sale**: `updateDoc(doc(db, 'sales', saleId), saleData)`
- **Delete Sale**: `deleteDoc(doc(db, 'sales', saleId))`

#### Delivery Challan (In/Out)

**Collection**: `challans`

```typescript
interface Challan {
  id: string;                // Document ID
  challanType: 'in' | 'out'; // Challan type (in or out)
  challanNo: string;         // Challan number
  partyId?: string;          // Optional party ID (for challan in)
  partyName?: string;        // Optional party name (for challan in)
  recipientName?: string;    // Optional recipient (for challan out)
  products: {                // Products in challan
    productId: string;       // Product ID
    name: string;            // Product name
    serialNumbers: string[]; // Serial numbers
    quantity: number;        // Quantity
  }[];
  reference?: string;        // Optional reference
  challanFile?: string;      // Optional challan file URL
  challanDate: Timestamp;    // Challan date
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Challans**: `getDocs(collection(db, 'challans'))`
- **Get Challan**: `getDoc(doc(db, 'challans', challanId))`
- **Add Challan**: `addDoc(collection(db, 'challans'), challanData)`
- **Update Challan**: `updateDoc(doc(db, 'challans', challanId), challanData)`
- **Delete Challan**: `deleteDoc(doc(db, 'challans', challanId))`

#### Stock Transfer

**Collection**: `stockTransfers`

```typescript
interface StockTransfer {
  id: string;                // Document ID
  sourceId: string;          // Source branch ID
  sourceName: string;        // Source branch name
  destinationId: string;     // Destination branch ID
  destinationName: string;   // Destination branch name
  products: {                // Products transferred
    productId: string;       // Product ID
    name: string;            // Product name
    serialNumbers: string[]; // Serial numbers
    quantity: number;        // Quantity
  }[];
  transferDate: Timestamp;   // Transfer date
  createdBy: {               // User who created the transfer
    id: string;              // User ID
    name: string;            // User name
  };
  status: 'pending' | 'completed' | 'cancelled'; // Transfer status
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Transfers**: `getDocs(collection(db, 'stockTransfers'))`
- **Get Transfer**: `getDoc(doc(db, 'stockTransfers', transferId))`
- **Add Transfer**: `addDoc(collection(db, 'stockTransfers'), transferData)`
- **Update Transfer**: `updateDoc(doc(db, 'stockTransfers', transferId), transferData)`
- **Delete Transfer**: `deleteDoc(doc(db, 'stockTransfers', transferId))`

### Cash Register

**Collection**: `cashEntries`

```typescript
interface CashEntry {
  id: string;                // Document ID
  date: Timestamp;           // Date of entry
  type: 'in' | 'out';        // Cash in or cash out
  amount: number;            // Amount
  remarks: string;           // Remarks/notes
  branchId: string;          // Branch/Center ID
  branchName: string;        // Branch/Center name
  createdBy: {               // User who created the entry
    id: string;              // User ID
    name: string;            // User name
  };
  createdAt: Timestamp;      // Creation timestamp
  updatedAt: Timestamp;      // Last update timestamp
}
```

**API Operations**:
- **List Cash Entries**: `getDocs(collection(db, 'cashEntries'))`
- **Get Cash Entry**: `getDoc(doc(db, 'cashEntries', entryId))`
- **Add Cash Entry**: `addDoc(collection(db, 'cashEntries'), entryData)`
- **Update Cash Entry**: `updateDoc(doc(db, 'cashEntries', entryId), entryData)`
- **Delete Cash Entry**: `deleteDoc(doc(db, 'cashEntries', entryId))`

## API Usage Guidelines

1. **Authentication**: Always authenticate the user before making any API calls.
2. **Error Handling**: Handle errors gracefully and show appropriate error messages to the user.
3. **Data Validation**: Validate data on the client-side before sending it to the API.
4. **Batch Operations**: Use Firebase batch operations for complex transactions to ensure data consistency.
5. **Offline Support**: Consider implementing offline support using Firebase's offline capabilities.

## Mobile-Specific Considerations

1. **Authentication State**: Maintain authentication state in secure storage.
2. **Network Status**: Check network status before making API calls and provide offline functionality.
3. **Push Notifications**: Implement Firebase Cloud Messaging for push notifications.
4. **File Handling**: Manage file uploads efficiently for invoices, challans, etc.
5. **Caching**: Implement appropriate caching strategies for frequently accessed data.

## Common API Patterns

### Filtering Data (Client-Side)

```javascript
const docs = await getDocs(collection(db, 'products'));
const filteredData = docs.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()));
```

### Updating with Transaction

```javascript
const productRef = doc(db, 'products', productId);
await runTransaction(db, async (transaction) => {
  const productDoc = await transaction.get(productRef);
  if (!productDoc.exists()) {
    throw "Document does not exist!";
  }
  transaction.update(productRef, { ...newData });
});
```

### Uploading Files

```javascript
const fileRef = ref(storage, `invoices/${invoiceNo}`);
await uploadBytes(fileRef, file);
const fileUrl = await getDownloadURL(fileRef);
```

## Security Rules

The Firebase security rules are set up to allow only authenticated users to read and write data. Admin users have full access to all data, while staff users are restricted based on their allowed modules and branch assignment.

For example, a staff user can only view and modify data related to their branch, while an admin can view and modify data for all branches.

## API Version History

- **v1.0.0** (Current) - Initial API release

## Support

For any API-related issues or questions, please contact the development team.

---

This documentation is subject to change as the API evolves. Always refer to the latest version for the most up-to-date information. 