'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
    borderBottomColor: '#2196F3',
  },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 22, fontWeight: 'bold', color: '#2196F3', marginBottom: 5 },
  companyDetails: { fontSize: 10, color: '#666666', lineHeight: 1.4 },
  receiptTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333', textAlign: 'right', marginTop: 10 },
  receiptNumber: { fontSize: 12, color: '#666666', textAlign: 'right', marginTop: 5 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#333333', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginBottom: 6 },
  label: { width: '36%', fontSize: 10, color: '#666666' },
  value: { flex: 1, fontSize: 10, color: '#333333' },
  amountBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 4,
  },
  amountLabel: { fontSize: 11, color: '#1565C0', marginBottom: 4 },
  amountValue: { fontSize: 18, fontWeight: 'bold', color: '#1976D2' },
  footer: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  footerText: { fontSize: 9, color: '#666666', textAlign: 'center', lineHeight: 1.4 },
  termsSection: { marginTop: 16 },
  termsText: { fontSize: 9, color: '#666666', lineHeight: 1.4 },
});

export interface BookingReceiptData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  receiptNumber: string;
  receiptDate: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAddress?: string;
  bookingDate: string;
  advanceAmount: number;
  deviceName?: string;
  /** Brand / manufacturer line (e.g. Signia) for custom HTML templates */
  deviceBrand?: string;
  /** Model line for custom HTML templates */
  deviceModel?: string;
  mrp?: number;
  sellingPrice?: number;
  quantity?: number;
  balanceAmount?: number;
  paymentMode?: string;
  centerName?: string;
  visitDate?: string;
  terms?: string;
}

const BookingReceiptTemplate: React.FC<{ data: BookingReceiptData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyDetails}>
            {data.companyAddress}
            {'\n'}Phone: {data.companyPhone}
            {'\n'}Email: {data.companyEmail}
          </Text>
        </View>
        <View>
          <Text style={styles.receiptTitle}>BOOKING RECEIPT</Text>
          <Text style={styles.receiptNumber}>#{data.receiptNumber}</Text>
          <Text style={styles.receiptNumber}>Date: {data.receiptDate}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Patient Details</Text>
        <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{data.patientName}</Text></View>
        {data.patientPhone && <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{data.patientPhone}</Text></View>}
        {data.patientEmail && <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{data.patientEmail}</Text></View>}
        {data.patientAddress && <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}>{data.patientAddress}</Text></View>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Booking Details</Text>
        <View style={styles.row}><Text style={styles.label}>Booking Date</Text><Text style={styles.value}>{data.bookingDate}</Text></View>
        {data.visitDate && <View style={styles.row}><Text style={styles.label}>Visit Date</Text><Text style={styles.value}>{data.visitDate}</Text></View>}
        {data.centerName && <View style={styles.row}><Text style={styles.label}>Center</Text><Text style={styles.value}>{data.centerName}</Text></View>}
        {data.deviceName && <View style={styles.row}><Text style={styles.label}>Device Booked</Text><Text style={styles.value}>{data.deviceName}</Text></View>}
        {typeof data.mrp === 'number' && <View style={styles.row}><Text style={styles.label}>MRP</Text><Text style={styles.value}>₹{data.mrp.toLocaleString('en-IN')}</Text></View>}
        {typeof data.sellingPrice === 'number' && <View style={styles.row}><Text style={styles.label}>Selling Price</Text><Text style={styles.value}>₹{data.sellingPrice.toLocaleString('en-IN')}</Text></View>}
        {typeof data.quantity === 'number' && <View style={styles.row}><Text style={styles.label}>Quantity</Text><Text style={styles.value}>{data.quantity}</Text></View>}
        {typeof data.balanceAmount === 'number' && <View style={styles.row}><Text style={styles.label}>Balance Left</Text><Text style={styles.value}>₹{data.balanceAmount.toLocaleString('en-IN')}</Text></View>}
        {data.paymentMode && <View style={styles.row}><Text style={styles.label}>Mode of Payment</Text><Text style={styles.value}>{data.paymentMode}</Text></View>}
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Advance Amount Received</Text>
        <Text style={styles.amountValue}>₹{data.advanceAmount.toLocaleString('en-IN')}</Text>
      </View>

      {data.terms && (
        <View style={styles.termsSection}>
          <Text style={styles.sectionTitle}>Terms</Text>
          <Text style={styles.termsText}>{data.terms}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Thank you for your booking. This receipt is issued against advance payment for hearing aid booking.
          {'\n'}Please retain this receipt for your records.
        </Text>
      </View>
    </Page>
  </Document>
);

export default BookingReceiptTemplate;
