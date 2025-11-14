// Invoice Service - Unified API for multiple invoice providers
import { InvoiceData } from '@/components/invoices/InvoiceTemplate';

// Base interfaces
export interface InvoiceProvider {
  id: string;
  name: string;
  createInvoice(data: InvoiceData): Promise<InvoiceResponse>;
  getInvoice(id: string): Promise<InvoiceResponse>;
  updateInvoice(id: string, data: Partial<InvoiceData>): Promise<InvoiceResponse>;
  deleteInvoice(id: string): Promise<boolean>;
  sendInvoice(id: string, email: string): Promise<boolean>;
  getInvoices(params?: InvoiceListParams): Promise<InvoiceListResponse>;
}

export interface InvoiceResponse {
  id: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string;
  publicUrl?: string;
  paymentUrl?: string;
  provider: string;
  rawData?: any;
}

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Invoice Ninja Provider
class InvoiceNinjaProvider implements InvoiceProvider {
  id = 'invoiceninja';
  name = 'Invoice Ninja';
  
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/v1/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-TOKEN': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Invoice Ninja API error: ${response.statusText}`);
    }

    return response.json();
  }

  async createInvoice(data: InvoiceData): Promise<InvoiceResponse> {
    const invoiceData = {
      client: {
        name: data.customerName,
        email: data.customerEmail,
        address1: data.customerAddress,
        phone: data.customerPhone,
      },
      invoice_items: data.items.map(item => ({
        product_key: item.id,
        notes: item.name,
        cost: item.rate,
        qty: item.quantity,
        tax_rate1: item.gstPercent || 0,
      })),
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      due_date: data.dueDate,
      terms: data.terms,
      public_notes: data.notes,
    };

    const response = await this.makeRequest('invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });

    return this.transformInvoiceResponse(response.data);
  }

  async getInvoice(id: string): Promise<InvoiceResponse> {
    const response = await this.makeRequest(`invoices/${id}`);
    return this.transformInvoiceResponse(response.data);
  }

  async updateInvoice(id: string, data: Partial<InvoiceData>): Promise<InvoiceResponse> {
    const response = await this.makeRequest(`invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.transformInvoiceResponse(response.data);
  }

  async deleteInvoice(id: string): Promise<boolean> {
    await this.makeRequest(`invoices/${id}`, { method: 'DELETE' });
    return true;
  }

  async sendInvoice(id: string, email: string): Promise<boolean> {
    await this.makeRequest(`invoices/${id}/email`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return true;
  }

  async getInvoices(params: InvoiceListParams = {}): Promise<InvoiceListResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('per_page', params.limit.toString());
    if (params.status) queryParams.set('status', params.status);

    const response = await this.makeRequest(`invoices?${queryParams.toString()}`);
    
    return {
      invoices: response.data.map((invoice: any) => this.transformInvoiceResponse(invoice)),
      total: response.meta.pagination.total,
      page: response.meta.pagination.current_page,
      limit: response.meta.pagination.per_page,
      hasMore: response.meta.pagination.current_page < response.meta.pagination.last_page,
    };
  }

  private transformInvoiceResponse(data: any): InvoiceResponse {
    return {
      id: data.id,
      status: this.mapStatus(data.status_id),
      invoiceNumber: data.number,
      amount: parseFloat(data.amount),
      currency: data.client.currency.code,
      dueDate: data.due_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pdfUrl: data.pdf_url,
      publicUrl: data.public_url,
      provider: this.id,
      rawData: data,
    };
  }

  private mapStatus(statusId: number): InvoiceResponse['status'] {
    const statusMap: Record<number, InvoiceResponse['status']> = {
      1: 'draft',
      2: 'sent',
      3: 'sent',
      4: 'paid',
      5: 'overdue',
      6: 'cancelled',
    };
    return statusMap[statusId] || 'draft';
  }
}

// QuickBooks Provider
class QuickBooksProvider implements InvoiceProvider {
  id = 'quickbooks';
  name = 'QuickBooks Online';
  
  private accessToken: string;
  private companyId: string;
  private baseUrl = 'https://sandbox-quickbooks.api.intuit.com';

  constructor(config: { accessToken: string; companyId: string; sandbox?: boolean }) {
    this.accessToken = config.accessToken;
    this.companyId = config.companyId;
    if (!config.sandbox) {
      this.baseUrl = 'https://quickbooks.api.intuit.com';
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/v3/company/${this.companyId}/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.statusText}`);
    }

    return response.json();
  }

  async createInvoice(data: InvoiceData): Promise<InvoiceResponse> {
    // First, create or get customer
    const customer = await this.createOrGetCustomer(data);
    
    const invoiceData = {
      Line: data.items.map((item, index) => ({
        Id: (index + 1).toString(),
        LineNum: index + 1,
        Amount: item.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: {
            value: '1', // Default item - you might want to create items first
            name: item.name,
          },
          UnitPrice: item.rate,
          Qty: item.quantity,
        },
      })),
      CustomerRef: {
        value: customer.Id,
      },
      DocNumber: data.invoiceNumber,
      TxnDate: data.invoiceDate,
      DueDate: data.dueDate,
      PrivateNote: data.notes,
      CustomerMemo: {
        value: data.terms,
      },
    };

    const response = await this.makeRequest('invoice', {
      method: 'POST',
      body: JSON.stringify({ Invoice: invoiceData }),
    });

    return this.transformInvoiceResponse(response.QueryResponse.Invoice[0]);
  }

  async getInvoice(id: string): Promise<InvoiceResponse> {
    const response = await this.makeRequest(`invoice/${id}`);
    return this.transformInvoiceResponse(response.QueryResponse.Invoice[0]);
  }

  async updateInvoice(id: string, data: Partial<InvoiceData>): Promise<InvoiceResponse> {
    // QuickBooks requires full object for updates
    const existing = await this.getInvoice(id);
    const response = await this.makeRequest('invoice', {
      method: 'POST',
      body: JSON.stringify({ Invoice: { ...existing.rawData, ...data } }),
    });
    return this.transformInvoiceResponse(response.QueryResponse.Invoice[0]);
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const invoice = await this.getInvoice(id);
    await this.makeRequest('invoice', {
      method: 'POST',
      body: JSON.stringify({
        Invoice: {
          ...invoice.rawData,
          Active: false,
        },
      }),
    });
    return true;
  }

  async sendInvoice(id: string, email: string): Promise<boolean> {
    await this.makeRequest(`invoice/${id}/send?sendTo=${email}`, {
      method: 'POST',
    });
    return true;
  }

  async getInvoices(params: InvoiceListParams = {}): Promise<InvoiceListResponse> {
    let query = "SELECT * FROM Invoice";
    if (params.status) {
      query += ` WHERE EmailStatus = '${params.status}'`;
    }
    if (params.limit) {
      query += ` MAXRESULTS ${params.limit}`;
    }

    const response = await this.makeRequest(`query?query=${encodeURIComponent(query)}`);
    
    const invoices = response.QueryResponse?.Invoice || [];
    
    return {
      invoices: invoices.map((invoice: any) => this.transformInvoiceResponse(invoice)),
      total: invoices.length,
      page: params.page || 1,
      limit: params.limit || 20,
      hasMore: false, // QuickBooks doesn't provide pagination info easily
    };
  }

  private async createOrGetCustomer(data: InvoiceData) {
    // Try to find existing customer
    const query = `SELECT * FROM Customer WHERE Name = '${data.customerName}'`;
    const response = await this.makeRequest(`query?query=${encodeURIComponent(query)}`);
    
    if (response.QueryResponse?.Customer?.length > 0) {
      return response.QueryResponse.Customer[0];
    }

    // Create new customer
    const customerData = {
      Name: data.customerName,
      CompanyName: data.customerName,
      BillAddr: {
        Line1: data.customerAddress,
      },
      PrimaryPhone: {
        FreeFormNumber: data.customerPhone,
      },
      PrimaryEmailAddr: {
        Address: data.customerEmail,
      },
    };

    const createResponse = await this.makeRequest('customer', {
      method: 'POST',
      body: JSON.stringify({ Customer: customerData }),
    });

    return createResponse.QueryResponse.Customer[0];
  }

  private transformInvoiceResponse(data: any): InvoiceResponse {
    return {
      id: data.Id,
      status: this.mapStatus(data.EmailStatus),
      invoiceNumber: data.DocNumber,
      amount: parseFloat(data.TotalAmt),
      currency: 'USD', // QuickBooks default
      dueDate: data.DueDate,
      createdAt: data.MetaData.CreateTime,
      updatedAt: data.MetaData.LastUpdatedTime,
      provider: this.id,
      rawData: data,
    };
  }

  private mapStatus(emailStatus: string): InvoiceResponse['status'] {
    const statusMap: Record<string, InvoiceResponse['status']> = {
      'NotSet': 'draft',
      'NeedToSend': 'draft',
      'EmailSent': 'sent',
      'Paid': 'paid',
    };
    return statusMap[emailStatus] || 'draft';
  }
}

