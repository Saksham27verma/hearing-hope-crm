'use client';

import React, { forwardRef } from 'react';
import type { InvoiceData } from '@/components/invoices/InvoiceTemplate';
import { formatInvoiceCurrency, processInvoiceHtmlTemplate } from '@/utils/invoiceHtmlTemplate';

export type InvoiceVisualTemplate = 'classic' | 'modern' | 'minimal' | 'professional';

export interface InvoicePrintableBodyProps {
  invoiceData: InvoiceData;
  template?: InvoiceVisualTemplate;
  customTemplate?: {
    id: string;
    htmlContent: string;
    images: Array<{ placeholder: string; url: string }>;
  } | null;
}

function getTemplateStyles(template: InvoiceVisualTemplate): React.CSSProperties {
  const baseStyles: React.CSSProperties = {
    fontFamily: 'Arial, sans-serif',
    lineHeight: 1.6,
    color: '#333',
    backgroundColor: '#fff',
    padding: '40px',
    maxWidth: '800px',
    margin: '0 auto',
  };
  const templateStyles: Record<InvoiceVisualTemplate, React.CSSProperties> = {
    classic: { ...baseStyles, fontFamily: 'Times New Roman, serif' },
    modern: { ...baseStyles, fontFamily: 'Helvetica, Arial, sans-serif' },
    minimal: { ...baseStyles, fontFamily: 'Arial, sans-serif', padding: '20px' },
    professional: { ...baseStyles, fontFamily: 'Calibri, Arial, sans-serif', backgroundColor: '#fafafa' },
  };
  return templateStyles[template] || templateStyles.modern;
}

function getHeaderStyles(template: InvoiceVisualTemplate): React.CSSProperties {
  const headerStyles: Record<InvoiceVisualTemplate, React.CSSProperties> = {
    classic: { borderBottom: '3px solid #333', paddingBottom: '20px', marginBottom: '30px' },
    modern: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '30px',
      borderRadius: '8px',
      marginBottom: '30px',
    },
    minimal: { borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '25px' },
    professional: { backgroundColor: '#2c3e50', color: 'white', padding: '25px', marginBottom: '30px' },
  };
  return headerStyles[template] || headerStyles.modern;
}

