'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Divider,
  Tab,
  Tabs,
  AppBar,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as PreviewIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Palette as PaletteIcon,
  Description as TemplateIcon,
  Settings as SettingsIcon,
  CloudUpload as CloudUploadIcon,
  Api as ApiIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import InvoiceBuilder from '@/components/invoice-builder/InvoiceBuilder';
import APIIntegrations from '@/components/invoice-integrations/APIIntegrations';
import HTMLTemplateCreator, { HTMLTemplateData } from '@/components/invoices/HTMLTemplateCreator';
import RefreshDataButton from '@/components/common/RefreshDataButton';
import InvoiceNumberingSettingsCard from '@/components/invoice-manager/InvoiceNumberingSettingsCard';
import {
  getDocumentTypeLabel,
  getTemplatePreviewHtml,
  ManagedDocumentType,
} from '@/utils/documentTemplateUtils';
import {
  CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION,
  CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID,
  type DocumentTemplateRoutingDoc,
  routingFieldForDocumentType,
} from '@/lib/crmSettings/documentTemplateRouting';

// Types
interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'medical' | 'retail' | 'service' | 'custom';
  thumbnail: string;
  isDefault: boolean;
  isFavorite: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  templateType?: 'visual' | 'html'; // New field to distinguish template types
  documentType?: ManagedDocumentType;
  htmlContent?: string; // For HTML templates
  images?: Array<{
    id: string;
    name: string;
    url: string;
    type: 'logo' | 'signature' | 'custom';
    placeholder: string;
  }>; // For HTML templates
  config: {
    layout: 'classic' | 'modern' | 'minimal' | 'creative';
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    fonts: {
      heading: string;
      body: string;
    };
    logo: {
      show: boolean;
      position: 'left' | 'center' | 'right';
      size: 'small' | 'medium' | 'large';
    };
    sections: {
      header: boolean;
      customerInfo: boolean;
      itemsTable: boolean;
      totals: boolean;
      terms: boolean;
      footer: boolean;
      signature: boolean;
    };
    customFields: Array<{
      name: string;
      type: 'text' | 'number' | 'date' | 'dropdown';
      required: boolean;
      position: string;
    }>;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`invoice-tabpanel-${index}`}
      aria-labelledby={`invoice-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const InvoiceManagerPage = () => {
  const { user, userProfile } = useAuth();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('business');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [apiIntegrationsOpen, setApiIntegrationsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [htmlCreatorOpen, setHtmlCreatorOpen] = useState(false);
  const [templateTypeDialogOpen, setTemplateTypeDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplate | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [creatingDocumentType, setCreatingDocumentType] = useState<ManagedDocumentType>('invoice');
  /** Which HTML template is pinned for staff collect-payment PDFs (see `getResolvedHtmlTemplateAdmin`). */
  const [documentTemplateRouting, setDocumentTemplateRouting] = useState<DocumentTemplateRoutingDoc | null>(null);

  // Default templates
  const defaultTemplates: Partial<InvoiceTemplate>[] = [
    {
      name: 'Professional Business',
      description: 'Clean, professional template perfect for B2B invoices',
      category: 'business',
      thumbnail: '/templates/professional-business.png',
      isDefault: true,
      config: {
        layout: 'classic',
        colors: { primary: '#2563EB', secondary: '#64748B', accent: '#F59E0B' },
        fonts: { heading: 'Inter', body: 'Inter' },
        logo: { show: true, position: 'left', size: 'medium' },
        sections: {
          header: true,
          customerInfo: true,
          itemsTable: true,
          totals: true,
          terms: true,
          footer: true,
          signature: true,
        },
        customFields: [],
      },
    },
    {
      name: 'Medical Invoice',
      description: 'Specialized template for healthcare and medical services',
      category: 'medical',
      thumbnail: '/templates/medical-invoice.png',
      isDefault: true,
      config: {
        layout: 'modern',
        colors: { primary: '#059669', secondary: '#6B7280', accent: '#DC2626' },
        fonts: { heading: 'Roboto', body: 'Roboto' },
        logo: { show: true, position: 'center', size: 'large' },
        sections: {
          header: true,
          customerInfo: true,
          itemsTable: true,
          totals: true,
          terms: true,
          footer: true,
          signature: true,
        },
        customFields: [
          { name: 'Patient ID', type: 'text', required: true, position: 'header' },
          { name: 'Doctor Name', type: 'text', required: false, position: 'header' },
        ],
      },
    },
    {
      name: 'Retail Store',
      description: 'Perfect for retail businesses and product sales',
      category: 'retail',
      thumbnail: '/templates/retail-store.png',
      isDefault: true,
      config: {
        layout: 'minimal',
        colors: { primary: '#7C3AED', secondary: '#9CA3AF', accent: '#F59E0B' },
        fonts: { heading: 'Poppins', body: 'Poppins' },
        logo: { show: true, position: 'right', size: 'small' },
        sections: {
          header: true,
          customerInfo: true,
          itemsTable: true,
          totals: true,
          terms: false,
          footer: true,
          signature: false,
        },
        customFields: [],
      },
    },
    {
      name: 'Service Provider',
      description: 'Ideal for consultants and service-based businesses',
      category: 'service',
      thumbnail: '/templates/service-provider.png',
      isDefault: true,
      config: {
        layout: 'creative',
        colors: { primary: '#DC2626', secondary: '#4B5563', accent: '#059669' },
        fonts: { heading: 'Montserrat', body: 'Open Sans' },
        logo: { show: true, position: 'left', size: 'medium' },
        sections: {
          header: true,
          customerInfo: true,
          itemsTable: true,
          totals: true,
          terms: true,
          footer: true,
          signature: true,
        },
        customFields: [
          { name: 'Project Name', type: 'text', required: false, position: 'header' },
          { name: 'Hours Worked', type: 'number', required: false, position: 'items' },
        ],
      },
    },
  ];

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const templatesRef = collection(db, 'invoiceTemplates');
      const snapshot = await getDocs(templatesRef);
      
      const userTemplates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as InvoiceTemplate[];

      // Combine with default templates if user has no templates
      if (userTemplates.length === 0) {
        const defaultTemplatesWithIds = defaultTemplates.map((template, index) => ({
          id: `default-${index}`,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isFavorite: false,
          ...template,
        })) as InvoiceTemplate[];
        
        setTemplates(defaultTemplatesWithIds);
      } else {
        setTemplates(userTemplates);
      }

      const routingSnap = await getDoc(
        doc(db, CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION, CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID)
      );
      setDocumentTemplateRouting(
        routingSnap.exists() ? (routingSnap.data() as DocumentTemplateRoutingDoc) : {}
      );
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await fetchTemplates();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!user || !newTemplateName.trim()) return;

    try {
      const newTemplate: Partial<InvoiceTemplate> = {
        name: newTemplateName,
        description: newTemplateDescription,
        category: selectedCategory as any,
        thumbnail: '/templates/custom-template.png',
        isDefault: false,
        isFavorite: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        templateType: 'visual',
        documentType: 'invoice',
        config: {
          layout: 'modern',
          colors: { primary: '#2563EB', secondary: '#64748B', accent: '#F59E0B' },
          fonts: { heading: 'Inter', body: 'Inter' },
          logo: { show: true, position: 'left', size: 'medium' },
          sections: {
            header: true,
            customerInfo: true,
            itemsTable: true,
            totals: true,
            terms: true,
            footer: true,
            signature: true,
          },
          customFields: [],
        },
      };

      const docRef = await addDoc(collection(db, 'invoiceTemplates'), newTemplate);
      
      setTemplates(prev => [...prev, { id: docRef.id, ...newTemplate } as InvoiceTemplate]);
      setCreateDialogOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleSaveHTMLTemplate = async (htmlTemplate: HTMLTemplateData) => {
    if (!user) return;

    try {
      const newTemplate: Partial<InvoiceTemplate> = {
        name: htmlTemplate.name,
        description: htmlTemplate.description,
        category: htmlTemplate.category,
        thumbnail: '/templates/html-template.png',
        isDefault: false,
        isFavorite: false,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        templateType: 'html',
        documentType: htmlTemplate.documentType,
        htmlContent: htmlTemplate.htmlContent,
        images: htmlTemplate.images,
        config: {
          layout: 'custom',
          colors: { primary: '#2563EB', secondary: '#64748B', accent: '#F59E0B' },
          fonts: { heading: 'Inter', body: 'Inter' },
          logo: { show: true, position: 'left', size: 'medium' },
          sections: {
            header: true,
            customerInfo: true,
            itemsTable: true,
            totals: true,
            terms: true,
            footer: true,
            signature: true,
          },
          customFields: [],
        },
      };

      if (editingTemplate?.id) {
        await updateDoc(doc(db, 'invoiceTemplates', editingTemplate.id), {
          ...newTemplate,
          updatedAt: serverTimestamp(),
        });

        setTemplates(prev => prev.map((template) =>
          template.id === editingTemplate.id
            ? { ...template, ...newTemplate }
            : template
        ));
        setSuccessMsg(`${getDocumentTypeLabel(htmlTemplate.documentType)} template updated.`);
      } else {
        const docRef = await addDoc(collection(db, 'invoiceTemplates'), {
          ...newTemplate,
          createdAt: serverTimestamp(),
        });

        setTemplates(prev => [...prev, { id: docRef.id, ...newTemplate } as InvoiceTemplate]);
        setSuccessMsg(`${getDocumentTypeLabel(htmlTemplate.documentType)} template created.`);
      }

      setHtmlCreatorOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving HTML template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteDoc(doc(db, 'invoiceTemplates', templateId));
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleToggleFavorite = async (template: InvoiceTemplate) => {
    try {
      const updatedTemplate = { ...template, isFavorite: !template.isFavorite };
      await updateDoc(doc(db, 'invoiceTemplates', template.id), {
        isFavorite: updatedTemplate.isFavorite,
        updatedAt: serverTimestamp(),
      });
      
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? updatedTemplate : t
      ));
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const isStaffPdfTemplateActive = (template: InvoiceTemplate) => {
    if (template.templateType !== 'html' || !String(template.htmlContent ?? '').trim() || !template.documentType) {
      return false;
    }
    const field = routingFieldForDocumentType(template.documentType);
    const id = documentTemplateRouting?.[field];
    return id != null && String(id) === template.id;
  };

  const handleSetStaffPdfTemplate = async (template: InvoiceTemplate) => {
    if (!user || !template.documentType || template.templateType !== 'html') return;
    try {
      const field = routingFieldForDocumentType(template.documentType);
      await setDoc(
        doc(db, CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION, CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID),
        { [field]: template.id, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setDocumentTemplateRouting((prev) => ({
        ...(prev || {}),
        [field]: template.id,
      }));
      setSuccessMsg(
        `${getDocumentTypeLabel(template.documentType)} — this template is now used for staff app PDFs (collect payment).`
      );
    } catch (error) {
      console.error('Error saving staff PDF template:', error);
      setSuccessMsg('Could not save staff PDF template. Try again.');
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, template: InvoiceTemplate) => {
    setMenuAnchor(event.currentTarget);
    setSelectedTemplate(template);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedTemplate(null);
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
    if (selectedTab === 0) return true; // All
    if (selectedTab === 1) return template.isFavorite; // Favorites
    if (selectedTab === 2) return template.isDefault; // Default
    if (selectedTab === 3) return !template.isDefault; // Custom
    return true;
  });

  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ borderRadius: 0, mb: 3 }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <TemplateIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  Invoice Manager
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Create and manage templates. For HTML templates, use &quot;Use for staff app PDF&quot; to choose which
                  design staff collect-payment emails use (booking, trial, or invoice).
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={1} flexWrap="wrap">
              <RefreshDataButton onClick={handleRefresh} loading={refreshing} />
              <Button
                variant="outlined"
                startIcon={<ApiIcon />}
                onClick={() => setApiIntegrationsOpen(true)}
              >
                API Integrations
              </Button>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => {/* TODO: Import templates */}}
              >
                Import
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setTemplateTypeDialogOpen(true)}
              >
                Create Template
              </Button>
            </Box>
          </Box>

          {/* Tabs */}
          <AppBar position="static" color="transparent" elevation={0}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label={`All Templates (${templates.length})`} />
              <Tab label={`Favorites (${templates.filter(t => t.isFavorite).length})`} />
              <Tab label={`Default (${templates.filter(t => t.isDefault).length})`} />
              <Tab label={`Custom (${templates.filter(t => !t.isDefault).length})`} />
            </Tabs>
          </AppBar>
        </Box>
      </Paper>

      {/* Content */}
      <Box sx={{ px: 3 }}>
        <InvoiceNumberingSettingsCard />
        <TabPanel value={selectedTab} index={selectedTab}>
          <Grid container spacing={3}>
            {filteredTemplates.map((template) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                >
                  {/* Template Preview */}
                  <Box
                    sx={{
                      height: 200,
                      bgcolor: 'grey.100',
                      backgroundImage: `url(${template.thumbnail})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        gap: 0.5,
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                        onClick={() => handleToggleFavorite(template)}
                      >
                        {template.isFavorite ? (
                          <StarIcon sx={{ color: 'warning.main' }} />
                        ) : (
                          <StarBorderIcon />
                        )}
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                        onClick={(e) => handleMenuClick(e, template)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                      }}
                    >
                      <Chip
                        label={template.category}
                        size="small"
                        sx={{
                          bgcolor: getCategoryColor(template.category),
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      />
                      <Chip
                        label={getDocumentTypeLabel(template.documentType || 'invoice')}
                        size="small"
                        variant="filled"
                        sx={{
                          ml: 1,
                          bgcolor: 'rgba(15, 23, 42, 0.78)',
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      />
                    </Box>
                  </Box>

                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom noWrap>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {template.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                      {template.templateType === 'html'
                        ? `${getDocumentTypeLabel(template.documentType || 'invoice')} HTML template`
                        : 'Invoice visual template'}
                    </Typography>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center">
                        {template.isDefault && (
                          <Chip label="Default" size="small" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {template.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      <Button
                        size="small"
                        startIcon={<PreviewIcon />}
                        onClick={() => {
                          setPreviewTemplate(template);
                          setPreviewDialogOpen(true);
                        }}
                      >
                        Preview
                      </Button>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          if (template.templateType === 'html') {
                            setEditingTemplate(template);
                            setCreatingDocumentType(template.documentType || 'invoice');
                            setHtmlCreatorOpen(true);
                          } else {
                            setEditingTemplate(template);
                            setBuilderOpen(true);
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<CopyIcon />}
                        onClick={() => {
                          navigator.clipboard.writeText(template.id);
                          setSuccessMsg('Template ID copied! Use it in sales module.');
                        }}
                        variant="contained"
                      >
                        Use
                      </Button>
                    </Box>
                    {template.templateType === 'html' &&
                      String(template.htmlContent ?? '').trim() &&
                      template.documentType && (
                        <>
                          {isStaffPdfTemplateActive(template) ? (
                            <Chip
                              size="small"
                              color="success"
                              label="Active for staff app PDF"
                              sx={{ alignSelf: 'center' }}
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              fullWidth
                              onClick={() => handleSetStaffPdfTemplate(template)}
                            >
                              Use for staff app PDF
                            </Button>
                          )}
                        </>
                      )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredTemplates.length === 0 && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <TemplateIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No templates found
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Create your first invoice template to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setTemplateTypeDialogOpen(true)}
              >
                Create Template
              </Button>
            </Box>
          )}
        </TabPanel>
      </Box>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="create template"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => setTemplateTypeDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Template Type Selection Dialog */}
      <Dialog 
        open={templateTypeDialogOpen} 
        onClose={() => setTemplateTypeDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Choose Template Type</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the document and editor you want to use
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 3,
                  },
                }}
                onClick={() => {
                  setCreatingDocumentType('invoice');
                  setTemplateTypeDialogOpen(false);
                  setCreateDialogOpen(true);
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <PaletteIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Invoice Visual Builder
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Use the visual editor for standard invoice templates
                  </Typography>
                  <Chip label="Recommended for beginners" color="primary" size="small" />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 3,
                  },
                }}
                onClick={() => {
                  setCreatingDocumentType('invoice');
                  setTemplateTypeDialogOpen(false);
                  setHtmlCreatorOpen(true);
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <TemplateIcon sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Invoice HTML Template
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Write custom invoice HTML with full control and flexibility
                  </Typography>
                  <Chip label="For advanced users" color="secondary" size="small" />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 3,
                  },
                }}
                onClick={() => {
                  setCreatingDocumentType('booking_receipt');
                  setTemplateTypeDialogOpen(false);
                  setHtmlCreatorOpen(true);
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <TemplateIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Booking Receipt Template
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Edit the booking receipt layout that patient profiles use
                  </Typography>
                  <Chip label="Auto-used when marked favorite" color="primary" size="small" />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'warning.main',
                    boxShadow: 3,
                  },
                }}
                onClick={() => {
                  setCreatingDocumentType('trial_receipt');
                  setTemplateTypeDialogOpen(false);
                  setHtmlCreatorOpen(true);
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <TemplateIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Trial Receipt Template
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Edit the trial receipt layout used for trial documents
                  </Typography>
                  <Chip label="Auto-used when marked favorite" color="warning" size="small" />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateTypeDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Template Name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={newTemplateDescription}
              onChange={(e) => setNewTemplateDescription(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              select
              label="Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="business">Business</MenuItem>
              <MenuItem value="medical">Medical</MenuItem>
              <MenuItem value="retail">Retail</MenuItem>
              <MenuItem value="service">Service</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTemplate} variant="contained">
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedTemplate) {
            setEditingTemplate(selectedTemplate);
            if (selectedTemplate.templateType === 'html') {
              setCreatingDocumentType(selectedTemplate.documentType || 'invoice');
              setHtmlCreatorOpen(true);
            } else {
              setBuilderOpen(true);
            }
          }
          handleMenuClose();
        }}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit Template</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {/* TODO: Duplicate template */}}>
          <ListItemIcon><CopyIcon /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {/* TODO: Export template */}}>
          <ListItemIcon><DownloadIcon /></ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {/* TODO: Share template */}}>
          <ListItemIcon><ShareIcon /></ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <Divider />
        {userProfile?.role === 'admin' && (
          <MenuItem 
            onClick={() => {
              if (selectedTemplate && !selectedTemplate.isDefault) {
                handleDeleteTemplate(selectedTemplate.id);
              }
              handleMenuClose();
            }}
            disabled={selectedTemplate?.isDefault}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon><DeleteIcon sx={{ color: 'error.main' }} /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Invoice Builder Dialog */}
      <InvoiceBuilder
        open={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
        onSave={(updatedTemplate) => {
          // Update the template in the list
          if (editingTemplate) {
            setTemplates(prev => prev.map(t => 
              t.id === editingTemplate.id ? { ...t, ...updatedTemplate } : t
            ));
          }
          setBuilderOpen(false);
          setEditingTemplate(null);
        }}
      />

      {/* API Integrations Dialog */}
      <APIIntegrations
        open={apiIntegrationsOpen}
        onClose={() => setApiIntegrationsOpen(false)}
      />

      {/* HTML Template Creator Dialog */}
      <HTMLTemplateCreator
        open={htmlCreatorOpen}
        onClose={() => {
          setHtmlCreatorOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveHTMLTemplate}
        documentType={editingTemplate?.documentType || creatingDocumentType}
        initialTemplate={editingTemplate?.templateType === 'html' ? {
          name: editingTemplate.name,
          description: editingTemplate.description,
          htmlContent: editingTemplate.htmlContent || '',
          images: editingTemplate.images || [],
          category: editingTemplate.category,
          documentType: editingTemplate.documentType || 'invoice',
        } : undefined}
      />

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => {
          setPreviewDialogOpen(false);
          setPreviewTemplate(null);
        }}
        maxWidth={false}
        PaperProps={{
          sx: { width: '90vw', height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              Preview: {previewTemplate?.name}
              {previewTemplate ? ` (${getDocumentTypeLabel(previewTemplate.documentType || 'invoice')})` : ''}
            </Typography>
            <IconButton onClick={() => {
              setPreviewDialogOpen(false);
              setPreviewTemplate(null);
            }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {previewTemplate && (
            <Box sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
              {previewTemplate.templateType === 'html' && previewTemplate.htmlContent ? (
                <Box
                  sx={{
                    width: '100%',
                    minHeight: '100%',
                    bgcolor: 'white',
                    p: 2,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: getTemplatePreviewHtml(
                      previewTemplate.documentType || 'invoice',
                      previewTemplate.htmlContent,
                      previewTemplate.images || []
                    )
                  }}
                />
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary" mb={2}>
                    Visual Builder Preview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This template uses the visual builder. The actual invoice will be rendered
                    based on the configured layout, colors, and sections.
                  </Typography>
                  <Box sx={{ mt: 3, p: 3, bgcolor: 'grey.100', borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Template Configuration:</Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Layout: {previewTemplate.config.layout}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Primary Color: {previewTemplate.config.colors.primary}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          Sections: {Object.entries(previewTemplate.config.sections)
                            .filter(([_, enabled]) => enabled)
                            .map(([name]) => name).join(', ')}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPreviewDialogOpen(false);
            setPreviewTemplate(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={3000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InvoiceManagerPage;
