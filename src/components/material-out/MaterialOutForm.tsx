'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Tooltip,
  Card,
  CardContent,
  LinearProgress,
  TableFooter,
  Stack,
} from '@mui/material';
import { Grid as MuiGrid } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Info as InfoIcon,
  CurrencyRupee as RupeeIcon,
  Receipt as ReceiptIcon,
  BusinessCenter as BusinessIcon,
  DateRange as DateRangeIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  QrCode as BarcodeIcon,
  Calculate as CalculateIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Summarize as SummarizeIcon,
} from '@mui/icons-material';

const Grid = MuiGrid;

interface Product { id: string; name: string; type: string; company: string; mrp: number; dealerPrice?: number; gstApplicable?: boolean; quantityType?: 'piece' | 'pair'; hasSerialNumber?: boolean; }
interface Party { id: string; name: string; category?: string; gstType?: string; phone?: string; email?: string; address?: string; }
interface MaterialProduct { productId: string; name: string; type: string; serialNumbers: string[]; quantity: number; dealerPrice?: number; mrp?: number; discountPercent?: number; discountAmount?: number; finalPrice?: number; gstApplicable?: boolean; remarks?: string; quantityType?: 'piece' | 'pair'; condition?: string; }
interface MaterialOutward { id?: string; challanNumber: string; recipient: { id: string; name: string; }; reason?: string; company: string; products: MaterialProduct[]; totalAmount: number; dispatchDate: Timestamp; notes?: string; createdAt?: Timestamp; updatedAt?: Timestamp; }
interface AvailableItem { productId: string; name: string; type?: string; serialNumber?: string; isSerialTracked?: boolean; quantity?: number; }

interface Props {
  initialData?: MaterialOutward;
  products: Product[];
  parties: Party[];
  availableItems?: AvailableItem[];
  onSave: (material: MaterialOutward) => void;
  onCancel: () => void;
}

const steps = ['Challan Details', 'Product Details', 'Review & Summary'];

