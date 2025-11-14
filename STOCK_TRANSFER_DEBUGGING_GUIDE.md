# Stock Transfer Debugging Guide

## Issue: Products Not Showing in Stock Transfer

If products that exist in your inventory are not showing up in the stock transfer module, follow this debugging guide.

---

## Step 1: Open Browser Console

1. Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
2. Go to the **Console** tab
3. Keep it open while using the stock transfer module

---

## Step 2: Check Available Stock Summary

When the page loads, you should see a log like:

```
📦 Available stock summary: {
  serialItems: 45,
  nonSerialItems: 12,
  totalItems: 57,
  byLocation: { "center-id-1": 30, "center-id-2": 27 },
  byCompany: { "Hope Enterprises": 40, "(no company)": 17 }
}
```

### What to Check:
- **totalItems**: If this is 0, no inventory is being loaded at all
- **byCompany**: Shows which companies your products belong to
  - `"(no company)"`: Products without a company assigned
  - `"Hope Enterprises"`, `"HDIPL"`: Products with companies

### Common Issues:
1. **All items show "(no company)"**
   - Your products don't have companies assigned
   - Go to Products page and assign companies

2. **Company names don't match**
   - Check if company names in byCompany match exactly with your company names
   - Example: "Hope Enterprises" ≠ "hope enterprises" ≠ "HopeEnterprises"

---

## Step 3: Check Sample Items

Look for a log like:

```
Sample items with companies: [
  { name: "Phonak Audeo", company: "Hope Enterprises", location: "center-1" },
  { name: "Signia Silk", company: "(no company)", location: "center-2" },
  ...
]
```

### What to Check:
- Do products have the correct company assigned?
- Are the company names exactly as expected?

---

## Step 4: Test Stock Transfer Selection

1. Click **"New Transfer"**
2. Select **Transfer Type**: Intracompany or Intercompany
3. Select a **Company**
4. Select a **From Center**

### Watch Console for These Logs:

```
📦 Stock at center center-id-123: 15 items
```
- Shows total items at the selected center

```
Sample stock items: [
  { name: "Product 1", company: "Hope Enterprises", location: "center-id-123", productId: "..." },
  ...
]
```
- Shows what's available at that center with company info

```
🔍 Filtering for company: "Hope Enterprises"
Companies in available stock: ["Hope Enterprises", "HDIPL", "(no company)"]
```
- Shows which companies are in the available stock

```
🔍 Filtered stock for intracompany transfer - 
    Company: Hope Enterprises, 
    Center: center-id-123, 
    Before: 15, 
    After: 10
```
- **Before**: Items at the center
- **After**: Items matching the company filter
- If After = 0, the filtering removed all items

```
Excluding item: "Product Name" (company: "HDIPL" doesn't match "Hope Enterprises")
```
- Shows which items were filtered out and why

---

## Common Problems & Solutions

### Problem 1: After = 0 (No items after filtering)

**Cause**: Products at the center don't match the selected company

**Solution**:
1. Check console to see what companies the products have
2. Either:
   - Select the correct company that matches your products
   - Or update your products to have the correct company

**Example**:
```
🔍 Filtering for company: "Hope Enterprises"
Companies in available stock: ["HDIPL", "(no company)"]
Before: 15, After: 0
```
This means all 15 items are either HDIPL or have no company, but you selected Hope Enterprises.

### Problem 2: Company Names Don't Match

**Cause**: Company names have extra spaces, different case, or spelling differences

**Example Issues**:
- "Hope Enterprises" in companies collection
- "hope enterprises" in products (different case)
- "Hope Enterprises " in products (extra space)

**Solution**:
The system now does case-insensitive matching, but check for:
1. Extra spaces at the beginning or end
2. Completely different spellings

**How to Fix**:
1. Go to Firebase Console → Firestore
2. Check `companies` collection for exact company names
3. Check `products` collection for product company names
4. Make sure they match EXACTLY (case doesn't matter anymore)

### Problem 3: Products Have No Company

**Cause**: Products were created before company feature was added

**This is OK!** Products without companies will show for ALL company selections.

**To Fix (Optional)**:
1. Go to Products page
2. Edit each product
3. Assign the appropriate company

---

## Verification Checklist

Use this checklist to verify everything is set up correctly:

### ✅ Companies Setup
- [ ] Companies exist in Companies module
- [ ] Company names are clear and distinct
- [ ] Centers are assigned to companies

### ✅ Products Setup
- [ ] Products have companies assigned (check Products page)
- [ ] Company names match exactly with Companies module
- [ ] Products are in the correct centers/locations

### ✅ Inventory Setup
- [ ] Products appear in Inventory page
- [ ] Products show correct locations
- [ ] Products show correct companies
- [ ] Products have status "In Stock"

### ✅ Stock Transfer
- [ ] Transfer type selected (intra/inter company)
- [ ] Company selected
- [ ] From center selected
- [ ] Console shows "After" > 0

---

## Quick Fix: Disable Company Filtering (Temporary)

If you need to transfer products urgently and don't want to fix company assignments:

**Note**: This would require code changes. Instead, the current system allows products WITHOUT companies to show for all company selections. So you can:

1. Go to Products page
2. Edit products that aren't showing
3. **Clear** the company field (leave it empty)
4. Save
5. Those products will now show for all companies

---

## Testing Scenario

Here's a complete test scenario to verify everything works:

### Setup:
1. **Company**: Hope Enterprises
2. **Center**: Rohini (assigned to Hope Enterprises)
3. **Product**: Phonak Audeo P90 (company: Hope Enterprises)
4. **Inventory**: 2 units at Rohini

### Test:
1. Open Stock Transfer
2. Click "New Transfer"
3. Select "Intracompany Transfer"
4. Select Company: "Hope Enterprises"
5. Select From Center: "Rohini"
6. Check console:
   ```
   📦 Stock at center rohini-id: 2 items
   🔍 Filtering for company: "Hope Enterprises"
   Before: 2, After: 2
   ```
7. Product dropdown should show: "Phonak Audeo P90 [2 available]"

### If Product Doesn't Show:
- Check console logs
- Look for "Excluding item" messages
- Verify product company in Firebase
- Verify center ID matches

---

## Getting More Help

If you're still having issues after following this guide:

1. **Copy console logs** from all the steps above
2. **Take screenshots** of:
   - Companies page showing your companies
   - Products page showing product with company
   - Inventory page showing the product at the center
   - Stock Transfer dialog with no products showing
   - Browser console with all logs

3. **Check**:
   - Are there any error messages in red in the console?
   - What are the exact company names showing in the logs?
   - What does "Before" and "After" show in the filtering logs?

---

## Technical Details

For developers/advanced users:

### How Filtering Works:

1. **Load all available stock** from materials-in, purchases, sales, material-outs
2. **Filter by location** (from center)
3. **Filter by company**:
   - If product has NO company → Include (shows for all companies)
   - If product company matches selected company (case-insensitive) → Include
   - Otherwise → Exclude

### Code Location:
- File: `src/app/(protected)/stock-transfer/page.tsx`
- Function: `filteredAvailableStock` (useMemo hook)
- Lines: ~205-277

### Company Matching:
```javascript
const matches = !itemCompany || 
               itemCompany.trim() === '' || 
               itemCompany.trim().toLowerCase() === selectedCompany.trim().toLowerCase();
```

This means:
- Empty company → matches
- Same company (ignoring case and spaces) → matches
- Different company → doesn't match

---

**Last Updated**: October 23, 2025
**Version**: 1.0 - Multi-Company Stock Transfer

