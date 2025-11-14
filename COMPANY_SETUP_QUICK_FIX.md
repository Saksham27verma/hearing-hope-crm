# Quick Fix: Adding Both Companies to Stock Transfer

## Problem
Only one company is showing in the stock transfer dropdown, but you have two companies: "Hope Enterprises" and "HDIPL".

## Solution

Choose **ONE** of these methods:

---

## Method 1: Firebase Console (Quickest - 5 minutes)

### Step 1: Create Companies Collection

1. Go to **Firebase Console** → **Firestore Database**
2. Click **"Start collection"**
3. Enter collection ID: `companies`
4. Click **"Next"**

### Step 2: Add Hope Enterprises

1. Document ID: `hope-enterprises`
2. Add fields:
   - `name` (string): `Hope Enterprises`
   - `type` (string): `Hearing Aid Retail`
   - `gstNumber` (string): `07AFNPM1470L1Z3`
   - `address` (string): `G-14, Ground Floor, King Mall, Sector-10, Rohini, Delhi - 110085`
   - `phone` (string): `9711871169`
   - `email` (string): `hearinghope@gmail.com`
3. Click **"Save"**

### Step 3: Add HDIPL

1. Click **"Add document"** in companies collection
2. Document ID: `hdipl`
3. Add fields:
   - `name` (string): `HDIPL`
   - `type` (string): `Hearing Devices`
   - `gstNumber` (string): *your GST number*
   - `address` (string): *your address*
   - `phone` (string): *your phone*
   - `email` (string): *your email*
4. Click **"Save"**

### Step 4: Assign Companies to Centers

Now, for each center in the `centers` collection:

1. Open each center document
2. Add/Edit field:
   - Field: `company`
   - Type: `string`
   - Value: Either `Hope Enterprises` or `HDIPL`
3. Save

**Example:**
- Rohini Center → `company`: `Hope Enterprises`
- Noida Center → `company`: `Hope Enterprises`
- HDIPL Warehouse → `company`: `HDIPL`

### Step 5: Refresh

1. Go back to your Stock Transfer page
2. Refresh the browser (F5 or Cmd+R)
3. Click "New Transfer"
4. Both companies should now appear!

---

## Method 2: Automatic Script (If you have Node.js)

### Step 1: Run the Setup Script

```bash
cd "/Users/saksham27verma/Desktop/CRM & Inventory for Hope/hearing-hope-crm"
node scripts/setup-companies.js
```

### Step 2: Check Console Logs

The script will:
- ✅ Create both companies in Firebase
- ✅ Assign companies to all centers
- ✅ Show you what was done

### Step 3: Refresh

Refresh your Stock Transfer page - both companies will appear!

---

## Method 3: Manual Check (Debug Mode)

If you've already created the companies but they're not showing:

### Step 1: Open Browser Console

1. Open Stock Transfer page
2. Press `F12` (or `Cmd+Option+I` on Mac)
3. Go to **Console** tab
4. Click "New Transfer" button

### Step 2: Check Console Logs

You should see logs like:
```
📊 Found companies collection with 2 companies
  ✓ Added company: Hope Enterprises
  ✓ Added company: HDIPL
✅ Loaded companies: HDIPL, Hope Enterprises
```

### Step 3: Troubleshooting

**If you see:** `⚠️ No companies found, using defaults`
- ✅ The code will automatically add both companies
- ✅ Just refresh the page

**If you see:** Only one company name
- ❌ You need to create the missing company using Method 1 or 2

---

## Quick Verification Checklist

After setup, verify:

- [ ] Firebase has a `companies` collection
- [ ] `companies` collection has 2 documents: `hope-enterprises` and `hdipl`
- [ ] Each company document has a `name` field
- [ ] All centers in `centers` collection have a `company` field
- [ ] Centers are assigned to either "Hope Enterprises" or "HDIPL"
- [ ] Stock Transfer page shows both companies in dropdown

---

## Default Behavior

**Good news!** The updated code now has a fallback:

If NO companies are found in Firebase, the system will automatically show:
- ✅ Hope Enterprises
- ✅ HDIPL

So even without any setup, you should see both companies now!

---

## Test Your Setup

### Test 1: Intracompany Transfer
1. Select "Intracompany Transfer"
2. Choose "Hope Enterprises"
3. You should only see Hope Enterprises centers

### Test 2: Intercompany Transfer
1. Select "Intercompany Transfer"
2. From Company: "Hope Enterprises"
3. To Company: "HDIPL"
4. Centers should filter correctly

---

## Still Not Working?

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+F5 or Cmd+Shift+R)
3. Check browser console for error messages
4. Verify Firebase rules allow reading `companies` and `centers` collections

---

## Contact Support

If you still have issues:
- Email: hearinghope@gmail.com
- Phone: 9711871169

**Include:**
- Screenshot of browser console
- Screenshot of Firebase `companies` collection
- Screenshot of one center document showing the `company` field

---

Last Updated: October 22, 2025

