# Guide: Assigning Companies to Products

## Overview
With the new multi-company support, you can now assign companies to products. This allows better inventory management across different companies.

## Current Behavior
**Good News:** The system now shows ALL products that don't have a company assigned, making them available for all companies. This ensures backward compatibility with existing inventory.

## Why Assign Companies to Products?

1. **Better Organization**: Clearly identify which products belong to which company
2. **Accurate Stock Tracking**: Track inventory separately for each company
3. **Cleaner Reports**: Generate company-specific reports
4. **Intercompany Transfers**: Properly track products moving between companies

---

## How to Assign Companies to Products

### Method 1: When Creating New Products

1. Go to **Products** page
2. Click **"Add Product"**
3. Fill in product details
4. In the **"Company"** field, select the appropriate company:
   - Hope Enterprises
   - HDIPL
   - Or leave blank for shared products
5. Click **"Save"**

### Method 2: Edit Existing Products

1. Go to **Products** page
2. Find the product you want to update
3. Click the **Edit** (pencil icon) button
4. Update the **"Company"** field
5. Click **"Update Product"**

### Method 3: Bulk Update via Firebase Console (For Many Products)

If you have many products to update:

1. Go to **Firebase Console** → **Firestore Database**
2. Open the `products` collection
3. For each product document:
   - Click to edit
   - Add/Edit field: `company` (type: string)
   - Set value to: `Hope Enterprises` or `HDIPL`
   - Save

---

## Stock Transfer Behavior

### Current (Backward Compatible)
- Products **WITHOUT** a company assigned → Available for **ALL** companies
- Products **WITH** a company assigned → Available only for that specific company

### Example Scenarios

#### Scenario 1: Product Without Company
```
Product: Signia Silk 7X
Company: (not set)
Location: Rohini Center

✅ Can be transferred in Hope Enterprises intracompany transfer
✅ Can be transferred in HDIPL intracompany transfer
✅ Can be transferred in intercompany transfers
```

#### Scenario 2: Product With Company Set
```
Product: Phonak Audeo Paradise
Company: Hope Enterprises
Location: Rohini Center

✅ Can be transferred in Hope Enterprises intracompany transfer
❌ Cannot be transferred in HDIPL intracompany transfer
✅ Can be transferred FROM Hope Enterprises in intercompany transfer
```

---

## Recommended Workflow

### For New Setup:
1. Create both companies in the **Companies** module
2. Assign centers to companies in the **Centers** module
3. When adding new products, always select the appropriate company
4. When receiving stock (Material In/Purchases), ensure products have companies set

### For Existing Setup:
1. Products without companies will continue to work normally
2. Gradually update products to assign them to specific companies
3. Use the console logs in browser to see which products don't have companies
4. Update high-value or frequently-moved products first

---

## Checking Which Products Need Companies

### Method 1: Browser Console
1. Open Stock Transfer page
2. Open browser console (F12 or Cmd+Option+I)
3. Click "New Transfer"
4. Select a center
5. Look for console logs showing:
   ```
   📦 Stock at center XXX: XX items
   🔍 Filtered stock for intracompany transfer - Before: XX, After: XX
   ```
6. If "After" shows more items than expected, some products don't have companies

### Method 2: Firebase Console
1. Go to **Firebase Console** → **Firestore Database**
2. Open `products` collection
3. Look for documents without a `company` field
4. Manually add the field for those products

---

## Tips

### Tip 1: Shared Products
If certain products are genuinely shared between companies (e.g., accessories, batteries), you can:
- Leave the company field empty
- They'll be available for all companies

### Tip 2: Gradual Migration
You don't need to update all products at once:
- Start with high-value products
- Update products as you work with them
- Use reports to identify frequently transferred products

### Tip 3: Default Company
When creating new products, set a sensible default:
- Most products → Hope Enterprises
- Manufacturing products → HDIPL
- Shared items → Leave blank

---

## Troubleshooting

### Problem: No products showing in stock transfer
**Solution:**
1. Check browser console for logs
2. Verify products exist at the selected center (check Inventory page)
3. Verify products are "In Stock" status
4. Check if products are serial-tracked and have serial numbers assigned

### Problem: Can't find a specific product
**Solution:**
1. Go to Inventory page
2. Search for the product
3. Check its location and company
4. If company doesn't match, either:
   - Change the product's company to match
   - Or clear the product's company field

### Problem: Product shows in inventory but not in transfer
**Solution:**
1. Check product status (must be "In Stock")
2. Check product location matches the "From Center"
3. Open browser console to see filtering logs
4. Verify the product's company matches the selected company (or is blank)

---

## Console Logs Reference

When using Stock Transfer, watch for these helpful logs:

```javascript
📦 Stock at center {center-id}: {count} items
// Shows total items at the selected center

🔍 Filtered stock for intracompany transfer - 
    Company: {company-name}, 
    Center: {center-id}, 
    Before: {count}, 
    After: {count}
// Shows filtering results
// If Before > After, some products have different companies
// If Before = After, all products match or have no company
```

---

## Best Practices

1. **Consistent Naming**: Use exact company names (case-sensitive)
   - ✅ "Hope Enterprises" 
   - ❌ "hope enterprises" or "Hope enterprises"

2. **Regular Audits**: Periodically check products without companies
   
3. **New Product Checklist**:
   - [ ] Company assigned
   - [ ] Type selected
   - [ ] Serial number requirement set
   - [ ] Pricing filled

4. **Stock Transfer Checklist**:
   - [ ] Correct transfer type (intra/inter)
   - [ ] Correct companies selected
   - [ ] Correct centers selected
   - [ ] Products show up in dropdown

---

## Need Help?

If you encounter issues:
1. Check browser console (F12) for error messages
2. Verify Firebase Firestore data structure
3. Check this guide's troubleshooting section
4. Review the console logs for filtering insights

---

**Last Updated:** October 23, 2025
**Version:** 2.0 - Multi-Company Support

