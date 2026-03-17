'use client';

import React, { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react';
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
import AsyncActionButton from '@/components/common/AsyncActionButton';
import {
  DOCUMENT_TEMPLATE_META,
  getDocumentTypeLabel,
  getTemplatePreviewHtml,
  ManagedDocumentType,
} from '@/utils/documentTemplateUtils';

interface HTMLTemplateCreatorProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: HTMLTemplateData) => Promise<void> | void;
  initialTemplate?: HTMLTemplateData;
  documentType?: ManagedDocumentType;
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
  documentType: ManagedDocumentType;
}

const HTMLTemplateCreator: React.FC<HTMLTemplateCreatorProps> = ({
  open,
  onClose,
  onSave,
  initialTemplate,
  documentType = 'invoice',
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [templateDescription, setTemplateDescription] = useState(initialTemplate?.description || '');
  const [htmlContent, setHtmlContent] = useState(initialTemplate?.htmlContent || '');
  const [images, setImages] = useState<UploadedImage[]>(initialTemplate?.images || []);
  const [category, setCategory] = useState<HTMLTemplateData['category']>(initialTemplate?.category || 'custom');
  const [uploading, setUploading] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateMeta = useMemo(() => DOCUMENT_TEMPLATE_META[documentType], [documentType]);

  useEffect(() => {
    if (!open) return;
    setTemplateName(initialTemplate?.name || '');
    setTemplateDescription(initialTemplate?.description || '');
    setHtmlContent(initialTemplate?.htmlContent || '');
    setImages(initialTemplate?.images || []);
    setCategory(initialTemplate?.category || 'custom');
    setPreviewMode(false);
    setActiveTab(0);
  }, [open, initialTemplate]);

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
    setHtmlContent(templateMeta.sampleHtml);
  };

  const handleSave = () => {
    if (savingTemplate) return;
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
      documentType,
    };

    try {
      setSavingTemplate(true);
      const maybePromise = onSave(templateData);
      if (maybePromise && typeof (maybePromise as Promise<void>).finally === 'function') {
        (maybePromise as Promise<void>).finally(() => setSavingTemplate(false));
        return;
      }
      setSavingTemplate(false);
    } catch (error) {
      setSavingTemplate(false);
      throw error;
    }
  };

  const renderPreview = () => {
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
        dangerouslySetInnerHTML={{ __html: getTemplatePreviewHtml(documentType, htmlContent, images) }}
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
            <Typography variant="h6">{getDocumentTypeLabel(documentType)} HTML Template Creator</Typography>
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
                    Load Sample {getDocumentTypeLabel(documentType)} Template
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                  Use the placeholders for the selected {getDocumentTypeLabel(documentType).toLowerCase()} template.
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
                  Available Placeholders for {getDocumentTypeLabel(documentType)}:
                </Typography>
                <Box sx={{ fontSize: '10px', fontFamily: 'monospace', color: 'text.secondary', maxHeight: '200px', overflow: 'auto' }}>
                  {templateMeta.placeholderSections.map((section) => (
                    <Box key={section.title}>
                      <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1 }}>
                        {section.title}:
                      </Typography>
                      {section.tokens.map((token) => (
                        <div key={token}>• {token}</div>
                      ))}
                    </Box>
                  ))}
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
        <Button onClick={onClose} disabled={savingTemplate}>
          Cancel
        </Button>
        <AsyncActionButton
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={savingTemplate}
          loadingText="Saving Template..."
        >
          Save Template
        </AsyncActionButton>
      </DialogActions>
    </Dialog>
  );
};

export default HTMLTemplateCreator;