// Main Invoice Service
class InvoiceService {
  private providers: Map<string, InvoiceProvider> = new Map();
  private defaultProvider: string | null = null;

  registerProvider(provider: InvoiceProvider) {
    this.providers.set(provider.id, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = provider.id;
    }
  }

  setDefaultProvider(providerId: string) {
    if (this.providers.has(providerId)) {
      this.defaultProvider = providerId;
    } else {
      throw new Error(`Provider ${providerId} not found`);
    }
  }

  getProvider(providerId?: string): InvoiceProvider {
    const id = providerId || this.defaultProvider;
    if (!id || !this.providers.has(id)) {
      throw new Error(`Provider ${id} not found or no default provider set`);
    }
    return this.providers.get(id)!;
  }

  async createInvoice(data: InvoiceData, providerId?: string): Promise<InvoiceResponse> {
    const provider = this.getProvider(providerId);
    return provider.createInvoice(data);
  }

  async getInvoice(id: string, providerId?: string): Promise<InvoiceResponse> {
    const provider = this.getProvider(providerId);
    return provider.getInvoice(id);
  }

  async updateInvoice(id: string, data: Partial<InvoiceData>, providerId?: string): Promise<InvoiceResponse> {
    const provider = this.getProvider(providerId);
    return provider.updateInvoice(id, data);
  }

