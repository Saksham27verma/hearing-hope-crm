'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  InputAdornment,
  Typography,
  Stack,
  Tooltip,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  FileDownloadOutlined as FileDownloadOutlinedIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  PictureAsPdf as PictureAsPdfIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';

interface SalesInvoicingCommandBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  onCreateInvoice: () => void;
  filterCount?: number;
  onExportPdfLedger?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  exportDisabled?: boolean;
  exportPdfLoading?: boolean;
  exportExcelLoading?: boolean;
}

export default function SalesInvoicingCommandBar({
  searchValue,
  onSearchChange,
  onOpenFilters,
  onCreateInvoice,
  filterCount = 0,
  onExportPdfLedger,
  onExportExcel,
  exportDisabled = false,
  exportPdfLoading = false,
  exportExcelLoading = false,
}: SalesInvoicingCommandBarProps) {
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const exportOpen = Boolean(exportMenuAnchor);
  const exportLoading = exportPdfLoading || exportExcelLoading;
  const showExport = Boolean(onExportPdfLedger || onExportExcel);

  return (
    <Box
      sx={{
        mb: 3,
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 24px rgba(15, 23, 42, 0.06)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box sx={{ flex: 1, maxWidth: { md: 'min(560px, 100%)' }, mx: { md: 'auto' }, width: '100%' }}>
          <TextField
            fullWidth
            placeholder="Search invoice #, client, or enquiry ID…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            size="medium"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'grey.50' },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block', textAlign: { xs: 'left', md: 'center' } }}>
            Press <kbd style={{ padding: '2px 6px', borderRadius: 4, background: '#E2E8F0' }}>⌘K</kbd> or{' '}
            <kbd style={{ padding: '2px 6px', borderRadius: 4, background: '#E2E8F0' }}>Ctrl+K</kbd> for quick search
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" justifyContent={{ xs: 'stretch', md: 'flex-end' }}>
          {showExport && (
            <>
              <Tooltip
                title="Export the same invoices shown in the table (after filters). PDF: formal ledger for your CA. Excel: editable workbook."
                arrow
                placement="top"
              >
                <span>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={
                      exportLoading ? (
                        <CircularProgress size={18} thickness={5} sx={{ color: 'primary.main' }} />
                      ) : (
                        <FileDownloadOutlinedIcon />
                      )
                    }
                    endIcon={<KeyboardArrowDownIcon />}
                    disabled={exportDisabled || exportLoading}
                    onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                    sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                  >
                    Export
                  </Button>
                </span>
              </Tooltip>
              <Menu
                anchorEl={exportMenuAnchor}
                open={exportOpen}
                onClose={() => setExportMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 280, mt: 0.5 } } }}
              >
                {onExportPdfLedger && (
                  <MenuItem
                    disabled={exportPdfLoading || exportExcelLoading}
                    onClick={() => {
                      setExportMenuAnchor(null);
                      void onExportPdfLedger();
                    }}
                  >
                    <ListItemIcon>
                      <PictureAsPdfIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="PDF ledger (recommended)"
                      secondary="Hope Digital Innovations Pvt Ltd letterhead, GST summary, lines, payments"
                      primaryTypographyProps={{ fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption', sx: { whiteSpace: 'normal' } }}
                    />
                  </MenuItem>
                )}
                {onExportExcel && (
                  <MenuItem
                    disabled={exportPdfLoading || exportExcelLoading}
                    onClick={() => {
                      setExportMenuAnchor(null);
                      void onExportExcel();
                    }}
                  >
                    <ListItemIcon>
                      <TableChartIcon color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Excel workbook"
                      secondary="Multi-sheet register for analysis"
                      primaryTypographyProps={{ fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<FilterIcon />}
            onClick={onOpenFilters}
            sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary' }}
          >
            Filters
            {filterCount > 0 ? ` (${filterCount})` : ''}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateInvoice} sx={{ borderRadius: 2, px: 2.5, boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)' }}>
            Create New Invoice
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
