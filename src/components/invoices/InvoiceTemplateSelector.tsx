'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Palette as PaletteIcon,
  Business as BusinessIcon,
  Settings as SettingsIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { InvoiceConfig } from '@/utils/pdfGenerator';

interface InvoiceTemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: string, config: InvoiceConfig) => void;
  currentConfig?: InvoiceConfig;
}

const templates = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional invoice layout with professional styling',
    preview: '/images/invoice-classic-preview.png',
    features: ['Professional header', 'Detailed product table', 'Terms & conditions'],
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, minimalist design with modern typography',
    preview: '/images/invoice-modern-preview.png',
    features: ['Minimalist design', 'Color accents', 'Clean typography'],
  },
  {
    id: 'medical',
    name: 'Medical',
    description: 'Specialized template for healthcare and medical services',
    preview: '/images/invoice-medical-preview.png',
    features: ['Medical-focused', 'Doctor references', 'Patient details'],
  },
];

const InvoiceTemplateSelector: React.FC<InvoiceTemplateSelectorProps> = ({
  open,
  onClose,
  onSelect,
  currentConfig = {},
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [config, setConfig] = useState<InvoiceConfig>({
    companyName: 'Hope Hearing Solutions',
    companyAddress: 'Your Company Address\nCity, State - PIN Code',
    companyPhone: '+91 XXXXX XXXXX',
    companyEmail: 'info@hopehearing.com',
    companyGST: 'GST Number Here',
    primaryColor: '#FF6B35',
    secondaryColor: '#2563EB',
    showMRP: true,
    showSerialNumbers: true,
    showGST: true,
    customTerms: '',
    customFooter: '',
    ...currentConfig,
  });

  const handleConfigChange = (field: keyof InvoiceConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSelect = () => {
    onSelect(selectedTemplate, config);
    onClose();
  };

  const resetToDefaults = () => {
    setConfig({
      companyName: 'Hope Hearing Solutions',
      companyAddress: 'Your Company Address\nCity, State - PIN Code',
      companyPhone: '+91 XXXXX XXXXX',
      companyEmail: 'info@hopehearing.com',
      companyGST: 'GST Number Here',
      primaryColor: '#FF6B35',
      secondaryColor: '#2563EB',
      showMRP: true,
      showSerialNumbers: true,
      showGST: true,
      customTerms: '',
      customFooter: '',
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <SettingsIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6">Invoice Template & Settings</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Template Selection */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Choose Template
            </Typography>
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} key={template.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selectedTemplate === template.id ? 2 : 1,
                      borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="h6" color="primary">
                          {template.name}
                        </Typography>
                        {selectedTemplate === template.id && (
                          <Chip label="Selected" color="primary" size="small" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {template.description}
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {template.features.map((feature, index) => (
                          <Chip
                            key={index}
                            label={feature}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button size="small" startIcon={<PreviewIcon />}>
                        Preview
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Configuration Panel */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Configuration
            </Typography>

            {/* Company Information */}
            <Box mb={3}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Company Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={config.companyName || ''}
                    onChange={(e) => handleConfigChange('companyName', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Company Address"
                    multiline
                    rows={3}
                    value={config.companyAddress || ''}
                    onChange={(e) => handleConfigChange('companyAddress', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={config.companyPhone || ''}
                    onChange={(e) => handleConfigChange('companyPhone', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={config.companyEmail || ''}
                    onChange={(e) => handleConfigChange('companyEmail', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="GST Number"
                    value={config.companyGST || ''}
                    onChange={(e) => handleConfigChange('companyGST', e.target.value)}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Appearance Settings */}
            <Box mb={3}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                <PaletteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Appearance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Primary Color"
                    type="color"
                    value={config.primaryColor || '#FF6B35'}
                    onChange={(e) => handleConfigChange('primaryColor', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Secondary Color"
                    type="color"
                    value={config.secondaryColor || '#2563EB'}
                    onChange={(e) => handleConfigChange('secondaryColor', e.target.value)}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Display Options */}
            <Box mb={3}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                Display Options
              </Typography>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showMRP || false}
                      onChange={(e) => handleConfigChange('showMRP', e.target.checked)}
                    />
                  }
                  label="Show MRP Column"
                />
              </Box>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showSerialNumbers || false}
                      onChange={(e) => handleConfigChange('showSerialNumbers', e.target.checked)}
                    />
                  }
                  label="Show Serial Numbers"
                />
              </Box>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showGST || false}
                      onChange={(e) => handleConfigChange('showGST', e.target.checked)}
                    />
                  }
                  label="Show GST Details"
                />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Custom Content */}
            <Box mb={3}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                Custom Content
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Custom Terms & Conditions"
                    multiline
                    rows={3}
                    value={config.customTerms || ''}
                    onChange={(e) => handleConfigChange('customTerms', e.target.value)}
                    size="small"
                    placeholder="Enter custom terms and conditions..."
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Custom Footer Text"
                    multiline
                    rows={2}
                    value={config.customFooter || ''}
                    onChange={(e) => handleConfigChange('customFooter', e.target.value)}
                    size="small"
                    placeholder="Enter custom footer text..."
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={resetToDefaults} color="inherit">
          Reset to Defaults
        </Button>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSelect} variant="contained">
          Apply Template & Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceTemplateSelector;
