'use client';

import React, { useState, useEffect } from 'react';
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
  CardMedia,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  LocalHospital as MedicalIcon,
  Store as RetailIcon,
  Build as ServiceIcon,
  Code as CustomIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'medical' | 'retail' | 'service' | 'custom';
  thumbnail: string;
  templateType?: 'visual' | 'html';
  isDefault: boolean;
}

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string, template: Template) => void;
  selectedTemplateId?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  open,
  onClose,
  onSelect,
  selectedTemplateId,
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(selectedTemplateId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (open && user) {
      fetchTemplates();
    }
  }, [open, user]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const templatesRef = collection(db, 'invoiceTemplates');
      const snapshot = await getDocs(templatesRef);
      
      const templatesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Template[];

      setTemplates(templatesData);
      
      // If no template selected yet, select the first one
      if (!selectedTemplate && templatesData.length > 0) {
        setSelectedTemplate(templatesData[0].id);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      onSelect(selectedTemplate, template);
    }
    onClose();
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      business: <BusinessIcon />,
      medical: <MedicalIcon />,
      retail: <RetailIcon />,
      service: <ServiceIcon />,
      custom: <CustomIcon />,
    };
    return icons[category as keyof typeof icons] || <CustomIcon />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      business: '#2563EB',
      medical: '#059669',
      retail: '#7C3AED',
      service: '#DC2626',
      custom: '#F59E0B',
    };
    return colors[category as keyof typeof colors] || '#6B7280';
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">Select Invoice Template</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a template for your invoice
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Alert severity="info">
              No templates found. Please create templates in the Invoice Manager first.
            </Alert>
          </Box>
        ) : (
          <>
            {/* Search and Filter */}
            <Box mb={3} display="flex" gap={2} flexWrap="wrap">
              <TextField
                placeholder="Search templates..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: 200 }}
              />
              
              <Box display="flex" gap={1}>
                <Chip
                  label="All"
                  onClick={() => setFilterCategory('all')}
                  color={filterCategory === 'all' ? 'primary' : 'default'}
                  variant={filterCategory === 'all' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Business"
                  onClick={() => setFilterCategory('business')}
                  color={filterCategory === 'business' ? 'primary' : 'default'}
                  variant={filterCategory === 'business' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Medical"
                  onClick={() => setFilterCategory('medical')}
                  color={filterCategory === 'medical' ? 'primary' : 'default'}
                  variant={filterCategory === 'medical' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Custom"
                  onClick={() => setFilterCategory('custom')}
                  color={filterCategory === 'custom' ? 'primary' : 'default'}
                  variant={filterCategory === 'custom' ? 'filled' : 'outlined'}
                />
              </Box>
            </Box>

            {/* Templates Grid */}
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <Grid container spacing={2}>
                  {filteredTemplates.map((template) => (
                    <Grid item xs={12} sm={6} md={4} key={template.id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: 2,
                          borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: 'primary.light',
                            boxShadow: 2,
                          },
                        }}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <Box
                          sx={{
                            height: 120,
                            bgcolor: 'grey.100',
                            backgroundImage: `url(${template.thumbnail})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                            }}
                          >
                            <Chip
                              icon={getCategoryIcon(template.category)}
                              label={template.category}
                              size="small"
                              sx={{
                                bgcolor: getCategoryColor(template.category),
                                color: 'white',
                                fontWeight: 'bold',
                              }}
                            />
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                            }}
                          >
                            <Radio
                              checked={selectedTemplate === template.id}
                              value={template.id}
                              sx={{
                                bgcolor: 'white',
                                '&.Mui-checked': {
                                  color: 'primary.main',
                                },
                              }}
                            />
                          </Box>
                          {template.templateType === 'html' && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                              }}
                            >
                              <Chip
                                label="HTML"
                                size="small"
                                color="secondary"
                              />
                            </Box>
                          )}
                        </Box>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom noWrap>
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {template.description}
                          </Typography>
                          {template.isDefault && (
                            <Chip label="Default" size="small" variant="outlined" />
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </RadioGroup>
            </FormControl>

            {filteredTemplates.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No templates match your search criteria
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedTemplate || loading}
        >
          Select Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateSelector;

