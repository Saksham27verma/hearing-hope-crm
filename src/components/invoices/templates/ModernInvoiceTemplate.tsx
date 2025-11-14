'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { InvoiceData } from '../InvoiceTemplate';

// Modern/Minimalist Invoice Template
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 8,
  },
  companyDetails: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  invoiceInfo: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  invoiceDetails: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    lineHeight: 1.4,
  },
  customerSection: {
    flexDirection: 'row',
    marginBottom: 30,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  billTo: {
    flex: 1,
    marginRight: 30,
  },
  additionalInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerInfo: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  table: {
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableColProduct: { flex: 3 },
  tableColSerial: { flex: 1.5 },
  tableColQty: { flex: 1 },
  tableColRate: { flex: 1.5 },
  tableColAmount: { flex: 1.5 },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableCell: {
    fontSize: 10,
    color: '#6B7280',
  },
  tableCellBold: {
    fontSize: 10,
    color: '#111827',
    fontWeight: 'bold',
  },
  tableCellRight: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'right',
  },
  tableCellCenter: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  totalsContainer: {
    width: '50%',
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 11,
    color: '#111827',
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#2563EB',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 1.4,
  },
});

const ModernInvoiceTemplate: React.FC<{ data: InvoiceData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyDetails}>
            {data.companyAddress}
            {'\n'}
            {data.companyPhone} • {data.companyEmail}
            {data.companyGST && `\nGST: ${data.companyGST}`}
          </Text>
        </View>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <Text style={styles.invoiceDetails}>
            #{data.invoiceNumber}
            {'\n'}
            {data.invoiceDate}
            {data.dueDate && `\nDue: ${data.dueDate}`}
          </Text>
        </View>
      </View>

      {/* Customer Section */}
      <View style={styles.customerSection}>
        <View style={styles.billTo}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.customerInfo}>
            {data.customerName}
            {data.customerAddress && `\n${data.customerAddress}`}
            {data.customerPhone && `\n${data.customerPhone}`}
            {data.customerEmail && `\n${data.customerEmail}`}
          </Text>
        </View>
        <View style={styles.additionalInfo}>
          {data.referenceDoctor && (
            <>
              <Text style={styles.sectionTitle}>Reference Doctor</Text>
              <Text style={styles.customerInfo}>{data.referenceDoctor}</Text>
            </>
          )}
          {data.salesperson && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 15 }]}>Salesperson</Text>
              <Text style={styles.customerInfo}>{data.salesperson}</Text>
            </>
          )}
        </View>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.tableColProduct}>
            <Text style={styles.tableCellHeader}>Product</Text>
          </View>
          <View style={styles.tableColSerial}>
            <Text style={[styles.tableCellHeader, { textAlign: 'center' }]}>Serial</Text>
          </View>
          <View style={styles.tableColQty}>
            <Text style={[styles.tableCellHeader, { textAlign: 'center' }]}>Qty</Text>
          </View>
          <View style={styles.tableColRate}>
            <Text style={[styles.tableCellHeader, { textAlign: 'right' }]}>Rate</Text>
          </View>
          <View style={styles.tableColAmount}>
            <Text style={[styles.tableCellHeader, { textAlign: 'right' }]}>Amount</Text>
          </View>
        </View>

        {data.items.map((item, index) => (
          <View style={styles.tableRow} key={index}>
            <View style={styles.tableColProduct}>
              <Text style={styles.tableCellBold}>{item.name}</Text>
              {item.description && (
                <Text style={[styles.tableCell, { fontSize: 9, marginTop: 2 }]}>
                  {item.description}
                </Text>
              )}
            </View>
            <View style={styles.tableColSerial}>
              <Text style={styles.tableCellCenter}>{item.serialNumber || '—'}</Text>
            </View>
            <View style={styles.tableColQty}>
              <Text style={styles.tableCellCenter}>{item.quantity}</Text>
            </View>
            <View style={styles.tableColRate}>
              <Text style={styles.tableCellRight}>₹{item.rate.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.tableColAmount}>
              <Text style={[styles.tableCellRight, { fontWeight: 'bold' }]}>
                ₹{item.amount.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>₹{data.subtotal.toLocaleString('en-IN')}</Text>
          </View>
          {data.totalDiscount && data.totalDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>-₹{data.totalDiscount.toLocaleString('en-IN')}</Text>
            </View>
          )}
          {data.totalGST && data.totalGST > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST</Text>
              <Text style={styles.totalValue}>₹{data.totalGST.toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>₹{data.grandTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* Terms */}
      {data.terms && (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          <Text style={styles.customerInfo}>{data.terms}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Thank you for your business!
          {'\n'}
          This invoice was generated electronically and is valid without signature.
        </Text>
      </View>
    </Page>
  </Document>
);

export default ModernInvoiceTemplate;
