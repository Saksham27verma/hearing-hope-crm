'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { ENQUIRIES_OPTION_CATEGORIES } from '@/lib/field-options/enquiriesCatalog';
import EnquiryFieldOptionEditor from './EnquiryFieldOptionEditor';

export default function FieldOptionsSettings() {
  const [expandedCat, setExpandedCat] = useState<string | false>('enquiry-core');
  const [expandedField, setExpandedField] = useState<string | false>(false);

  const totalFields = useMemo(
    () => ENQUIRIES_OPTION_CATEGORIES.reduce((n, c) => n + c.fields.length, 0),
    []
  );

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Enquiries — all dropdown / choice fields
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.6 }}>
          Each section lists where the field is used in the CRM and the built-in options. Expand a field to sync those options
          to Firestore, rename labels, turn options off, reorder, or add new ones. Stored <strong>values</strong> stay on your
          enquiry documents; only labels are safe to change anytime.
        </Typography>
        <Chip size="small" label={`${totalFields} fields documented`} variant="outlined" />
      </Paper>

      {ENQUIRIES_OPTION_CATEGORIES.map((cat) => (
        <Paper
          key={cat.id}
          elevation={0}
          sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
        >
          <Accordion
            expanded={expandedCat === cat.id}
            onChange={(_, exp) => setExpandedCat(exp ? cat.id : false)}
            disableGutters
            elevation={0}
            slotProps={{ transition: { unmountOnExit: true, timeout: 200 } }}
            sx={{ '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {cat.title}
                </Typography>
                {cat.subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {cat.subtitle}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {cat.fields.length} field{cat.fields.length === 1 ? '' : 's'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
              <Stack spacing={1}>
                {cat.fields.map((field) => {
                  const fid = `${cat.id}__${field.fieldKey}`;
                  const optCount = field.defaults.length;
                  return (
                    <Accordion
                      key={field.fieldKey}
                      expanded={expandedField === fid}
                      onChange={(_, exp) => setExpandedField(exp ? fid : false)}
                      disableGutters
                      elevation={0}
                      slotProps={{ transition: { unmountOnExit: true, timeout: 200 } }}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        '&:before': { display: 'none' },
                        overflow: 'hidden',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'action.hover', px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography fontWeight={600}>{field.displayName}</Typography>
                          <Chip size="small" label={`${optCount} options`} />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 2, pb: 2 }}>
                        <EnquiryFieldOptionEditor
                          fieldKey={field.fieldKey}
                          displayName={field.displayName}
                          usedIn={field.usedIn}
                        />
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Paper>
      ))}
    </Stack>
  );
}
