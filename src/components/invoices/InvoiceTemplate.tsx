'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts (optional - you can add custom fonts)
// Font.register({
//   family: 'Roboto',
//   src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf'
// });

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
  },
  logo: {
    width: 80,
    height: 80,
    marginRight: 20,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 10,
    color: '#666666',
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginTop: 10,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
    marginTop: 5,
  },
  customerSection: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  billTo: {
    flex: 1,
    marginRight: 20,
  },
  invoiceDetails: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  customerInfo: {
    fontSize: 10,
    color: '#666666',
    lineHeight: 1.4,
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#DDDDDD',
    marginBottom: 20,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '16.66%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#DDDDDD',
    backgroundColor: '#F8F9FA',
    padding: 8,
  },
  tableCol: {
    width: '16.66%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#DDDDDD',
    padding: 8,
  },
  tableColWide: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#DDDDDD',
    padding: 8,
  },
  tableColNarrow: {
    width: '12.5%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#DDDDDD',
    padding: 8,
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 9,
    color: '#666666',
  },
  tableCellRight: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'right',
  },
  tableCellCenter: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
  },
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  totalsTable: {
    width: '40%',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalLabel: {
    flex: 1,
    fontSize: 10,
    color: '#666666',
  },
  totalValue: {
    fontSize: 10,
    color: '#333333',
    textAlign: 'right',
    minWidth: 80,
  },
  grandTotalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FF6B35',
    marginTop: 5,
  },
  grandTotalLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'right',
    minWidth: 80,
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  footerText: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  termsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  termsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  termsText: {
    fontSize: 9,
    color: '#666666',
    lineHeight: 1.4,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  signatureBox: {
    width: '40%',
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 10,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
});

// Interface for invoice data
export interface InvoiceData {
  // Company Information
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGST?: string;
  companyLogo?: string;
  
  // Invoice Details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  
  // Customer Information
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerGST?: string;
  
  // Products/Services
  items: {
    id: string;
    name: string;
    description?: string;
    serialNumber?: string;
    quantity: number;
    rate: number;
    mrp?: number;
    discount?: number;
    gstPercent?: number;
    amount: number;
  }[];
  
  // Totals
  subtotal: number;
  totalDiscount?: number;
  totalGST?: number;
  grandTotal: number;
  
  // Additional Information
  notes?: string;
  terms?: string;
  paymentMethod?: string;
  referenceDoctor?: string;
  salesperson?: string;
  branch?: string;
}

// Main Invoice Template Component
const InvoiceTemplate: React.FC<{ data: InvoiceData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyDetails}>
            {data.companyAddress}
            {'\n'}Phone: {data.companyPhone}
            {'\n'}Email: {data.companyEmail}
            {data.companyGST && `\nGST: ${data.companyGST}`}
          </Text>
        </View>
        <View>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>#{data.invoiceNumber}</Text>
          <Text style={styles.invoiceNumber}>Date: {data.invoiceDate}</Text>
          {data.dueDate && (
            <Text style={styles.invoiceNumber}>Due: {data.dueDate}</Text>
          )}
        </View>
      </View>

      {/* Customer Section */}
      <View style={styles.customerSection}>
        <View style={styles.billTo}>
          <Text style={styles.sectionTitle}>Bill To:</Text>
          <Text style={styles.customerInfo}>
            {data.customerName}
            {data.customerAddress && `\n${data.customerAddress}`}
            {data.customerPhone && `\nPhone: ${data.customerPhone}`}
            {data.customerEmail && `\nEmail: ${data.customerEmail}`}
            {data.customerGST && `\nGST: ${data.customerGST}`}
          </Text>
        </View>
        <View style={styles.invoiceDetails}>
          {data.referenceDoctor && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>Reference Doctor:</Text>
              <Text style={styles.customerInfo}>{data.referenceDoctor}</Text>
            </View>
          )}
          {data.salesperson && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>Salesperson:</Text>
              <Text style={styles.customerInfo}>{data.salesperson}</Text>
            </View>
          )}
          {data.branch && (
            <View>
              <Text style={styles.sectionTitle}>Branch:</Text>
              <Text style={styles.customerInfo}>{data.branch}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableRow}>
          <View style={styles.tableColWide}>
            <Text style={styles.tableCellHeader}>Product/Service</Text>
          </View>
          <View style={styles.tableColNarrow}>
            <Text style={styles.tableCellHeader}>Serial #</Text>
          </View>
          <View style={styles.tableColNarrow}>
            <Text style={styles.tableCellHeader}>Qty</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableCellHeader}>MRP</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableCellHeader}>Rate</Text>
          </View>
          <View style={styles.tableColNarrow}>
            <Text style={styles.tableCellHeader}>GST%</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableCellHeader}>Amount</Text>
          </View>
        </View>

        {/* Table Rows */}
        {data.items.map((item, index) => (
          <View style={styles.tableRow} key={index}>
            <View style={styles.tableColWide}>
              <Text style={styles.tableCell}>{item.name}</Text>
              {item.description && (
                <Text style={[styles.tableCell, { fontSize: 8, color: '#999999', marginTop: 2 }]}>
                  {item.description}
                </Text>
              )}
            </View>
            <View style={styles.tableColNarrow}>
              <Text style={styles.tableCellCenter}>{item.serialNumber || '—'}</Text>
            </View>
            <View style={styles.tableColNarrow}>
              <Text style={styles.tableCellCenter}>{item.quantity}</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.tableCellRight}>
                {item.mrp ? `₹${item.mrp.toLocaleString('en-IN')}` : '—'}
              </Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.tableCellRight}>₹{item.rate.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.tableColNarrow}>
              <Text style={styles.tableCellCenter}>{item.gstPercent || 0}%</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.tableCellRight}>₹{item.amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Totals Section */}
      <View style={styles.totalsSection}>
        <View style={styles.totalsTable}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>₹{data.subtotal.toLocaleString('en-IN')}</Text>
          </View>
          {data.totalDiscount && data.totalDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalValue}>-₹{data.totalDiscount.toLocaleString('en-IN')}</Text>
            </View>
          )}
          {data.totalGST && data.totalGST > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST:</Text>
              <Text style={styles.totalValue}>₹{data.totalGST.toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total:</Text>
            <Text style={styles.grandTotalValue}>₹{data.grandTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* Terms and Conditions */}
      {data.terms && (
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Terms & Conditions:</Text>
          <Text style={styles.termsText}>{data.terms}</Text>
        </View>
      )}

      {/* Notes */}
      {data.notes && (
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Notes:</Text>
          <Text style={styles.termsText}>{data.notes}</Text>
        </View>
      )}

      {/* Signature Section */}
      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>Customer Signature</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>Authorized Signature</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Thank you for your business!
          {'\n'}This is a computer-generated invoice and does not require a physical signature.
        </Text>
      </View>
    </Page>
  </Document>
);

export default InvoiceTemplate;
