import { adminDb } from '@/server/firebaseAdmin';
import type { HopeAICitation } from '../types';
import { extractQueryTokens, normalizeText, rankCitations, summarizeForCitation } from '../utils';

interface ProductStock {
  productId: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice: number;
  hasSerialNumber: boolean;
  totalInQty: number;
  totalOutQty: number;
  totalSoldQty: number;
  currentStock: number;
  serialsInStock: string[];
}

export async function retrieveProducts(query: string): Promise<{ citations: HopeAICitation[]; exactResults: string[] }> {
  const db = adminDb();
  const tokens = extractQueryTokens(query);

  const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap, salesSnap, enquiriesSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('materialInward').get(),
    db.collection('purchases').get(),
    db.collection('materialsOut').get(),
    db.collection('sales').get(),
    db.collection('enquiries').get(),
  ]);

  const productById = new Map<string, any>();
  productsSnap.docs.forEach(d => productById.set(d.id, { id: d.id, ...d.data() }));

  const serialsInByProduct = new Map<string, Set<string>>();
  const qtyInByProduct = new Map<string, number>();

  const stockTransferInSerials = new Set<string>();
  materialInSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const supplierName = data.supplier?.name || '';
    const isStockTransfer = supplierName.includes('Stock Transfer from');

    (data.products || []).forEach((prod: any) => {
      const productId = prod.productId || prod.id || '';
      if (!productId) return;
      const serialArray: string[] = Array.isArray(prod.serialNumbers)
        ? prod.serialNumbers
        : (prod.serialNumber ? [prod.serialNumber] : []);

      if (isStockTransfer) {
        serialArray.forEach(sn => stockTransferInSerials.add(`${productId}|${sn}`));
        return;
      }

      if (serialArray.length > 0) {
        if (!serialsInByProduct.has(productId)) serialsInByProduct.set(productId, new Set());
        const set = serialsInByProduct.get(productId)!;
        serialArray.forEach(sn => { if (sn) set.add(sn); });
      } else {
        const q = Number(prod.quantity ?? 0);
        qtyInByProduct.set(productId, (qtyInByProduct.get(productId) || 0) + (isNaN(q) ? 0 : q));
      }
    });
  });

  purchasesSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    (data.products || []).forEach((prod: any) => {
      const productId = prod.productId || prod.id || '';
      if (!productId) return;
      const serialArray: string[] = Array.isArray(prod.serialNumbers)
        ? prod.serialNumbers
        : (prod.serialNumber ? [prod.serialNumber] : []);

      if (serialArray.length > 0) {
        if (!serialsInByProduct.has(productId)) serialsInByProduct.set(productId, new Set());
        const set = serialsInByProduct.get(productId)!;
        serialArray.forEach(sn => { if (sn) set.add(sn); });
      } else {
        const q = Number(prod.quantity ?? 0);
        qtyInByProduct.set(productId, (qtyInByProduct.get(productId) || 0) + (isNaN(q) ? 0 : q));
      }
    });
  });

  const serialsOutByProduct = new Map<string, Set<string>>();
  const qtyOutByProduct = new Map<string, number>();

  materialsOutSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const rawStatus = (data.status as string) || '';
    const status = rawStatus || 'dispatched';
    if (status === 'returned') return;

    const notes = data.notes || '';
    const reason = data.reason || '';
    const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');

    (data.products || []).forEach((prod: any) => {
      const productId = prod.productId || prod.id || '';
      if (!productId) return;
      const serialArray: string[] = Array.isArray(prod.serialNumbers)
        ? prod.serialNumbers
        : (prod.serialNumber ? [prod.serialNumber] : []);

      if (serialArray.length > 0) {
        if (!serialsOutByProduct.has(productId)) serialsOutByProduct.set(productId, new Set());
        const set = serialsOutByProduct.get(productId)!;
        serialArray.forEach(sn => {
          if (isStockTransfer && stockTransferInSerials.has(`${productId}|${sn}`)) return;
          if (sn) set.add(sn);
        });
      } else {
        if (isStockTransfer) return;
        const q = Number(prod.quantity ?? 0);
        qtyOutByProduct.set(productId, (qtyOutByProduct.get(productId) || 0) + (isNaN(q) ? 0 : q));
      }
    });
  });

  const soldSerials = new Map<string, Set<string>>();
  const soldQtyByProduct = new Map<string, number>();

  salesSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    (data.products || []).forEach((prod: any) => {
      const productId = prod.productId || prod.id || '';
      if (!productId) return;
      const serialArray: string[] = Array.isArray(prod.serialNumbers)
        ? prod.serialNumbers
        : (prod.serialNumber ? [prod.serialNumber] : []);

      if (serialArray.length > 0) {
        if (!soldSerials.has(productId)) soldSerials.set(productId, new Set());
        const set = soldSerials.get(productId)!;
        serialArray.forEach(sn => { if (sn) set.add(sn); });
      } else {
        const q = Number(prod.quantity ?? 1);
        soldQtyByProduct.set(productId, (soldQtyByProduct.get(productId) || 0) + (isNaN(q) ? 0 : q));
      }
    });
  });

  enquiriesSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const visits = Array.isArray(data.visits) ? data.visits : [];
    visits.forEach((visit: any) => {
      if (visit.hearingAidSale && visit.hearingAidProductId) {
        const productId = visit.hearingAidProductId;
        const sn = visit.trialSerialNumber || '';
        if (sn) {
          if (!soldSerials.has(productId)) soldSerials.set(productId, new Set());
          soldSerials.get(productId)!.add(sn);
        } else {
          soldQtyByProduct.set(productId, (soldQtyByProduct.get(productId) || 0) + 1);
        }
      }
    });
  });

  const stockMap = new Map<string, ProductStock>();

  productById.forEach((product, productId) => {
    const isSerial = !!product.hasSerialNumber;
    const inSerials = serialsInByProduct.get(productId) || new Set<string>();
    const outSerials = serialsOutByProduct.get(productId) || new Set<string>();
    const sold = soldSerials.get(productId) || new Set<string>();

    let currentStock: number;
    let serialsInStock: string[] = [];

    if (isSerial) {
      const available = new Set(inSerials);
      outSerials.forEach(sn => available.delete(sn));
      sold.forEach(sn => available.delete(sn));
      serialsInStock = Array.from(available);
      currentStock = serialsInStock.length;
    } else {
      const totalIn = (qtyInByProduct.get(productId) || 0);
      const totalOut = (qtyOutByProduct.get(productId) || 0) + (soldQtyByProduct.get(productId) || 0);
      currentStock = Math.max(0, totalIn - totalOut);
    }

    stockMap.set(productId, {
      productId,
      name: product.name || '',
      type: product.type || '',
      company: product.company || '',
      mrp: product.mrp || 0,
      dealerPrice: product.dealerPrice || 0,
      hasSerialNumber: isSerial,
      totalInQty: isSerial ? inSerials.size : (qtyInByProduct.get(productId) || 0),
      totalOutQty: isSerial ? (outSerials.size + sold.size) : ((qtyOutByProduct.get(productId) || 0) + (soldQtyByProduct.get(productId) || 0)),
      totalSoldQty: isSerial ? sold.size : (soldQtyByProduct.get(productId) || 0),
      currentStock,
      serialsInStock: serialsInStock.slice(0, 20),
    });
  });

  const citations: HopeAICitation[] = [];

  stockMap.forEach((stock) => {
    const searchText = [
      stock.name,
      stock.type,
      stock.company,
      stock.hasSerialNumber ? 'serial tracked' : '',
      `stock ${stock.currentStock}`,
      ...stock.serialsInStock.slice(0, 5),
    ].filter(Boolean).join(' ').toLowerCase();

    const score = tokens.reduce((sum, token) => sum + (searchText.includes(token.toLowerCase()) ? 1 : 0), 0);
    if (score <= 0) return;

    const snippetParts = [
      `Product: ${stock.name}`,
      stock.type ? `Type: ${stock.type}` : '',
      stock.company ? `Company: ${stock.company}` : '',
      `Current Stock: ${stock.currentStock} units`,
      `Total Received: ${stock.totalInQty}`,
      `Total Out/Sold: ${stock.totalOutQty} (Sold: ${stock.totalSoldQty})`,
      stock.mrp ? `MRP: ₹${stock.mrp}` : '',
      stock.dealerPrice ? `Dealer Price: ₹${stock.dealerPrice}` : '',
      stock.hasSerialNumber ? 'Serial Number Tracked: Yes' : '',
      stock.serialsInStock.length ? `Available Serials: ${stock.serialsInStock.slice(0, 10).join(', ')}${stock.serialsInStock.length > 10 ? ` (+${stock.serialsInStock.length - 10} more)` : ''}` : '',
    ].filter(Boolean);

    citations.push({
      id: `product-${stock.productId}`,
      domain: 'products',
      entityType: 'product',
      entityId: stock.productId,
      title: stock.name || 'Unnamed product',
      snippet: summarizeForCitation(snippetParts.join('\n'), 800),
      sourcePath: `/products#id=${stock.productId}`,
      metadata: {
        name: stock.name,
        type: stock.type,
        company: stock.company,
        mrp: stock.mrp,
        dealerPrice: stock.dealerPrice,
        hasSerialNumber: stock.hasSerialNumber,
        currentStock: stock.currentStock,
        totalReceived: stock.totalInQty,
        totalOut: stock.totalOutQty,
        totalSold: stock.totalSoldQty,
        serialsInStock: stock.serialsInStock.length,
      },
      score,
    });
  });

  const ranked = rankCitations(query, citations, 10);

  const exactResults = ranked.map(citation => {
    const m = citation.metadata || {};
    const parts = [
      `${m.name}: Current Stock = ${m.currentStock} units`,
      m.type ? `Type: ${m.type}` : '',
      m.company ? `Company: ${m.company}` : '',
      `Received: ${m.totalReceived}, Out/Sold: ${m.totalOut} (Sold: ${m.totalSold})`,
      m.mrp ? `MRP: ₹${m.mrp}` : '',
      m.hasSerialNumber ? `Serials in stock: ${m.serialsInStock}` : '',
    ].filter(Boolean);
    return parts.join(', ');
  });

  return { citations: ranked, exactResults };
}
