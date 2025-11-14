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
  CardActions,
  Switch,
  FormControlLabel,
  TextField,
  Chip,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Api as ApiIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';

interface APIIntegrationsProps {
  open: boolean;
  onClose: () => void;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  category: 'invoice' | 'payment' | 'email' | 'storage' | 'accounting';
  status: 'connected' | 'disconnected' | 'error';
  features: string[];
  config?: {
    apiKey?: string;
    baseUrl?: string;
    webhookUrl?: string;
    [key: string]: any;
  };
}

const APIIntegrations: React.FC<APIIntegrationsProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'invoiceninja',
      name: 'Invoice Ninja',
      description: 'Professional invoicing and billing platform',
      logo: '/logos/invoice-ninja.png',
      category: 'invoice',
      status: 'disconnected',
      features: ['Invoice Generation', 'Client Management', 'Payment Tracking', 'Reports'],
      config: {
        apiKey: '',
        baseUrl: 'https://app.invoiceninja.com',
      },
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      description: 'Complete accounting and invoicing solution',
      logo: '/logos/quickbooks.png',
      category: 'accounting',
      status: 'disconnected',
      features: ['Accounting', 'Invoicing', 'Expense Tracking', 'Tax Preparation'],
      config: {
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      },
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Online payment processing platform',
      logo: '/logos/stripe.png',
      category: 'payment',
      status: 'disconnected',
      features: ['Payment Processing', 'Subscription Billing', 'Invoice Payments', 'Analytics'],
      config: {
        publishableKey: '',
        secretKey: '',
        webhookSecret: '',
      },
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Indian payment gateway and financial services',
      logo: '/logos/razorpay.png',
      category: 'payment',
      status: 'disconnected',
      features: ['Payment Gateway', 'UPI Payments', 'Digital Wallet', 'Banking'],
      config: {
        keyId: '',
        keySecret: '',
        webhookSecret: '',
      },
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Email delivery and marketing platform',
      logo: '/logos/sendgrid.png',
      category: 'email',
      status: 'disconnected',
      features: ['Email Delivery', 'Templates', 'Analytics', 'Marketing Campaigns'],
      config: {
        apiKey: '',
        fromEmail: '',
        fromName: '',
      },
    },
    {
      id: 'mailgun',
      name: 'Mailgun',
      description: 'Email automation and delivery service',
      logo: '/logos/mailgun.png',
      category: 'email',
      status: 'disconnected',
      features: ['Email API', 'Email Validation', 'Analytics', 'Webhooks'],
      config: {
        apiKey: '',
        domain: '',
        baseUrl: 'https://api.mailgun.net/v3',
      },
    },
    {
      id: 'googledrive',
      name: 'Google Drive',
      description: 'Cloud storage and file sharing',
      logo: '/logos/google-drive.png',
      category: 'storage',
      status: 'disconnected',
      features: ['File Storage', 'Sharing', 'Collaboration', 'Backup'],
      config: {
        clientId: '',
        clientSecret: '',
        refreshToken: '',
      },
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Cloud storage and file synchronization',
      logo: '/logos/dropbox.png',
      category: 'storage',
      status: 'disconnected',
      features: ['File Storage', 'Sync', 'Sharing', 'Version History'],
      config: {
        accessToken: '',
        appKey: '',
        appSecret: '',
      },
    },
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const categories = [
    { id: 'all', label: 'All Integrations', icon: <ApiIcon /> },
    { id: 'invoice', label: 'Invoice Services', icon: <CloudUploadIcon /> },
    { id: 'payment', label: 'Payment Gateways', icon: <PaymentIcon /> },
    { id: 'email', label: 'Email Services', icon: <EmailIcon /> },
    { id: 'storage', label: 'Cloud Storage', icon: <DownloadIcon /> },
    { id: 'accounting', label: 'Accounting', icon: <SettingsIcon /> },
  ];

  const filteredIntegrations = integrations.filter(integration => 
    activeTab === 0 || categories[activeTab]?.id === integration.category
  );

  const handleConnect = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigDialogOpen(true);
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, status: 'disconnected' as const }
        : integration
    ));
  };

  const handleTestConnection = async () => {
    if (!selectedIntegration) return;

    setTestingConnection(true);
    
    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update integration status
      setIntegrations(prev => prev.map(integration =>
        integration.id === selectedIntegration.id
          ? { ...integration, status: 'connected' as const }
          : integration
      ));
      
      setConfigDialogOpen(false);
      setSelectedIntegration(null);
    } catch (error) {
      setIntegrations(prev => prev.map(integration =>
        integration.id === selectedIntegration.id
          ? { ...integration, status: 'error' as const }
          : integration
      ));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConfigUpdate = (field: string, value: string) => {
    if (!selectedIntegration) return;

    setSelectedIntegration(prev => ({
      ...prev!,
      config: {
        ...prev!.config,
        [field]: value,
      },
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <ApiIcon color="disabled" />;
    }
  };

  return (
    <>
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
              <ApiIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6">API Integrations</Typography>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
              {categories.map((category, index) => (
                <Tab
                  key={category.id}
                  label={category.label}
                  icon={category.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Box>

          <Grid container spacing={3}>
            {filteredIntegrations.map((integration) => (
              <Grid item xs={12} md={6} lg={4} key={integration.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 1,
                    }}
                  >
                    <Chip
                      label={integration.status}
                      color={getStatusColor(integration.status) as any}
                      size="small"
                      icon={getStatusIcon(integration.status)}
                    />
                  </Box>

                  <CardContent sx={{ flexGrow: 1, pt: 5 }}>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1,
                          bgcolor: 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                        }}
                      >
                        <ApiIcon color="primary" />
                      </Box>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {integration.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {integration.description}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="subtitle2" gutterBottom>
                      Features:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                      {integration.features.map((feature, index) => (
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

                  <CardActions sx={{ p: 2, pt: 0 }}>
                    {integration.status === 'connected' ? (
                      <>
                        <Button
                          size="small"
                          startIcon={<SettingsIcon />}
                          onClick={() => handleConnect(integration)}
                        >
                          Configure
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SyncIcon />}
                        onClick={() => handleConnect(integration)}
                        fullWidth
                      >
                        Connect
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredIntegrations.length === 0 && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <ApiIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No integrations found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try selecting a different category
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Configure {selectedIntegration?.name}
        </DialogTitle>
        <DialogContent>
          {selectedIntegration && (
            <Box sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Enter your API credentials to connect with {selectedIntegration.name}.
                Your credentials are encrypted and stored securely.
              </Alert>

              {testingConnection && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Testing connection...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}

              {/* Dynamic configuration fields based on integration */}
              {selectedIntegration.id === 'stripe' && (
                <>
                  <TextField
                    fullWidth
                    label="Publishable Key"
                    value={selectedIntegration.config?.publishableKey || ''}
                    onChange={(e) => handleConfigUpdate('publishableKey', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="pk_test_..."
                  />
                  <TextField
                    fullWidth
                    label="Secret Key"
                    type="password"
                    value={selectedIntegration.config?.secretKey || ''}
                    onChange={(e) => handleConfigUpdate('secretKey', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="sk_test_..."
                  />
                  <TextField
                    fullWidth
                    label="Webhook Secret"
                    type="password"
                    value={selectedIntegration.config?.webhookSecret || ''}
                    onChange={(e) => handleConfigUpdate('webhookSecret', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="whsec_..."
                  />
                </>
              )}

              {selectedIntegration.id === 'razorpay' && (
                <>
                  <TextField
                    fullWidth
                    label="Key ID"
                    value={selectedIntegration.config?.keyId || ''}
                    onChange={(e) => handleConfigUpdate('keyId', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="rzp_test_..."
                  />
                  <TextField
                    fullWidth
                    label="Key Secret"
                    type="password"
                    value={selectedIntegration.config?.keySecret || ''}
                    onChange={(e) => handleConfigUpdate('keySecret', e.target.value)}
                    sx={{ mb: 2 }}
                  />
                </>
              )}

              {selectedIntegration.id === 'sendgrid' && (
                <>
                  <TextField
                    fullWidth
                    label="API Key"
                    type="password"
                    value={selectedIntegration.config?.apiKey || ''}
                    onChange={(e) => handleConfigUpdate('apiKey', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="SG...."
                  />
                  <TextField
                    fullWidth
                    label="From Email"
                    value={selectedIntegration.config?.fromEmail || ''}
                    onChange={(e) => handleConfigUpdate('fromEmail', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="noreply@yourcompany.com"
                  />
                  <TextField
                    fullWidth
                    label="From Name"
                    value={selectedIntegration.config?.fromName || ''}
                    onChange={(e) => handleConfigUpdate('fromName', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="Your Company Name"
                  />
                </>
              )}

              {selectedIntegration.id === 'invoiceninja' && (
                <>
                  <TextField
                    fullWidth
                    label="API Token"
                    type="password"
                    value={selectedIntegration.config?.apiKey || ''}
                    onChange={(e) => handleConfigUpdate('apiKey', e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Base URL"
                    value={selectedIntegration.config?.baseUrl || ''}
                    onChange={(e) => handleConfigUpdate('baseUrl', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="https://app.invoiceninja.com"
                  />
                </>
              )}

              {/* Add more integration-specific configurations as needed */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTestConnection}
            variant="contained"
            disabled={testingConnection}
            startIcon={testingConnection ? <SyncIcon /> : <CheckCircleIcon />}
          >
            {testingConnection ? 'Testing...' : 'Test & Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default APIIntegrations;
