'use client';

import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChecklistIcon from '@mui/icons-material/Checklist';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import type { AppointmentCheckoutDraft } from '@/lib/visitCompliance/types';

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, displayTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

function yn(v: boolean | undefined | null) {
  if (v == null) return '—';
  return v ? 'Yes' : 'No';
}

type Props = {
  draft?: AppointmentCheckoutDraft | null;
};

export default function CheckoutDraftSummary({ draft }: Props) {
  if (!draft) {
    return (
      <Typography variant="body2" color="text.secondary">
        Staff has not saved checkout details yet.
      </Typography>
    );
  }

  const services = draft.services;
  const commerce = draft.commerce;
  const form = draft.compliance_form_data;
  const gps = draft.gps_location;

  const hasServices =
    Boolean(services?.hearingTest || services?.accessory || services?.programming || services?.counselling) ||
    draft.servicesSkipped;
  const hasCommerce = Boolean(commerce) || draft.commerceSkipped;

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        Confirm these details with the patient before generating the PIN
      </Typography>

      <Accordion
        disableGutters
        defaultExpanded
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MedicalServicesIcon fontSize="small" color="primary" />
            <Typography sx={{ fontWeight: 700 }}>Visit services</Typography>
            {draft.servicesSkipped ? <Chip size="small" label="Skipped / not needed" /> : null}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {!hasServices ? (
            <Typography variant="body2" color="text.secondary">No services recorded.</Typography>
          ) : draft.servicesSkipped && !services ? (
            <Typography variant="body2">Staff marked services as not needed.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {services?.hearingTest ? (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>Hearing test</Typography>
                  <Row
                    label="Types"
                    value={(services.hearingTest.hearingTestEntries || [])
                      .map((e) => `${e.testType}${e.price ? ` (₹${e.price})` : ''}`)
                      .join(', ')}
                  />
                  <Row label="Done by" value={services.hearingTest.testDoneBy} />
                  <Row label="Results" value={services.hearingTest.testResults} />
                  <Row label="Recommendations" value={services.hearingTest.recommendations} />
                </Box>
              ) : null}
              {services?.accessory ? (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>Accessory</Typography>
                  <Row label="Name" value={services.accessory.accessoryName} />
                  <Row
                    label="Amount"
                    value={
                      services.accessory.accessoryFOC
                        ? 'FOC'
                        : services.accessory.accessoryAmount != null
                          ? `₹${services.accessory.accessoryAmount}`
                          : undefined
                    }
                  />
                  <Row label="Qty" value={services.accessory.accessoryQuantity} />
                  <Row label="Details" value={services.accessory.accessoryDetails} />
                </Box>
              ) : null}
              {services?.programming ? (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>Programming</Typography>
                  <Row label="Hearing aid" value={services.programming.hearingAidName} />
                  <Row label="Done by" value={services.programming.programmingDoneBy} />
                  <Row
                    label="Amount"
                    value={
                      services.programming.programmingAmount != null
                        ? `₹${services.programming.programmingAmount}`
                        : undefined
                    }
                  />
                  <Row label="Reason" value={services.programming.programmingReason} />
                </Box>
              ) : null}
              {services?.counselling ? (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>Counselling</Typography>
                  <Row label="Notes" value={services.counselling.notes} />
                </Box>
              ) : null}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        defaultExpanded
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PointOfSaleIcon fontSize="small" color="secondary" />
            <Typography sx={{ fontWeight: 700 }}>Booking / trial / sale</Typography>
            {draft.commerceSkipped ? <Chip size="small" label="Skipped / not needed" /> : null}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {!hasCommerce ? (
            <Typography variant="body2" color="text.secondary">Nothing staged yet.</Typography>
          ) : draft.commerceSkipped && !commerce ? (
            <Typography variant="body2">Staff marked booking/trial/sale as not needed for this visit.</Typography>
          ) : commerce ? (
            <Stack spacing={0.5}>
              <Row label="Type" value={String(commerce.receiptType || '').toUpperCase()} />
              <Row label="Amount collected" value={`₹${Number(commerce.amount || 0).toLocaleString('en-IN')}`} />
              <Row label="Payment mode" value={String(commerce.paymentMode || '').toUpperCase()} />
              {(commerce.summaryLines || []).map((line, i) => (
                <Typography key={i} variant="body2" sx={{ fontWeight: 600 }}>
                  • {line}
                </Typography>
              ))}
            </Stack>
          ) : null}
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ChecklistIcon fontSize="small" />
            <Typography sx={{ fontWeight: 700 }}>Checkout form</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {form ? (
            <Stack spacing={0.25}>
              <Row label="Wearing ID / uniform / bag" value={yn(form.wearingIdUniformBag)} />
              <Row label="Shared personal contact" value={yn(form.sharedPersonalContact)} />
              <Row label="FOC home visits committed" value={String(form.focHomeVisitsCommitted ?? 0)} />
              <Row
                label="Free battery boxes"
                value={
                  form.freeBatteryBoxesCommitted
                    ? `Yes${form.freeBatteryBoxesQty != null ? ` (${form.freeBatteryBoxesQty})` : ''}`
                    : 'No'
                }
              />
              <Row label="Explained accessories charges" value={yn(form.explainedAccessoriesCharges)} />
              <Row label="Explained warranty" value={yn(form.explainedWarranty)} />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">Checklist not saved yet.</Typography>
          )}
          {draft.feedback ? (
            <>
              <Divider sx={{ my: 1.25 }} />
              <Row label="Staff feedback" value={draft.feedback} />
            </>
          ) : null}
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MyLocationIcon fontSize="small" color="primary" />
            <Typography sx={{ fontWeight: 700 }}>GPS</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {gps ? (
            <Stack spacing={0.5}>
              <Row
                label="Coordinates"
                value={`${Number(gps.lat).toFixed(6)}, ${Number(gps.lng).toFixed(6)}`}
              />
              <Row
                label="Accuracy"
                value={gps.accuracy != null ? `${gps.accuracy} m` : undefined}
              />
              <Row label="Captured at" value={gps.capturedAt} />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">GPS not captured yet.</Typography>
          )}
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
