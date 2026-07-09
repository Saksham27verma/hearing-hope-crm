'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Avatar,
  Chip,
  Skeleton,
  Alert,
  Button,
} from '@mui/material';
import { Business as BusinessIcon, ArrowForward as ArrowIcon } from '@mui/icons-material';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import { businessCompanyChipColor } from '@/utils/businessCompanies';

export default function AccountingLandingPage() {
  const router = useRouter();
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    reloadCompanies,
  } = useAccountingCompany();

  useEffect(() => {
    void reloadCompanies();
  }, [reloadCompanies]);

  const handlePick = (id: string) => {
    setSelectedCompanyId(id);
    router.push('/accounting/dashboard');
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Accounting
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select the company you want to manage accounting for. All invoices, payments and ledgers are scoped to it.
          </Typography>
        </Box>
        {selectedCompanyId && (
          <Button variant="contained" endIcon={<ArrowIcon />} onClick={() => router.push('/accounting/dashboard')}>
            Continue with current
          </Button>
        )}
      </Stack>

      {companiesLoading ? (
        <Grid container spacing={2}>
          {[0, 1].map((k) => (
            <Grid item xs={12} md={6} key={k}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        </Grid>
      ) : companies.length === 0 ? (
        <Alert severity="info">
          No business companies found. Please add one in the Companies module first.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {companies.map((c) => {
            const color = businessCompanyChipColor(c.name);
            const isSelected = c.id === selectedCompanyId;
            return (
              <Grid item xs={12} md={6} key={c.id}>
                <Card
                  variant={isSelected ? 'elevation' : 'outlined'}
                  elevation={isSelected ? 4 : 0}
                  sx={{
                    borderColor: isSelected ? color : undefined,
                    borderWidth: isSelected ? 2 : 1,
                    borderStyle: 'solid',
                  }}
                >
                  <CardActionArea onClick={() => handlePick(c.id)}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
                          <BusinessIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h6" fontWeight={700} noWrap>
                            {c.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Manage invoices, payments and ledgers
                          </Typography>
                          {isSelected && (
                            <Chip label="Currently selected" size="small" sx={{ mt: 1 }} color="primary" />
                          )}
                        </Box>
                        <ArrowIcon color="action" />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
