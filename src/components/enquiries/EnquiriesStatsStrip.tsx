import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export type EnquiryStatCard = {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
};

type Props = {
  stats: EnquiryStatCard[];
};

export default function EnquiriesStatsStrip({ stats }: Props) {
  return (
    <Grid container spacing={{ xs: 1.5, sm: 2 }}>
      {stats.map((stat) => (
        <Grid item xs={12} sm={6} md={2.4} key={stat.title}>
          <Paper
            elevation={0}
            sx={{
              p: 2.2,
              height: '100%',
              borderRadius: 3,
              border: '1px solid',
              borderColor: (t) => alpha(stat.color, t.palette.mode === 'dark' ? 0.35 : 0.22),
              bgcolor: (t) =>
                t.palette.mode === 'dark'
                  ? alpha(t.palette.background.paper, 0.96)
                  : alpha('#ffffff', 0.95),
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 10px 24px ${alpha(stat.color, 0.18)}`,
                borderColor: alpha(stat.color, 0.5),
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: alpha(stat.color, 0.12),
                  color: stat.color,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {stat.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.05, color: stat.color }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {stat.title}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
