/**
 * Hearing Hope CRM - Firestore Schema Documentation
 * 
 * This file provides documentation for the Firestore database schema.
 * It doesn't affect runtime, but serves as reference for developers.
 */

// Collection: products
/**
 * @collection products
 * @description Store information about products
 * @field id - Auto-generated document ID
 * @field name - Product name
 * @field type - Product type (e.g., "Hearing Aid", "Battery", "Accessory")
 * @field company - Manufacturer name
 * @field mrp - Maximum Retail Price
 * @field dealerPrice - Price at which the product is purchased from the dealer
 * @field description - Optional product description
 * @field createdAt - Timestamp when the product was added
 */

// Collection: inventory
/**
 * @collection inventory
 * @description Tracks inventory levels for products
 * @field productId - Reference to the product
 * @field currentStock - Current quantity in stock
 * @field serialNumbers - Array of serial numbers for unique products
 * @field lastUpdated - Timestamp of the last inventory update
 */

// Collection: customers
/**
 * @collection customers
 * @description Customer information
 * @field name - Customer's full name
 * @field phone - Primary contact number
 * @field email - Email address (optional)
 * @field address - Physical address
 * @field dateOfBirth - Customer's date of birth
 * @field notes - Additional notes about the customer
 * @field createdAt - Timestamp when the customer was added
 */

// Collection: sales
/**
 * @collection sales
 * @description Records of sales transactions
 * @field customerId - Reference to the customer
 * @field customerName - Name of the customer (denormalized)
 * @field products - Array of products sold
 *   @subfield id - Product ID
 *   @subfield name - Product name
 *   @subfield quantity - Quantity sold
 *   @subfield mrp - MRP of the product
 *   @subfield discountPercent - Discount percentage applied
 *   @subfield discountAmount - Calculated discount amount
 *   @subfield finalPrice - Price after discount
 *   @subfield serialNumbers - Array of serial numbers (if applicable)
 * @field subtotal - Sum of all products' prices before tax
 * @field gstPercentage - GST percentage applied
 * @field gstAmount - Calculated GST amount
 * @field totalAmount - Final amount including tax
 * @field profit - Calculated profit from this sale
 * @field paymentMethod - Method of payment (e.g., "Cash", "Card", "UPI")
 * @field reference - Reference/note for this sale
 * @field saleDate - Date of the sale
 * @field createdAt - Timestamp when the sale was recorded
 */

// Collection: purchases
/**
 * @collection purchases
 * @description Records of purchase transactions from vendors
 * @field vendorId - Reference to the vendor
 * @field vendorName - Name of the vendor (denormalized)
 * @field products - Array of products purchased
 *   @subfield id - Product ID
 *   @subfield name - Product name
 *   @subfield quantity - Quantity purchased
 *   @subfield dealerPrice - Dealer price
 *   @subfield mrp - MRP of the product
 *   @subfield discountPercent - Discount percentage applied
 *   @subfield discountAmount - Calculated discount amount
 *   @subfield finalPrice - Price after discount
 *   @subfield serialNumbers - Array of serial numbers (if applicable)
 * @field subtotal - Sum of all products' prices before tax
 * @field gstPercentage - GST percentage applied
 * @field gstAmount - Calculated GST amount
 * @field totalAmount - Final amount including tax
 * @field paymentMethod - Method of payment
 * @field reference - Reference/note for this purchase
 * @field purchaseDate - Date of the purchase
 * @field createdAt - Timestamp when the purchase was recorded
 */

// Collection: vendors
/**
 * @collection vendors
 * @description Information about suppliers/vendors
 * @field name - Vendor's name
 * @field contactPerson - Primary contact person
 * @field phone - Contact number
 * @field email - Email address
 * @field address - Physical address
 * @field gstNumber - GST registration number
 * @field notes - Additional notes
 * @field createdAt - Timestamp when the vendor was added
 */

// Collection: users
/**
 * @collection users
 * @description System users (staff members)
 * @field uid - Firebase Auth user ID
 * @field email - User's email address
 * @field name - User's full name
 * @field role - User role (e.g., "admin", "staff", "manager")
 * @field permissions - Object containing permission flags
 * @field createdAt - Timestamp when the user was added
 * @field lastLogin - Timestamp of the last login
 */

// Collection: manufacturerIncentives
/**
 * @collection manufacturerIncentives
 * @description Records of incentives received from manufacturers
 * @field company - Company receiving the incentive (e.g., "Hope Enterprises", "Hope Digital Innovations")
 * @field manufacturer - Name of the manufacturer providing the incentive
 * @field month - Month for which the incentive applies (YYYY-MM format)
 * @field amount - Incentive amount
 * @field description - Optional description or reason for the incentive
 * @field createdAt - Timestamp when the incentive was recorded
 */

// Collection: employeeExpenses
/**
 * @collection employeeExpenses
 * @description Records of employee-related expenses
 * @field employeeId - Reference to the employee/user
 * @field employeeName - Name of the employee (denormalized)
 * @field expenseType - Type of expense (e.g., "commission", "incentive", "salary", "other")
 * @field month - Month for which the expense applies (YYYY-MM format)
 * @field amount - Expense amount
 * @field description - Optional description
 * @field createdAt - Timestamp when the expense was recorded
 */

// Collection: stockTransfer
/**
 * @collection stockTransfer
 * @description Records of stock transfers between locations
 * @field fromLocation - Source location
 * @field toLocation - Destination location
 * @field products - Array of products transferred
 *   @subfield id - Product ID
 *   @subfield name - Product name
 *   @subfield quantity - Quantity transferred
 *   @subfield serialNumbers - Array of serial numbers (if applicable)
 * @field transferDate - Date of the transfer
 * @field notes - Additional notes
 * @field createdBy - User who created the transfer
 * @field createdAt - Timestamp when the transfer was recorded
 */

// Collection: deliveryChallans
/**
 * @collection deliveryChallans
 * @description Delivery challans for shipments
 * @field challanNumber - Unique challan number
 * @field customerId - Reference to the customer
 * @field customerName - Name of the customer (denormalized)
 * @field products - Array of products in the delivery
 *   @subfield id - Product ID
 *   @subfield name - Product name
 *   @subfield quantity - Quantity delivered
 *   @subfield serialNumbers - Array of serial numbers (if applicable)
 * @field deliveryDate - Date of the delivery
 * @field address - Delivery address
 * @field notes - Additional notes
 * @field createdBy - User who created the challan
 * @field createdAt - Timestamp when the challan was created
 */

// Collection: cashRegister
/**
 * @collection cashRegister
 * @description Cash register entries for tracking cash flow
 * @field type - Type of transaction ("income" or "expense")
 * @field amount - Transaction amount
 * @field category - Category of income/expense
 * @field description - Description of the transaction
 * @field referenceId - Reference to related document (e.g., sale ID)
 * @field transactionDate - Date of the transaction
 * @field createdBy - User who recorded the transaction
 * @field createdAt - Timestamp when the transaction was recorded
 */ 