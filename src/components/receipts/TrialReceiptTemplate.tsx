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
    borderBottomColor: '#FF9800',
  },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 22, fontWeight: 'bold', color: '#FF9800', marginBottom: 5 },
  companyDetails: { fontSize: 10, color: '#666666', lineHeight: 1.4 },
  receiptTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333', textAlign: 'right', marginTop: 10 },
  receiptNumber: { fontSize: 12, color: '#666666', textAlign: 'right', marginTop: 5 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#333333', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginBottom: 6 },
  label: { width: '36%', fontSize: 10, color: '#666666' },
  value: { flex: 1, fontSize: 10, color: '#333333' },
  deviceBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 4,
  },
  footer: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  footerText: { fontSize: 9, color: '#666666', textAlign: 'center', lineHeight: 1.4 },
  termsSection: { marginTop: 16 },
  termsText: { fontSize: 9, color: '#666666', lineHeight: 1.4 },
});

export interface TrialReceiptData {
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
  trialDate?: string;
  trialStartDate: string;
  trialEndDate?: string;
  trialDurationDays?: number;
  deviceUsed?: string;
  trialType?: string;
  serialNumber?: string;
  whichEar?: string;
  /** Home trial security deposit (₹); omit for clinic trial. */
  securityDepositAmount?: number;
  centerName?: string;
  visitDate?: string;
  terms?: string;
}

const TrialReceiptTemplate: React.FC<{ data: TrialReceiptData }> = ({ data }) => (
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
          <Text style={styles.receiptTitle}>TRIAL RECEIPT</Text>
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
        <Text style={styles.sectionTitle}>Trial Details</Text>
        {data.trialDate && <View style={styles.row}><Text style={styles.label}>Trial Date</Text><Text style={styles.value}>{data.trialDate}</Text></View>}
        {data.trialType && <View style={styles.row}><Text style={styles.label}>Trial Type</Text><Text style={styles.value}>{data.trialType}</Text></View>}
        <View style={styles.row}><Text style={styles.label}>Start Date</Text><Text style={styles.value}>{data.trialStartDate}</Text></View>
        {data.trialEndDate && <View style={styles.row}><Text style={styles.label}>End Date</Text><Text style={styles.value}>{data.trialEndDate}</Text></View>}
        {data.trialDurationDays != null && <View style={styles.row}><Text style={styles.label}>Duration</Text><Text style={styles.value}>{data.trialDurationDays} days</Text></View>}
        {data.visitDate && <View style={styles.row}><Text style={styles.label}>Issue Date (Visit)</Text><Text style={styles.value}>{data.visitDate}</Text></View>}
        {data.centerName && <View style={styles.row}><Text style={styles.label}>Center</Text><Text style={styles.value}>{data.centerName}</Text></View>}
      </View>

      <View style={styles.deviceBox}>
        <Text style={styles.sectionTitle}>Device on Trial</Text>
        {data.deviceUsed && <View style={styles.row}><Text style={styles.label}>Device</Text><Text style={styles.value}>{data.deviceUsed}</Text></View>}
        {data.serialNumber && <View style={styles.row}><Text style={styles.label}>Serial Number</Text><Text style={styles.value}>{data.serialNumber}</Text></View>}
        {data.whichEar && <View style={styles.row}><Text style={styles.label}>Ear</Text><Text style={styles.value}>{data.whichEar}</Text></View>}
      </View>

      {data.terms && (
        <View style={styles.termsSection}>
          <Text style={styles.sectionTitle}>Terms</Text>
          <Text style={styles.termsText}>{data.terms}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This receipt confirms that the above hearing aid device has been issued for trial as on the start date.
          {'\n'}Please return the device in good condition by the end date. Damages or loss may attract charges.
          {'\n'}Thank you for choosing us.
        </Text>
      </View>
    </Page>
  </Document>
);

export default TrialReceiptTemplate;
