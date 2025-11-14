'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Palette as PaletteIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  TableChart as TableIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Types
interface InvoiceElement {
  id: string;
  type: 'text' | 'image' | 'table' | 'divider' | 'spacer';
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    padding?: number;
    margin?: number;
    borderRadius?: number;
    border?: string;
  };
  content: any;
  locked?: boolean;
}

interface InvoiceBuilderProps {
  open: boolean;
  onClose: () => void;
  template?: any;
  onSave: (template: any) => void;
}

const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  open,
  onClose,
  template,
  onSave,
}) => {
  const [elements, setElements] = useState<InvoiceElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 794, height: 1123 }); // A4 size in pixels
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Template settings
  const [templateSettings, setTemplateSettings] = useState({
    name: template?.name || 'New Template',
    colors: {
      primary: template?.config?.colors?.primary || '#2563EB',
      secondary: template?.config?.colors?.secondary || '#64748B',
      accent: template?.config?.colors?.accent || '#F59E0B',
    },
    fonts: {
      heading: template?.config?.fonts?.heading || 'Inter',
      body: template?.config?.fonts?.body || 'Inter',
    },
    layout: template?.config?.layout || 'modern',
  });

  // Element library
  const elementLibrary = [
    {
      category: 'Text',
      items: [
        { type: 'text', label: 'Heading', icon: <TextIcon />, content: { text: 'Heading', tag: 'h1' } },
        { type: 'text', label: 'Subheading', icon: <TextIcon />, content: { text: 'Subheading', tag: 'h2' } },
        { type: 'text', label: 'Paragraph', icon: <TextIcon />, content: { text: 'Lorem ipsum dolor sit amet...', tag: 'p' } },
        { type: 'text', label: 'Label', icon: <TextIcon />, content: { text: 'Label:', tag: 'label' } },
      ],
    },
    {
      category: 'Layout',
      items: [
        { type: 'divider', label: 'Divider', icon: <DragIcon />, content: {} },
        { type: 'spacer', label: 'Spacer', icon: <DragIcon />, content: { height: 20 } },
      ],
    },
    {
      category: 'Data',
      items: [
        { type: 'table', label: 'Items Table', icon: <TableIcon />, content: { type: 'items' } },
        { type: 'table', label: 'Totals Table', icon: <TableIcon />, content: { type: 'totals' } },
      ],
    },
    {
      category: 'Media',
      items: [
        { type: 'image', label: 'Logo', icon: <ImageIcon />, content: { src: '', alt: 'Logo' } },
        { type: 'image', label: 'Signature', icon: <ImageIcon />, content: { src: '', alt: 'Signature' } },
      ],
    },
  ];

  const handleAddElement = (elementType: any) => {
    const newElement: InvoiceElement = {
      id: `element-${Date.now()}`,
      type: elementType.type,
      position: { x: 50, y: 50 },
      size: { width: 200, height: 50 },
      style: {
        fontSize: 14,
        fontWeight: 'normal',
        color: '#000000',
        backgroundColor: 'transparent',
        textAlign: 'left',
        padding: 8,
        margin: 4,
      },
      content: elementType.content,
    };

    setElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const handleElementSelect = (elementId: string) => {
    setSelectedElement(elementId);
  };

  const handleElementUpdate = (elementId: string, updates: Partial<InvoiceElement>) => {
    setElements(prev => prev.map(el => 
      el.id === elementId ? { ...el, ...updates } : el
    ));
  };

  const handleElementDelete = (elementId: string) => {
    setElements(prev => prev.filter(el => el.id !== elementId));
    if (selectedElement === elementId) {
      setSelectedElement(null);
    }
  };

  const handleSave = () => {
    const templateData = {
      ...template,
      name: templateSettings.name,
      config: {
        ...template?.config,
        colors: templateSettings.colors,
        fonts: templateSettings.fonts,
        layout: templateSettings.layout,
        elements: elements,
      },
      updatedAt: new Date(),
    };
    
    onSave(templateData);
  };

  const selectedElementData = elements.find(el => el.id === selectedElement);

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
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Invoice Builder - {templateSettings.name}
          </Typography>
          <Box display="flex" gap={1}>
            <IconButton><UndoIcon /></IconButton>
            <IconButton><RedoIcon /></IconButton>
            <Button startIcon={<PreviewIcon />} variant="outlined">
              Preview
            </Button>
            <Button startIcon={<SaveIcon />} variant="contained" onClick={handleSave}>
              Save
            </Button>
            <IconButton onClick={onClose}><CloseIcon /></IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box display="flex" height="calc(100vh - 120px)">
        {/* Left Sidebar - Element Library */}
        <Paper sx={{ width: 280, borderRadius: 0, borderRight: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Elements
            </Typography>
            
            {elementLibrary.map((category) => (
              <Accordion key={category.category} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">{category.category}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={1}>
                    {category.items.map((item, index) => (
                      <Grid item xs={6} key={index}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            minHeight: 60,
                          }}
                          onClick={() => handleAddElement(item)}
                        >
                          <CardContent sx={{ p: 1, textAlign: 'center' }}>
                            {item.icon}
                            <Typography variant="caption" display="block">
                              {item.label}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Paper>

        {/* Main Canvas Area */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Canvas Toolbar */}
          <Paper sx={{ p: 1, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" gap={2}>
              <FormControlLabel
                control={<Switch checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />}
                label="Grid"
              />
              <FormControlLabel
                control={<Switch checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />}
                label="Snap"
              />
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">Zoom:</Typography>
                <Slider
                  value={zoom}
                  onChange={(_, value) => setZoom(value as number)}
                  min={25}
                  max={200}
                  step={25}
                  sx={{ width: 100 }}
                />
                <Typography variant="body2">{zoom}%</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Canvas */}
          <Box
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              bgcolor: 'grey.100',
              p: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <Paper
              ref={canvasRef}
              sx={{
                width: canvasSize.width * (zoom / 100),
                height: canvasSize.height * (zoom / 100),
                position: 'relative',
                bgcolor: 'white',
                boxShadow: 3,
                backgroundImage: showGrid ? 
                  'radial-gradient(circle, #ccc 1px, transparent 1px)' : 'none',
                backgroundSize: showGrid ? '20px 20px' : 'auto',
              }}
            >
              {elements.map((element) => (
                <Box
                  key={element.id}
                  sx={{
                    position: 'absolute',
                    left: element.position.x * (zoom / 100),
                    top: element.position.y * (zoom / 100),
                    width: element.size.width * (zoom / 100),
                    height: element.size.height * (zoom / 100),
                    border: selectedElement === element.id ? '2px solid #2563EB' : '1px dashed transparent',
                    cursor: 'pointer',
                    '&:hover': {
                      border: '1px dashed #2563EB',
                    },
                  }}
                  onClick={() => handleElementSelect(element.id)}
                >
                  {element.type === 'text' && (
                    <Typography
                      component={element.content.tag || 'p'}
                      sx={{
                        ...element.style,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {element.content.text}
                    </Typography>
                  )}
                  
                  {element.type === 'divider' && (
                    <Divider sx={{ width: '100%', mt: 1 }} />
                  )}
                  
                  {element.type === 'spacer' && (
                    <Box sx={{ width: '100%', height: '100%', bgcolor: 'transparent' }} />
                  )}
                  
                  {element.type === 'table' && (
                    <Box sx={{ width: '100%', height: '100%', border: '1px solid #ccc', p: 1 }}>
                      <Typography variant="caption">
                        {element.content.type === 'items' ? 'Items Table' : 'Totals Table'}
                      </Typography>
                    </Box>
                  )}
                  
                  {element.type === 'image' && (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        border: '1px dashed #ccc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.50',
                      }}
                    >
                      <ImageIcon sx={{ color: 'grey.400' }} />
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        </Box>

        {/* Right Sidebar - Properties Panel */}
        <Paper sx={{ width: 320, borderRadius: 0, borderLeft: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 2 }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
              <Tab label="Properties" />
              <Tab label="Template" />
            </Tabs>

            {activeTab === 0 && (
              <Box sx={{ mt: 2 }}>
                {selectedElementData ? (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Element Properties
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="Element ID"
                      value={selectedElementData.id}
                      disabled
                      sx={{ mb: 2 }}
                    />

                    {selectedElementData.type === 'text' && (
                      <>
                        <TextField
                          fullWidth
                          label="Text Content"
                          value={selectedElementData.content.text}
                          onChange={(e) => handleElementUpdate(selectedElementData.id, {
                            content: { ...selectedElementData.content, text: e.target.value }
                          })}
                          sx={{ mb: 2 }}
                        />
                        
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Text Tag</InputLabel>
                          <Select
                            value={selectedElementData.content.tag || 'p'}
                            onChange={(e) => handleElementUpdate(selectedElementData.id, {
                              content: { ...selectedElementData.content, tag: e.target.value }
                            })}
                          >
                            <MenuItem value="h1">Heading 1</MenuItem>
                            <MenuItem value="h2">Heading 2</MenuItem>
                            <MenuItem value="h3">Heading 3</MenuItem>
                            <MenuItem value="p">Paragraph</MenuItem>
                            <MenuItem value="span">Span</MenuItem>
                            <MenuItem value="label">Label</MenuItem>
                          </Select>
                        </FormControl>
                      </>
                    )}

                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                      Style Properties
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="Font Size"
                      type="number"
                      value={selectedElementData.style.fontSize || 14}
                      onChange={(e) => handleElementUpdate(selectedElementData.id, {
                        style: { ...selectedElementData.style, fontSize: parseInt(e.target.value) }
                      })}
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      fullWidth
                      label="Color"
                      type="color"
                      value={selectedElementData.style.color || '#000000'}
                      onChange={(e) => handleElementUpdate(selectedElementData.id, {
                        style: { ...selectedElementData.style, color: e.target.value }
                      })}
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Text Align</InputLabel>
                      <Select
                        value={selectedElementData.style.textAlign || 'left'}
                        onChange={(e) => handleElementUpdate(selectedElementData.id, {
                          style: { ...selectedElementData.style, textAlign: e.target.value as any }
                        })}
                      >
                        <MenuItem value="left">Left</MenuItem>
                        <MenuItem value="center">Center</MenuItem>
                        <MenuItem value="right">Right</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleElementDelete(selectedElementData.id)}
                      sx={{ mt: 2 }}
                    >
                      Delete Element
                    </Button>
                  </>
                ) : (
                  <Box textAlign="center" py={4}>
                    <Typography variant="body2" color="text.secondary">
                      Select an element to edit its properties
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {activeTab === 1 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Template Settings
                </Typography>
                
                <TextField
                  fullWidth
                  label="Template Name"
                  value={templateSettings.name}
                  onChange={(e) => setTemplateSettings(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  sx={{ mb: 2 }}
                />

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Colors
                </Typography>
                
                <TextField
                  fullWidth
                  label="Primary Color"
                  type="color"
                  value={templateSettings.colors.primary}
                  onChange={(e) => setTemplateSettings(prev => ({
                    ...prev,
                    colors: { ...prev.colors, primary: e.target.value }
                  }))}
                  sx={{ mb: 1 }}
                />
                
                <TextField
                  fullWidth
                  label="Secondary Color"
                  type="color"
                  value={templateSettings.colors.secondary}
                  onChange={(e) => setTemplateSettings(prev => ({
                    ...prev,
                    colors: { ...prev.colors, secondary: e.target.value }
                  }))}
                  sx={{ mb: 1 }}
                />
                
                <TextField
                  fullWidth
                  label="Accent Color"
                  type="color"
                  value={templateSettings.colors.accent}
                  onChange={(e) => setTemplateSettings(prev => ({
                    ...prev,
                    colors: { ...prev.colors, accent: e.target.value }
                  }))}
                  sx={{ mb: 2 }}
                />

                <Typography variant="subtitle2" gutterBottom>
                  Layout
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Layout Style</InputLabel>
                  <Select
                    value={templateSettings.layout}
                    onChange={(e) => setTemplateSettings(prev => ({
                      ...prev,
                      layout: e.target.value
                    }))}
                  >
                    <MenuItem value="classic">Classic</MenuItem>
                    <MenuItem value="modern">Modern</MenuItem>
                    <MenuItem value="minimal">Minimal</MenuItem>
                    <MenuItem value="creative">Creative</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Dialog>
  );
};

export default InvoiceBuilder;
