# Invoice Template Setup Guide

## How to Add Your Hope Enterprises Invoice Template

### Step 1: Open Invoice Manager
1. Navigate to **Invoice Manager** from the sidebar
2. Click on **"Create Template"** button

### Step 2: Select HTML Template Option
1. Choose **"HTML Template"** (for advanced users)
2. This opens the HTML Template Creator

### Step 3: Fill in Template Details
- **Template Name**: "Hope Enterprises Tax Invoice"
- **Description**: "Official tax invoice template for Hope Enterprises"
- **Category**: Select "Medical" or "Custom"

### Step 4: Add Your HTML Code
1. Copy the entire HTML code from the file: `hope-enterprises-invoice-template.html`
2. Paste it into the HTML Content editor
3. Or click "Load Sample Template" and modify it

### Step 5: Upload Images
Upload two images:
1. **Company Logo** - Click "Upload Logo"
   - Your Hope Enterprises logo (100x100px recommended)
   
2. **Authorized Signature** - Click "Upload Signature"
   - The authorized signatory signature image (170x100px recommended)

The system will automatically:
- Upload images to Firebase Storage
- Generate placeholders like `{{LOGO_1234567890}}`
- Insert them in the correct positions

### Step 6: Preview and Save
1. Click **"Preview"** button to see how it looks with sample data
2. If satisfied, click **"Save Template"**

---

## Using the Template in Sales Module

### Step 1: Create/View a Sale
1. Go to **Sales Module**
2. Create a new sale or view an existing one

### Step 2: Generate Invoice
1. Click the **Print Icon** (🖨️) next to the sale
2. A template selector will appear

### Step 3: Select Your Template
1. Search for "Hope Enterprises"
2. Click on your template card
3. Click **"Select Template"**

### Step 4: Generate PDF
1. The invoice preview opens with your template
2. All data is automatically filled in:
   - Customer name, address, phone
   - Invoice number and date
   - Product details with serial numbers
   - MRP, discounts, GST calculations
   - Total amounts
3. Click **"Download PDF"** to save
4. Or click **"Print"** to print directly

---

## Available Data Placeholders

### Customer Information
- `{{CUSTOMER_NAME}}` - Customer's full name
- `{{CUSTOMER_ADDRESS}}` - Complete billing address
- `{{CUSTOMER_PHONE}}` - Contact number
- `{{CUSTOMER_EMAIL}}` - Email address
- `{{CUSTOMER_GSTIN}}` - Customer's GST number

### Invoice Details
- `{{INVOICE_NUMBER}}` - Unique invoice number
- `{{INVOICE_DATE}}` - Invoice generation date
- `{{DUE_DATE}}` - Payment due date
- `{{PAYMENT_MODE}}` - Cash/Card/UPI/Net Banking

### Product Specific
- `{{WARRANTY_PERIOD}}` - Warranty duration (e.g., "1 Year")
- `{{TRIAL_PERIOD}}` - Trial period in days (e.g., "7")

### Financial Data
- `{{SUBTOTAL}}` - Total before tax
- `{{TAX_RATE}}` - GST percentage
- `{{TAX_AMOUNT}}` - GST amount in rupees
- `{{TOTAL}}` - Grand total with GST

### Special Placeholders
- `{{ITEMS_PLACEHOLDER}}` - Replaced with complete items table
- `{{LOGO_PLACEHOLDER}}` - Your uploaded logo
- `{{SIGNATURE_PLACEHOLDER}}` - Your uploaded signature

---

## Items Table Format

The `{{ITEMS_PLACEHOLDER}}` generates a table with these columns:
1. **S.No** - Serial number (auto-generated)
2. **Product Name** - Item name from your products
3. **Serial No.** - Device serial number
4. **HSN Code** - Tax classification code (default: 9021)
5. **MRP (per unit)** - Maximum Retail Price
6. **QTY** - Quantity sold
7. **Total MRP** - MRP × Quantity
8. **Discount (%)** - Discount percentage
9. **Selling Price** - Price after discount
10. **GST (%)** - GST percentage
11. **GST Amount** - GST in rupees

---

## Tips for Best Results

### Image Optimization
- Logo: 100x100 pixels, PNG format with transparent background
- Signature: 170x100 pixels, PNG or JPG format
- Keep file sizes under 500KB for fast loading

### Testing
1. Always preview before saving
2. Test with sample data to check layout
3. Print a test copy to verify alignment

### Troubleshooting

**Issue: Images not showing**
- Ensure images are uploaded successfully
- Check that placeholder syntax matches

**Issue: Data not filling correctly**
- Verify placeholder spelling (case-sensitive)
- Check for typos in placeholder names

**Issue: Table formatting broken**
- Don't modify the `{{ITEMS_PLACEHOLDER}}` structure
- Keep table tags intact

**Issue: Currency not formatted**
- The system automatically formats to ₹ (INR)
- Uses Indian number format (e.g., ₹50,000)

---

## Support

For issues or customization requests:
- Email: hearinghope@gmail.com
- Phone: 9711871169
- Location: G-14, Ground Floor, King Mall, Sector-10, Rohini, Delhi - 110085

---

## Template File Location

Your custom HTML template is saved at:
```
/hearing-hope-crm/hope-enterprises-invoice-template.html
```

This file can be:
- Edited directly for quick changes
- Backed up for safety
- Shared with team members
- Version controlled

---

Last Updated: October 22, 2025