const MaterialOutForm: React.FC<Props> = ({ initialData, products, parties, availableItems = [], onSave, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [materialData, setMaterialData] = useState<MaterialOutward>(
    initialData || {
      challanNumber: '',
      recipient: { id: '', name: '' },
      reason: '',
      company: 'Hope Enterprises',
      products: [],
      totalAmount: 0,
      dispatchDate: Timestamp.now(),
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [dealerPrice, setDealerPrice] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const [availableSerials, setAvailableSerials] = useState<string[]>([]);
  const [availableQty, setAvailableQty] = useState<number>(0);

  useEffect(() => { setFilteredProducts(products); }, [products]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const calculateDiscount = (price: number, percent: number) => (price * percent) / 100;
  const calculateFinalPrice = (price: number, percent: number) => price - calculateDiscount(price, percent);

  const handleNext = () => {
    const stepErrors: Record<string, string> = {};
    if (activeStep === 0) {
      if (!materialData.challanNumber.trim()) stepErrors.challanNumber = 'Challan number is required';
      if (!materialData.recipient.id && !materialData.recipient.name) stepErrors.recipient = 'Recipient is required';
    } else if (activeStep === 1) {
      if (materialData.products.length === 0) stepErrors.products = 'At least one product is required';
    }
    if (Object.keys(stepErrors).length) { setErrors(stepErrors); return; }
    setErrors({});
    setActiveStep(s => s + 1);
  };
  const handleBack = () => { setActiveStep(s => s - 1); setErrors({}); };
  const update = (patch: Partial<MaterialOutward>) => setMaterialData(prev => ({ ...prev, ...patch }));

  const handleRecipientChange = (party: Party | null) => {
    if (party) update({ recipient: { id: party.id, name: party.name } });
  };

  const handleFilterByType = (type: string | null) => {
    setSelectedProductType(type);
    setFilteredProducts(type ? products.filter(p => p.type === type) : products);
    setCurrentProduct(null); setDealerPrice(0); setMrp(0); setSerialNumbers([]); setQuantity(1);
  };

  const handleProductSelect = (product: Product | null) => {
    const fullProduct = product ? (products.find(p => p.id === product.id) || product) : null;
    setCurrentProduct(fullProduct);

    if (fullProduct) {
      setMrp(fullProduct.mrp || 0);
      setDealerPrice(fullProduct.dealerPrice || 0);
      setSerialNumbers([]);
      setSerialNumber('');
      setQuantity(1);
    } else {
      setMrp(0);
      setDealerPrice(0);
      setSerialNumbers([]);
      setSerialNumber('');
      setQuantity(1);
    }

    // compute available serials and quantity from inventory for selected product
    if (fullProduct) {
      const serials = availableItems
        .filter(i => i.productId === fullProduct.id && i.isSerialTracked && i.serialNumber)
        .map(i => i.serialNumber!);
      setAvailableSerials(serials);
      const qty = availableItems
        .filter(i => i.productId === fullProduct.id && !i.isSerialTracked)
        .reduce((s, i) => s + (i.quantity || 0), 0);
      setAvailableQty(qty);
    } else {
      setAvailableSerials([]);
      setAvailableQty(0);
    }
  };

  const isSerialRequiredForCurrent = useMemo(() => {
    if (!currentProduct) return false;
    return !!currentProduct.hasSerialNumber || availableSerials.length > 0;
  }, [currentProduct, availableSerials.length]);

  const addManualSerials = () => {
    if (!serialNumber.trim()) return;
    const parts = serialNumber
      .split(/[\n,; ]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...serialNumbers, ...parts]));
    setSerialNumbers(next);
    setSerialNumber('');
    setQuantity(next.length);
    setErrors(prev => {
      const out = { ...prev };
      delete out.serialNumbers;
      return out;
    });
  };

  const addProduct = () => {
    if (!currentProduct) { setErrors({ product: 'Please select a product' }); return; }
    const isSerialTracked = isSerialRequiredForCurrent;
    if (isSerialTracked && serialNumbers.length === 0) { setErrors({ serialNumbers: 'Serial numbers are required for this product' }); return; }
    if (!isSerialTracked && quantity <= 0) { setErrors({ quantity: 'Quantity must be greater than 0' }); return; }
    if (isSerialTracked && quantity !== serialNumbers.length) { setErrors({ serialNumbers: `Serials (${serialNumbers.length}) do not match qty (${quantity})` }); return; }
    if (!isSerialTracked && availableQty > 0 && quantity > availableQty) { setErrors({ quantity: `Only ${availableQty} available in inventory` }); return; }

    const finalPrice = calculateFinalPrice(dealerPrice, discountPercent);
    const newProduct: MaterialProduct = { productId: currentProduct.id, name: currentProduct.name, type: currentProduct.type, serialNumbers: [...serialNumbers], quantity, dealerPrice, mrp, discountPercent, discountAmount: calculateDiscount(dealerPrice, discountPercent), finalPrice, quantityType: currentProduct.quantityType || 'piece', gstApplicable: currentProduct.gstApplicable, remarks };
    const existingIndex = materialData.products.findIndex(p => p.productId === currentProduct.id);
    if (existingIndex >= 0) {
      const updated = [...materialData.products];
      updated[existingIndex].quantity += quantity;
      updated[existingIndex].serialNumbers = [...updated[existingIndex].serialNumbers, ...serialNumbers];
      const total = updated.reduce((s, p) => s + ((p.finalPrice || p.dealerPrice || 0) * p.quantity), 0);
      update({ products: updated, totalAmount: total });
    } else {
      const updated = [...materialData.products, newProduct];
      const total = updated.reduce((s, p) => s + ((p.finalPrice || p.dealerPrice || 0) * p.quantity), 0);
      update({ products: updated, totalAmount: total });
    }
    setCurrentProduct(null); setSerialNumbers([]); setSerialNumber(''); setQuantity(1); setDealerPrice(0); setMrp(0); setDiscountPercent(0); setRemarks(''); setErrors({});
  };

  const removeProduct = (idx: number) => {
    const updated = materialData.products.filter((_, i) => i !== idx);
    const total = updated.reduce((s, p) => s + ((p.finalPrice || p.dealerPrice || 0) * p.quantity), 0);
    update({ products: updated, totalAmount: total });
  };

  const handleSubmit = () => {
    if (materialData.products.length === 0) { setErrors({ products: 'At least one product is required' }); return; }
    // sanitize document to avoid undefineds for Firestore
    const pruneUndefined = (value: any): any => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (Array.isArray(value)) return value.map(pruneUndefined);
      if (value && typeof value === 'object') {
        const out: any = {};
        Object.entries(value).forEach(([k, v]) => {
          const pruned = pruneUndefined(v);
          if (pruned !== undefined) out[k] = pruned;
        });
        return out;
      }
      return value;
    };
    const sanitized = pruneUndefined(materialData);
    onSave(sanitized);
  };

  const renderChallanDetails = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={600} color="primary">Challan Information</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <TextField label="Challan Number" fullWidth value={materialData.challanNumber} onChange={e => update({ challanNumber: e.target.value })} error={!!errors.challanNumber} helperText={errors.challanNumber} required size="medium" InputProps={{ startAdornment: <InputAdornment position="start"><ReceiptIcon fontSize="small" color="action" /></InputAdornment> }} />
          
          <TextField
            label="Recipient (Who are we giving it to)"
            fullWidth
            size="medium"
            value={materialData.recipient?.name || ''}
            onChange={(e) => update({ recipient: { id: '', name: e.target.value } })}
            InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon fontSize="small" color="action" /></InputAdornment> }}
            required
          />
          <TextField label="Reason" value={materialData.reason || ''} onChange={e => update({ reason: e.target.value })} fullWidth size="medium" />
          <FormControl fullWidth size="medium">
            <InputLabel>Company Billed To</InputLabel>
            <Select value={materialData.company} label="Company Billed To" onChange={e => update({ company: e.target.value })} startAdornment={<InputAdornment position="start"><BusinessIcon fontSize="small" color="action" /></InputAdornment>}>
              {['Hope Enterprises','HDIPL'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="Dispatch Date" value={materialData.dispatchDate instanceof Date ? materialData.dispatchDate as any : new Date(materialData.dispatchDate.seconds*1000)} onChange={d => d && update({ dispatchDate: Timestamp.fromDate(d) })} slotProps={{ textField: { fullWidth: true, size: 'medium', required: true, InputProps: { startAdornment: <InputAdornment position='start'><DateRangeIcon fontSize='small' color='action' /></InputAdornment> } } }} />
          </LocalizationProvider>
          <TextField label="Notes" value={(materialData as any).notes || ''} onChange={e => update({ notes: e.target.value } as any)} fullWidth multiline rows={3} size="medium" InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}><InfoIcon fontSize="small" color="action" /></InputAdornment> }} />
        </Box>
      </Paper>
    </Box>
  );

  const renderProductDetails = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <AddIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="h6" fontWeight={600} color="primary">Add Product to Material</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
              <FilterListIcon fontSize="small" sx={{ mr: 0.5 }} /> Quick Filter:
            </Typography>
            {['Hearing Aid','Battery','Accessory','Charger','Remote Control','Cleaning Kit','Other'].map(t => (
              <Chip key={t} label={t} onClick={() => handleFilterByType(t)} color={selectedProductType === t ? 'primary' : 'default'} variant={selectedProductType === t ? 'filled' : 'outlined'} size="small" sx={{ borderRadius: 1 }} />
            ))}
            {selectedProductType && <Chip label="Clear Filter" onClick={() => handleFilterByType(null)} variant="outlined" size="small" color="secondary" sx={{ borderRadius: 1 }} />}
          </Box>
          <Box>
            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Step 1: Select Product (from Inventory)</Typography>
              <Autocomplete
                options={Array.from(new Map(availableItems.map(i => [i.productId, { id: i.productId, name: i.name, type: i.type || '' }])).values()) as any}
                getOptionLabel={(o: any) => `${o.name}${o.type ? ` (${o.type})` : ''}`}
                isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
                groupBy={(o: any) => (availableItems.find(i => i.productId === o.id && i.isSerialTracked) ? 'Serial-tracked' : 'Non-serial')}
                value={currentProduct ? { id: currentProduct.id, name: currentProduct.name, type: currentProduct.type } as any : null}
                onChange={(_, v: any) => {
                  const product: Product | null = v ? { id: v.id, name: v.name, type: v.type || '', company: '', mrp: 0 } : null;
                  handleProductSelect(product);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Product"
                    size="medium"
                    fullWidth
                    error={!!errors.product}
                    helperText={errors.product}
                    placeholder="Type to search by name (showing only in-stock items)"
                    InputProps={{ ...params.InputProps, startAdornment: (<><InputAdornment position='start'><SearchIcon color='action' /></InputAdornment>{params.InputProps.startAdornment}</>) }}
                  />
                )}
              />
            </Box>
          </Box>
          {currentProduct && (
            <>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'primary.light', borderRadius: 2, bgcolor: 'primary.lighter', mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight="medium" color="primary.dark">{currentProduct.name}</Typography>
                  <Chip label={currentProduct.type} size="small" color="primary" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {currentProduct.company} {currentProduct.type === 'Hearing Aid' && ` • ${currentProduct.quantityType === 'pair' ? 'Sold in pairs' : 'Sold individually'}`}
                </Typography>
                <Box display="flex" justifyContent="space-between" mt={1}>
                  <Typography variant="body2"><strong>MRP:</strong> {formatCurrency(currentProduct.mrp)}</Typography>
                  {currentProduct.dealerPrice && (<Typography variant="body2"><strong>Dealer Price:</strong> {formatCurrency(currentProduct.dealerPrice)}</Typography>)}
                </Box>
              </Paper>
              <Box>
                <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <CalculateIcon fontSize="small" sx={{ mr: 1 }} /> Step 2: {isSerialRequiredForCurrent ? 'Serial Numbers' : 'Enter Quantity'}
                  </Typography>
                  {isSerialRequiredForCurrent ? (
                    <>
                      {availableSerials.length > 0 ? (
                    <Autocomplete
                      multiple
                      options={availableSerials}
                      value={serialNumbers}
                      onChange={(_, vals) => { setSerialNumbers(vals); setQuantity(vals.length || 0); setErrors({}); }}
                      renderInput={(params) => <TextField {...params} label={`Select available serials (${availableSerials.length} available)`} placeholder="Type to search serials" />}
                    />
                      ) : (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <TextField
                            label="Enter serial numbers"
                            value={serialNumber}
                            onChange={(e) => setSerialNumber(e.target.value)}
                            placeholder="Type serials (comma/space separated) and click Add"
                            error={!!errors.serialNumbers}
                            helperText={errors.serialNumbers || 'Example: SN001, SN002'}
                            fullWidth
                          />
                          <Button variant="outlined" onClick={addManualSerials} sx={{ mt: { xs: 1, sm: 0 } }}>
                            Add
                          </Button>
                          {serialNumbers.length > 0 && (
                            <Box sx={{ width: '100%' }}>
                              <Typography variant="caption" color="text.secondary">
                                Selected: {serialNumbers.length}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                {serialNumbers.map((sn) => (
                                  <Chip
                                    key={sn}
                                    label={sn}
                                    size="small"
                                    onDelete={() => {
                                      const next = serialNumbers.filter(s => s !== sn);
                                      setSerialNumbers(next);
                                      setQuantity(next.length);
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}
                    </>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label={`Quantity${Number.isFinite(availableQty) ? ` (Available: ${availableQty})` : ''}`}
                        fullWidth
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value) || 0;
                          const capped = availableQty ? Math.min(raw, availableQty) : raw;
                          setQuantity(Math.max(0, capped));
                          setErrors({});
                        }}
                        error={!!errors.quantity}
                        helperText={errors.quantity}
                        InputProps={{ inputProps: { min: 0, max: availableQty || undefined } }}
                        size="medium"
                      />
                      <TextField label="Remarks" fullWidth value={remarks} onChange={e => setRemarks(e.target.value)} size="medium" />
                    </Box>
                  )}
                </Box>
              </Box>
              {/* Serial selection handled above when inventory provides serials */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={addProduct} disabled={!currentProduct}>Add to Material</Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
        <Box display="flex" alignItems="center" mb={2}>
          <SummarizeIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={600} color="primary">Added Products</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        {materialData.products.length === 0 ? (
          <Alert severity="info">No products added yet. Add products using the form above.</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="center">Quantity</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {materialData.products.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{p.name}</Typography>
                        {p.serialNumbers.length > 0 && (
                          <Typography variant="caption" color="text.secondary">{p.serialNumbers.length} serial(s)</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">{p.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency((p.finalPrice || p.dealerPrice || 0) * p.quantity)}</TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeProduct(idx)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} align="right"><Typography variant="subtitle1">Total Amount:</Typography></TableCell>
                  <TableCell align="right"><Typography variant="subtitle1">{formatCurrency(materialData.totalAmount)}</Typography></TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      {/* Navigation moved to bottom of component */}
    </Box>
  );

  return (
    <Box>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>
      <Box sx={{ mb: 4 }}>
        {activeStep === 0 && renderChallanDetails()}
        {activeStep === 1 && renderProductDetails()}
        {activeStep === 2 && (
          <Box>
            <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>Challan Summary</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Typography variant="body2">Challan #: <strong>{materialData.challanNumber}</strong></Typography>
                
                <Typography variant="body2">Recipient: <strong>{materialData.recipient?.name || '-'}</strong></Typography>
                <Typography variant="body2">Company: <strong>{materialData.company}</strong></Typography>
                <Typography variant="body2">Dispatch Date: <strong>{new Date((materialData.dispatchDate as any).seconds ? materialData.dispatchDate.seconds * 1000 : materialData.dispatchDate).toLocaleDateString('en-IN')}</strong></Typography>
                {materialData.reason ? (<Typography variant="body2">Reason: <strong>{materialData.reason}</strong></Typography>) : null}
                {((materialData as any).notes) ? (<Typography variant="body2" sx={{ gridColumn: '1 / -1' }}>Notes: <strong>{(materialData as any).notes}</strong></Typography>) : null}
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>Products</Typography>
              <Divider sx={{ mb: 2 }} />
              {materialData.products.length === 0 ? (
                <Alert severity="info">No products added</Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Serials</TableCell>
                        <TableCell align="center">Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Final</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {materialData.products.map((p, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.type}</TableCell>
                          <TableCell>{p.serialNumbers && p.serialNumbers.length ? p.serialNumbers.join(', ') : '-'}</TableCell>
                          <TableCell align="center">{p.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(p.dealerPrice || 0)}</TableCell>
                          <TableCell align="right">{p.discountPercent ? `${p.discountPercent}%` : '-'}</TableCell>
                          <TableCell align="right">{formatCurrency(p.finalPrice || p.dealerPrice || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency((p.finalPrice || p.dealerPrice || 0) * p.quantity)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={7} align="right"><Typography variant="subtitle1">Total Amount:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="subtitle1">{formatCurrency(materialData.totalAmount)}</Typography></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
        <Button variant="outlined" disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>Back</Button>
        <Box>
          <Button variant="outlined" onClick={onCancel} sx={{ mr: 1 }}>Cancel</Button>
          {activeStep === steps.length - 1 ? (
            <Button variant="contained" color="primary" onClick={handleSubmit} startIcon={<ReceiptIcon />}>Submit</Button>
          ) : (
            <Button variant="contained" color="primary" onClick={handleNext}>Next</Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default MaterialOutForm;


