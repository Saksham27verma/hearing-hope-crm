'use client';

import React, { useState, useRef, ChangeEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Divider,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
} from '@mui/material';
import {
  Code as CodeIcon,
  Image as ImageIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  InsertPhoto as InsertPhotoIcon,
} from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';

interface HTMLTemplateCreatorProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: HTMLTemplateData) => void;
  initialTemplate?: HTMLTemplateData;
}

interface UploadedImage {
  id: string;
  name: string;
  url: string;
  type: 'logo' | 'signature' | 'custom';
  placeholder: string;
}

export interface HTMLTemplateData {
  name: string;
  description: string;
  htmlContent: string;
  images: UploadedImage[];
  category: 'business' | 'medical' | 'retail' | 'service' | 'custom';
}

const HTMLTemplateCreator: React.FC<HTMLTemplateCreatorProps> = ({
  open,
  onClose,
  onSave,
  initialTemplate,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [templateDescription, setTemplateDescription] = useState(initialTemplate?.description || '');
  const [htmlContent, setHtmlContent] = useState(initialTemplate?.htmlContent || '');
  const [images, setImages] = useState<UploadedImage[]>(initialTemplate?.images || []);
  const [category, setCategory] = useState<HTMLTemplateData['category']>(initialTemplate?.category || 'custom');
  const [uploading, setUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample HTML template for users to start with
  const sampleTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563EB;
      padding-bottom: 20px;
    }
    .logo {
      max-width: 200px;
      max-height: 80px;
    }
    .company-info {
      text-align: right;
    }
    .invoice-title {
      font-size: 32px;
      font-weight: bold;
      color: #2563EB;
      margin: 20px 0;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin: 30px 0;
    }
    .info-box {
      width: 48%;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      margin-bottom: 5px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    .items-table th {
      background-color: #2563EB;
      color: white;
      padding: 12px;
      text-align: left;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #ddd;
    }
    .items-table tr:hover {
      background-color: #f9f9f9;
    }
    .totals {
      text-align: right;
      margin-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      margin: 8px 0;
      font-size: 16px;
    }
    .total-label {
      width: 150px;
      font-weight: bold;
    }
    .total-value {
      width: 120px;
      text-align: right;
    }
    .grand-total {
      font-size: 20px;
      color: #2563EB;
      border-top: 2px solid #2563EB;
      padding-top: 10px;
      margin-top: 10px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
    }
    .signature {
      max-width: 200px;
      margin: 20px auto;
    }
    .terms {
      font-size: 12px;
      color: #666;
      margin-top: 20px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header with Logo -->
    <div class="header">
      <div>
        <img src="{{LOGO_PLACEHOLDER}}" alt="Company Logo" class="logo">
      </div>
      <div class="company-info">
        <h3>Your Company Name</h3>
        <p>123 Business Street<br>City, State 12345<br>Phone: (123) 456-7890<br>Email: info@company.com</p>
      </div>
    </div>

    <!-- Invoice Title -->
    <div class="invoice-title">INVOICE</div>

    <!-- Invoice and Customer Info -->
    <div class="info-section">
      <div class="info-box">
        <div class="info-label">Bill To:</div>
        <p><strong>{{CUSTOMER_NAME}}</strong><br>
        {{CUSTOMER_ADDRESS}}<br>
        {{CUSTOMER_PHONE}}<br>
        {{CUSTOMER_EMAIL}}</p>
      </div>
      <div class="info-box">
        <div class="info-label">Invoice Details:</div>
        <p><strong>Invoice #:</strong> {{INVOICE_NUMBER}}<br>
        <strong>Date:</strong> {{INVOICE_DATE}}<br>
        <strong>Due Date:</strong> {{DUE_DATE}}<br>
        <strong>Payment Terms:</strong> Net 30</p>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Item Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <!-- Dynamic items will be inserted here -->
        {{ITEMS_PLACEHOLDER}}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row">
        <div class="total-label">Subtotal:</div>
        <div class="total-value">{{SUBTOTAL}}</div>
      </div>
      <div class="total-row">
        <div class="total-label">Tax ({{TAX_RATE}}%):</div>
        <div class="total-value">{{TAX_AMOUNT}}</div>
      </div>
      <div class="total-row grand-total">
        <div class="total-label">Total:</div>
        <div class="total-value">{{TOTAL}}</div>
      </div>
    </div>

    <!-- Footer with Signature -->
    <div class="footer">
      <div class="signature">
        <img src="{{SIGNATURE_PLACEHOLDER}}" alt="Signature">
        <p><strong>Authorized Signature</strong></p>
      </div>
      
      <div class="terms">
        <strong>Terms & Conditions:</strong><br>
        Payment is due within 30 days. Please make checks payable to Your Company Name.
        Late payments may incur additional charges. Thank you for your business!
      </div>
    </div>
  </div>
</body>
</html>`;

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>, imageType: 'logo' | 'signature' | 'custom') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `invoice-templates/${timestamp}-${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Generate placeholder text
      const placeholder = `{{${imageType.toUpperCase()}_${timestamp}}}`;

      const newImage: UploadedImage = {
        id: `img-${timestamp}`,
        name: file.name,
        url: downloadURL,
        type: imageType,
        placeholder: placeholder,
      };

      setImages(prev => [...prev, newImage]);
      setUploading(false);

      // Auto-insert placeholder in HTML at cursor position
      if (htmlContent.includes(`{{${imageType.toUpperCase()}_PLACEHOLDER}}`)) {
        setHtmlContent(prev => prev.replace(`{{${imageType.toUpperCase()}_PLACEHOLDER}}`, placeholder));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
      setUploading(false);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleCopyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder);
    alert('Placeholder copied to clipboard!');
  };

  const handleInsertPlaceholder = (placeholder: string) => {
    setHtmlContent(prev => prev + `\n${placeholder}`);
  };

  const handleLoadSample = () => {
    if (htmlContent && !confirm('This will replace your current HTML. Continue?')) {
      return;
    }
    setHtmlContent(sampleTemplate);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (!htmlContent.trim()) {
      alert('Please enter HTML content');
      return;
    }

    const templateData: HTMLTemplateData = {
      name: templateName,
      description: templateDescription,
      htmlContent: htmlContent,
      images: images,
      category: category,
    };

    onSave(templateData);
  };

  const renderPreview = () => {
    let processedHTML = htmlContent;
    
    // Replace image placeholders with actual URLs
    images.forEach(img => {
      processedHTML = processedHTML.replace(new RegExp(img.placeholder, 'g'), img.url);
    });

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          bgcolor: 'white',
          border: '1px solid',
          borderColor: 'divider',
        }}
        dangerouslySetInnerHTML={{ __html: processedHTML }}
      />
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: { width: '95vw', height: '95vh', maxWidth: 'none' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CodeIcon color="primary" />
            <Typography variant="h6">HTML Invoice Template Creator</Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant={previewMode ? 'contained' : 'outlined'}
              startIcon={<PreviewIcon />}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Edit Mode' : 'Preview'}
            </Button>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!previewMode ? (
          <Grid container spacing={3}>
            {/* Left Panel - HTML Editor */}
            <Grid item xs={12} md={8}>
              <Box display="flex" flexDirection="column" height="100%">
                {/* Basic Info */}
                <Box mb={2}>
                  <TextField
                    fullWidth
                    label="Template Name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    sx={{ mb: 2 }}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Description"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    multiline
                    rows={2}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* HTML Editor */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    HTML Content
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleLoadSample}
                  >
                    Load Sample Template
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                  Use placeholders like {`{{LOGO_PLACEHOLDER}}`}, {`{{SIGNATURE_PLACEHOLDER}}`}, {`{{CUSTOMER_NAME}}`}, {`{{INVOICE_NUMBER}}`}, etc.
                  Upload images from the right panel and insert their placeholders.
                </Alert>

                <TextField
                  fullWidth
                  multiline
                  rows={25}
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Paste your HTML code here..."
                  sx={{
                    '& .MuiInputBase-root': {
                      fontFamily: 'monospace',
                      fontSize: '13px',
                    },
                  }}
                />
              </Box>
            </Grid>

            {/* Right Panel - Image Manager */}
            <Grid item xs={12} md={4}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Image Manager
                </Typography>

                <Divider sx={{ my: 2 }} />

                {/* Upload Buttons */}
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom color="text.secondary">
                    Upload Images:
                  </Typography>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={(e) => {
                      // Will be set dynamically
                    }}
                  />

                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ImageIcon />}
                        onClick={() => {
                          fileInputRef.current!.onchange = (e: any) => handleImageUpload(e, 'logo');
                          fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                      >
                        Upload Logo
                      </Button>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<InsertPhotoIcon />}
                        onClick={() => {
                          fileInputRef.current!.onchange = (e: any) => handleImageUpload(e, 'signature');
                          fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                      >
                        Upload Signature
                      </Button>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        onClick={() => {
                          fileInputRef.current!.onchange = (e: any) => handleImageUpload(e, 'custom');
                          fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                      >
                        Upload Custom Image
                      </Button>
                    </Grid>
                  </Grid>

                  {uploading && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Uploading image...
                    </Alert>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Uploaded Images List */}
                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Uploaded Images ({images.length}):
                </Typography>

                {images.length === 0 ? (
                  <Box textAlign="center" py={3}>
                    <ImageIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No images uploaded yet
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {images.map((img) => (
                      <Card key={img.id} sx={{ mb: 2 }}>
                        <CardContent sx={{ pb: 1 }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <Chip
                              label={img.type}
                              size="small"
                              color="primary"
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>
                              {img.name}
                            </Typography>
                          </Box>
                          
                          <Box
                            component="img"
                            src={img.url}
                            alt={img.name}
                            sx={{
                              width: '100%',
                              height: 100,
                              objectFit: 'contain',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'grey.50',
                              mb: 1,
                            }}
                          />
                          
                          <Box
                            sx={{
                              bgcolor: 'grey.100',
                              p: 1,
                              borderRadius: 1,
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                              }}
                            >
                              {img.placeholder}
                            </Typography>
                          </Box>
                        </CardContent>
                        
                        <CardActions sx={{ pt: 0 }}>
                          <Tooltip title="Copy placeholder">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyPlaceholder(img.placeholder)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Insert into HTML">
                            <IconButton
                              size="small"
                              onClick={() => handleInsertPlaceholder(img.placeholder)}
                            >
                              <CodeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete image">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteImage(img.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </CardActions>
                      </Card>
                    ))}
                  </List>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Common Placeholders */}
                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Available Placeholders:
                </Typography>
                <Box sx={{ fontSize: '10px', fontFamily: 'monospace', color: 'text.secondary', maxHeight: '200px', overflow: 'auto' }}>
                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>Customer Info:</Typography>
                  <div>• {`{{CUSTOMER_NAME}}`}</div>
                  <div>• {`{{CUSTOMER_ADDRESS}}`}</div>
                  <div>• {`{{CUSTOMER_PHONE}}`}</div>
                  <div>• {`{{CUSTOMER_EMAIL}}`}</div>
                  <div>• {`{{CUSTOMER_GSTIN}}`}</div>
                  
                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>Invoice Info:</Typography>
                  <div>• {`{{INVOICE_NUMBER}}`}</div>
                  <div>• {`{{INVOICE_DATE}}`}</div>
                  <div>• {`{{DUE_DATE}}`}</div>
                  <div>• {`{{PAYMENT_MODE}}`}</div>
                  
                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>Product Specific:</Typography>
                  <div>• {`{{WARRANTY_PERIOD}}`}</div>
                  <div>• {`{{TRIAL_PERIOD}}`}</div>
                  
                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>Amounts:</Typography>
                  <div>• {`{{SUBTOTAL}}`}</div>
                  <div>• {`{{TAX_RATE}}`}</div>
                  <div>• {`{{TAX_AMOUNT}}`}</div>
                  <div>• {`{{TOTAL}}`}</div>
                  
                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>Items Table:</Typography>
                  <div>• {`{{ITEMS_PLACEHOLDER}}`}</div>
                  
                  <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>Images:</Typography>
                  <div>• {`{{LOGO_PLACEHOLDER}}`}</div>
                  <div>• {`{{SIGNATURE_PLACEHOLDER}}`}</div>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          // Preview Mode
          <Box height="100%">
            {renderPreview()}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
        >
          Save Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HTMLTemplateCreator;