  async deleteInvoice(id: string, providerId?: string): Promise<boolean> {
    const provider = this.getProvider(providerId);
    return provider.deleteInvoice(id);
  }

  async sendInvoice(id: string, email: string, providerId?: string): Promise<boolean> {
    const provider = this.getProvider(providerId);
    return provider.sendInvoice(id, email);
  }

  async getInvoices(params?: InvoiceListParams, providerId?: string): Promise<InvoiceListResponse> {
    const provider = this.getProvider(providerId);
    return provider.getInvoices(params);
  }

  getAvailableProviders(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
    }));
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();

// Export provider classes for manual instantiation
export { InvoiceNinjaProvider, QuickBooksProvider };

// Utility functions
export const initializeInvoiceProviders = (configs: Record<string, any>) => {
  // Initialize Invoice Ninja
  if (configs.invoiceninja?.apiKey) {
    const provider = new InvoiceNinjaProvider({
      apiKey: configs.invoiceninja.apiKey,
      baseUrl: configs.invoiceninja.baseUrl || 'https://app.invoiceninja.com',
    });
    invoiceService.registerProvider(provider);
  }

  // Initialize QuickBooks
  if (configs.quickbooks?.accessToken) {
    const provider = new QuickBooksProvider({
      accessToken: configs.quickbooks.accessToken,
      companyId: configs.quickbooks.companyId,
      sandbox: configs.quickbooks.sandbox,
    });
    invoiceService.registerProvider(provider);
  }

  // Set default provider
  if (configs.defaultProvider) {
    invoiceService.setDefaultProvider(configs.defaultProvider);
  }
};

// Helper function to convert sale data to InvoiceData
export const convertSaleToInvoiceData = (sale: any): InvoiceData => {
  return {
    companyName: 'Hope Hearing Solutions',
    companyAddress: 'Your Company Address\nCity, State - PIN Code',
    companyPhone: '+91 XXXXX XXXXX',
    companyEmail: 'info@hopehearing.com',
    companyGST: 'GST Number Here',
    
    invoiceNumber: sale.invoiceNumber || `INV-${Date.now()}`,
    invoiceDate: sale.saleDate?.toDate ? 
      sale.saleDate.toDate().toLocaleDateString('en-IN') : 
      new Date().toLocaleDateString('en-IN'),
    
    customerName: sale.patientName || 'Walk-in Customer',
    customerAddress: sale.address || '',
    customerPhone: sale.phone || '',
    customerEmail: sale.email || '',
    
    items: sale.products?.map((product: any, index: number) => ({
      id: product.id || `item-${index}`,
      name: product.name || 'Unknown Product',
      description: product.type || '',
      serialNumber: product.serialNumber || '',
      quantity: product.quantity || 1,
      rate: product.sellingPrice || product.finalAmount || 0,
      mrp: product.mrp || 0,
      discount: product.discount || 0,
      gstPercent: product.gstPercent || sale.gstPercentage || 0,
      amount: (product.sellingPrice || product.finalAmount || 0) * (product.quantity || 1),
    })) || [],
    
    subtotal: sale.products?.reduce((sum: number, product: any) => {
      return sum + (product.sellingPrice || product.finalAmount || 0) * (product.quantity || 1);
    }, 0) || 0,
    totalGST: sale.gstAmount || 0,
    grandTotal: sale.totalAmount || 0,
    
    referenceDoctor: sale.referenceDoctor?.name || '',
    salesperson: sale.salesperson?.name || '',
    branch: sale.branch || '',
    paymentMethod: sale.paymentMethod || '',
    notes: sale.notes || '',
    terms: 'Payment is due within 30 days of invoice date.',
  };
};