const InvoicePrintableBody = forwardRef<HTMLDivElement, InvoicePrintableBodyProps>(function InvoicePrintableBody(
  { invoiceData, template = 'modern', customTemplate },
  ref
) {
  const formatCurrency = formatInvoiceCurrency;

  return (
    <div ref={ref}>
      {customTemplate?.htmlContent ? (
        <div
          dangerouslySetInnerHTML={{
            __html: processInvoiceHtmlTemplate(customTemplate.htmlContent, invoiceData, customTemplate),
          }}
        />
      ) : (
        <div style={getTemplateStyles(template)}>
          <div style={getHeaderStyles(template)}>
            <div style={{ textAlign: template === 'modern' ? 'center' : 'left' }}>
              <h1 style={{ margin: 0, fontSize: '2.5em', fontWeight: 'bold' }}>{invoiceData.companyName}</h1>
              <div style={{ fontSize: '1.1em', marginTop: '10px', opacity: 0.9 }}>
                {invoiceData.companyAddress.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
              <div style={{ marginTop: '10px' }}>
                {invoiceData.companyPhone} • {invoiceData.companyEmail}
              </div>
              {invoiceData.companyGST && <div style={{ marginTop: '5px' }}>GST: {invoiceData.companyGST}</div>}
              <h2 style={{ marginTop: '20px', fontSize: '1.8em' }}>INVOICE</h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
            <div>
              <h3
                style={{
                  color: template === 'modern' ? '#667eea' : '#333',
                  marginBottom: '15px',
                  borderBottom: '2px solid',
                  paddingBottom: '5px',
                }}
              >
                Bill To:
              </h3>
              <p style={{ margin: '8px 0', fontWeight: 'bold' }}>{invoiceData.customerName}</p>
              {invoiceData.customerAddress && <p style={{ margin: '8px 0' }}>{invoiceData.customerAddress}</p>}
              {invoiceData.customerPhone && <p style={{ margin: '8px 0' }}>Phone: {invoiceData.customerPhone}</p>}
              {invoiceData.customerEmail && <p style={{ margin: '8px 0' }}>Email: {invoiceData.customerEmail}</p>}
              {invoiceData.customerGST && <p style={{ margin: '8px 0' }}>GST: {invoiceData.customerGST}</p>}
            </div>

            <div>
              <h3
                style={{
                  color: template === 'modern' ? '#667eea' : '#333',
                  marginBottom: '15px',
                  borderBottom: '2px solid',
                  paddingBottom: '5px',
                }}
              >
                Invoice Details:
              </h3>
              <p style={{ margin: '8px 0' }}>
                <strong>Invoice #:</strong> {invoiceData.invoiceNumber}
              </p>
              <p style={{ margin: '8px 0' }}>
                <strong>Date:</strong> {invoiceData.invoiceDate}
              </p>
              {invoiceData.dueDate && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Due Date:</strong> {invoiceData.dueDate}
                </p>
              )}
              {invoiceData.referenceDoctor && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Reference Doctor:</strong> {invoiceData.referenceDoctor}
                </p>
              )}
              {invoiceData.salesperson && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Salesperson:</strong> {invoiceData.salesperson}
                </p>
              )}
              {invoiceData.branch && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Branch:</strong> {invoiceData.branch}
                </p>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '30px 0', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: template === 'modern' ? '#667eea' : '#f5f5f5',
                  color: template === 'modern' ? 'white' : '#333',
                }}
              >
                <th style={{ padding: '15px', textAlign: 'left', border: '1px solid #ddd' }}>Product/Service</th>
                <th style={{ padding: '15px', textAlign: 'left', border: '1px solid #ddd' }}>Serial #</th>
                <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>Qty</th>
                <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>MRP</th>
                <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>Rate</th>
                <th style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>GST%</th>
                <th style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '15px', border: '1px solid #ddd' }}>
                    <strong>{item.name}</strong>
                    {item.description && (
                      <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>{item.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '15px', border: '1px solid #ddd' }}>{item.serialNumber || '—'}</td>
                  <td style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
                  <td style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>
                    {item.mrp ? formatCurrency(item.mrp) : '—'}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(item.rate)}</td>
                  <td style={{ padding: '15px', textAlign: 'center', border: '1px solid #ddd' }}>{item.gstPercent || 0}%</td>
                  <td style={{ padding: '15px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: 'right', marginTop: '30px' }}>
            <div style={{ display: 'inline-block', minWidth: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(invoiceData.subtotal)}</span>
              </div>
              {invoiceData.totalDiscount && invoiceData.totalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <span>Discount:</span>
                  <span>-{formatCurrency(invoiceData.totalDiscount)}</span>
                </div>
              )}
              {invoiceData.totalGST && invoiceData.totalGST > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <span>GST:</span>
                  <span>{formatCurrency(invoiceData.totalGST)}</span>
                </div>
              )}
              <div
                style={{
                  backgroundColor: template === 'modern' ? '#667eea' : '#333',
                  color: 'white',
                  padding: '15px',
                  borderRadius: '5px',
                  marginTop: '10px',
                  fontSize: '1.2em',
                  fontWeight: 'bold',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Grand Total:</span>
                  <span>{formatCurrency(invoiceData.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {(invoiceData.terms || invoiceData.notes) && (
            <div
              style={{
                marginTop: '40px',
                padding: '20px',
                backgroundColor: '#f8f9ff',
                borderRadius: '5px',
                borderLeft: '4px solid ' + (template === 'modern' ? '#667eea' : '#333'),
              }}
            >
              {invoiceData.terms && (
                <>
                  <h3 style={{ marginBottom: '15px', color: template === 'modern' ? '#667eea' : '#333' }}>
                    Terms & Conditions:
                  </h3>
                  <p style={{ marginBottom: '15px' }}>{invoiceData.terms}</p>
                </>
              )}
              {invoiceData.notes && (
                <>
                  <h3 style={{ marginBottom: '15px', color: template === 'modern' ? '#667eea' : '#333' }}>Notes:</h3>
                  <p>{invoiceData.notes}</p>
                </>
              )}
            </div>
          )}

          <div
            style={{
              textAlign: 'center',
              marginTop: '40px',
              paddingTop: '20px',
              borderTop: '2px solid #eee',
              color: '#666',
              fontStyle: 'italic',
            }}
          >
            <p>Thank you for your business!</p>
            <p>This invoice was generated electronically and is valid without signature.</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default InvoicePrintableBody;
