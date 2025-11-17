'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

// Standard audiogram frequencies (Hz)
const FREQUENCIES = [125, 250, 500, 1000, 2000, 4000, 8000];
const HEARING_LEVELS = Array.from({ length: 14 }, (_, i) => (i - 1) * 10); // -10 to 120 dB HL

interface AudiogramData {
  rightAirConduction: (number | null)[]; // 7 values for 7 frequencies
  leftAirConduction: (number | null)[];  // 7 values for 7 frequencies
  rightBoneConduction: (number | null)[]; // 7 values for 7 frequencies
  leftBoneConduction: (number | null)[];  // 7 values for 7 frequencies
  rightMasking: boolean[];
  leftMasking: boolean[];
  notes?: string;
}

interface PureToneAudiogramProps {
  data?: AudiogramData;
  onChange: (data: AudiogramData) => void;
  editable: boolean;
  readOnly?: boolean;
}

const PureToneAudiogram: React.FC<PureToneAudiogramProps> = ({
  data,
  onChange,
  editable,
  readOnly = false
}) => {
  // Helper function to validate and normalize audiogram data
  const normalizeAudiogramData = (rawData: any): AudiogramData => {
    if (!rawData || typeof rawData !== 'object') {
      return {
        rightAirConduction: Array(7).fill(null),
        leftAirConduction: Array(7).fill(null),
        rightBoneConduction: Array(7).fill(null),
        leftBoneConduction: Array(7).fill(null),
        rightMasking: Array(7).fill(false),
        leftMasking: Array(7).fill(false),
        notes: ''
      };
    }

    const normalizeArray = (arr: any, length: number, defaultValue: any = null): any[] => {
      if (!Array.isArray(arr)) return Array(length).fill(defaultValue);
      return arr.slice(0, length).map((v: any) => {
        if (v === null || v === undefined) return null;
        const num = typeof v === 'number' ? v : parseFloat(v);
        return isNaN(num) ? null : num;
      }).concat(Array(Math.max(0, length - arr.length)).fill(defaultValue));
    };

    const normalizeBooleanArray = (arr: any, length: number): boolean[] => {
      if (!Array.isArray(arr)) return Array(length).fill(false);
      return arr.slice(0, length).map((v: any) => Boolean(v)).concat(Array(Math.max(0, length - arr.length)).fill(false));
    };

    return {
      rightAirConduction: normalizeArray(rawData.rightAirConduction, 7, null),
      leftAirConduction: normalizeArray(rawData.leftAirConduction, 7, null),
      rightBoneConduction: normalizeArray(rawData.rightBoneConduction, 7, null),
      leftBoneConduction: normalizeArray(rawData.leftBoneConduction, 7, null),
      rightMasking: normalizeBooleanArray(rawData.rightMasking, 7),
      leftMasking: normalizeBooleanArray(rawData.leftMasking, 7),
      notes: typeof rawData.notes === 'string' ? rawData.notes : ''
    };
  };

  const [isEditing, setIsEditing] = useState(false);
  const [localData, setLocalData] = useState<AudiogramData>(() => {
    try {
      return normalizeAudiogramData(data);
    } catch (err) {
      console.error('Error normalizing audiogram data:', err);
      return {
        rightAirConduction: Array(7).fill(null),
        leftAirConduction: Array(7).fill(null),
        rightBoneConduction: Array(7).fill(null),
        leftBoneConduction: Array(7).fill(null),
        rightMasking: Array(7).fill(false),
        leftMasking: Array(7).fill(false),
        notes: ''
      };
    }
  });

  useEffect(() => {
    try {
      if (data) {
        setLocalData(normalizeAudiogramData(data));
      } else {
        setLocalData({
          rightAirConduction: Array(7).fill(null),
          leftAirConduction: Array(7).fill(null),
          rightBoneConduction: Array(7).fill(null),
          leftBoneConduction: Array(7).fill(null),
          rightMasking: Array(7).fill(false),
          leftMasking: Array(7).fill(false),
          notes: ''
        });
      }
    } catch (err) {
      console.error('Error updating audiogram data:', err);
    }
  }, [data]);

  const handleSave = () => {
    onChange(localData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (data) {
      setLocalData({ ...data });
    } else {
      setLocalData({
        rightAirConduction: Array(7).fill(null),
        leftAirConduction: Array(7).fill(null),
        rightBoneConduction: Array(7).fill(null),
        leftBoneConduction: Array(7).fill(null),
        rightMasking: Array(7).fill(false),
        leftMasking: Array(7).fill(false),
        notes: ''
      });
    }
    setIsEditing(false);
  };

  const updateValue = (
    ear: 'right' | 'left',
    type: 'air' | 'bone',
    frequencyIndex: number,
    value: string
  ) => {
    const numValue = value === '' ? null : parseFloat(value);
    if (numValue !== null && (numValue < -10 || numValue > 120)) {
      return; // Invalid range
    }

    setLocalData(prev => {
      const newData = { ...prev };
      const key = `${ear}${type === 'air' ? 'Air' : 'Bone'}Conduction` as keyof AudiogramData;
      const array = [...(newData[key] as (number | null)[])] as (number | null)[];
      array[frequencyIndex] = numValue;
      newData[key] = array as any;
      return newData;
    });
  };

  const toggleMasking = (ear: 'right' | 'left', frequencyIndex: number) => {
    setLocalData(prev => {
      const newData = { ...prev };
      const key = `${ear}Masking` as keyof AudiogramData;
      const array = [...(newData[key] as boolean[])];
      array[frequencyIndex] = !array[frequencyIndex];
      newData[key] = array as any;
      return newData;
    });
  };

  const clearEar = (ear: 'right' | 'left') => {
    setLocalData(prev => ({
      ...prev,
      [`${ear}AirConduction`]: Array(7).fill(null),
      [`${ear}BoneConduction`]: Array(7).fill(null),
      [`${ear}Masking`]: Array(7).fill(false)
    }));
  };

  // Calculate grid positions for plotting
  const getXPosition = (frequencyIndex: number, width: number) => {
    // Logarithmic scale for frequencies
    const logFreqs = FREQUENCIES.map(f => Math.log10(f));
    const minLog = logFreqs[0];
    const maxLog = logFreqs[logFreqs.length - 1];
    const logFreq = logFreqs[frequencyIndex];
    return ((logFreq - minLog) / (maxLog - minLog)) * width;
  };

  const getYPosition = (dbHL: number, height: number) => {
    // dB HL from -10 to 120
    const minDB = -10;
    const maxDB = 120;
    return ((dbHL - minDB) / (maxDB - minDB)) * height;
  };

  const hasData = () => {
    return localData.rightAirConduction.some(v => v !== null) ||
           localData.leftAirConduction.some(v => v !== null) ||
           localData.rightBoneConduction.some(v => v !== null) ||
           localData.leftBoneConduction.some(v => v !== null);
  };

  const renderSingleAudiogram = (ear: 'right' | 'left', earColor: string) => {
    const width = 420;
    const height = 600;
    const margin = { top: 60, right: 30, bottom: 80, left: 70 };
    const plotWidth = width;
    const plotHeight = height;
    
    // Make the SVG responsive but maintain aspect ratio
    const svgWidth = plotWidth + margin.left + margin.right;
    const svgHeight = plotHeight + margin.top + margin.bottom;

    const airConduction = ear === 'right' ? localData.rightAirConduction : localData.leftAirConduction;
    const boneConduction = ear === 'right' ? localData.rightBoneConduction : localData.leftBoneConduction;
    const masking = ear === 'right' ? localData.rightMasking : localData.leftMasking;

    return (
      <Box sx={{ 
        position: 'relative', 
        width: '100%',
        maxWidth: '100%',
        bgcolor: '#ffffff',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        p: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Box sx={{ 
          width: '100%', 
          maxWidth: `${svgWidth}px`,
          overflow: 'auto'
        }}>
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: 'block', fontFamily: 'Arial, sans-serif', width: '100%', height: 'auto' }}
            preserveAspectRatio="xMidYMid meet"
          >
          {/* Background */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="#fafafa"
            stroke="#d0d0d0"
            strokeWidth={2}
          />

          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Major grid lines for frequencies (thicker) */}
            {FREQUENCIES.map((freq, idx) => {
              const x = getXPosition(idx, plotWidth);
              return (
                <line
                  key={`freq-major-${freq}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={plotHeight}
                  stroke="#c0c0c0"
                  strokeWidth={1.5}
                  strokeDasharray="none"
                />
              );
            })}

            {/* Minor grid lines for frequencies */}
            {FREQUENCIES.map((freq, idx) => {
              if (idx === FREQUENCIES.length - 1) return null;
              const x1 = getXPosition(idx, plotWidth);
              const x2 = getXPosition(idx + 1, plotWidth);
              const midX = (x1 + x2) / 2;
              return (
                <line
                  key={`freq-minor-${freq}`}
                  x1={midX}
                  y1={0}
                  x2={midX}
                  y2={plotHeight}
                  stroke="#e8e8e8"
                  strokeWidth={0.5}
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Major grid lines for hearing levels (thicker) */}
            {HEARING_LEVELS.filter((_, i) => i % 2 === 0).map(db => {
              const y = getYPosition(db, plotHeight);
              return (
                <line
                  key={`db-major-${db}`}
                  x1={0}
                  y1={y}
                  x2={plotWidth}
                  y2={y}
                  stroke="#c0c0c0"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Minor grid lines for hearing levels */}
            {HEARING_LEVELS.filter((_, i) => i % 2 === 1).map(db => {
              const y = getYPosition(db, plotHeight);
              return (
                <line
                  key={`db-minor-${db}`}
                  x1={0}
                  y1={y}
                  x2={plotWidth}
                  y2={y}
                  stroke="#e8e8e8"
                  strokeWidth={0.5}
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Hearing level zones */}
            <rect x={0} y={getYPosition(0, plotHeight)} width={plotWidth} height={getYPosition(-10, plotHeight) - getYPosition(0, plotHeight)} fill="#e8f5e9" opacity={0.3} />
            <rect x={0} y={getYPosition(26, plotHeight)} width={plotWidth} height={getYPosition(0, plotHeight) - getYPosition(26, plotHeight)} fill="#fff9c4" opacity={0.3} />
            <rect x={0} y={getYPosition(41, plotHeight)} width={plotWidth} height={getYPosition(26, plotHeight) - getYPosition(41, plotHeight)} fill="#ffe082" opacity={0.3} />
            <rect x={0} y={getYPosition(56, plotHeight)} width={plotWidth} height={getYPosition(41, plotHeight) - getYPosition(56, plotHeight)} fill="#ffcc80" opacity={0.3} />
            <rect x={0} y={getYPosition(71, plotHeight)} width={plotWidth} height={getYPosition(56, plotHeight) - getYPosition(71, plotHeight)} fill="#ffab91" opacity={0.3} />
            <rect x={0} y={getYPosition(91, plotHeight)} width={plotWidth} height={getYPosition(71, plotHeight) - getYPosition(91, plotHeight)} fill="#ef9a9a" opacity={0.3} />

            {/* Frequency labels with better styling */}
            {FREQUENCIES.map((freq, idx) => {
              const x = getXPosition(idx, plotWidth);
              return (
                <g key={`freq-label-${freq}`}>
                  <text
                    x={x}
                    y={plotHeight + 35}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill="#333"
                  >
                    {freq}
                  </text>
                  <text
                    x={x}
                    y={plotHeight + 50}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#666"
                  >
                    Hz
                  </text>
                </g>
              );
            })}

            {/* Hearing level labels with better styling */}
            {HEARING_LEVELS.filter((_, i) => i % 2 === 0).map(db => {
              const y = getYPosition(db, plotHeight);
              return (
                <g key={`db-label-${db}`}>
                  <line
                    x1={-5}
                    y1={y}
                    x2={0}
                    y2={y}
                    stroke="#666"
                    strokeWidth={2}
                  />
                  <text
                    x={-15}
                    y={y + 5}
                    textAnchor="end"
                    fontSize="13"
                    fontWeight="600"
                    fill="#333"
                  >
                    {db}
                  </text>
                </g>
              );
            })}

            {/* Connect bone conduction points with dotted lines (drawn first, behind symbols) */}
            {boneConduction.filter(v => v !== null).length > 1 && (() => {
              const points = boneConduction
                .map((value, idx) => {
                  if (value === null) return null;
                  const x = getXPosition(idx, plotWidth);
                  const y = getYPosition(value, plotHeight);
                  return { x, y };
                })
                .filter((p): p is { x: number; y: number } => p !== null);
              
              if (points.length < 2) return null;
              
              // Create a simple polyline for bone conduction (dotted)
              const pathPoints = points.map(p => `${p.x},${p.y}`).join(' ');
              
              return (
                <polyline
                  points={pathPoints}
                  fill="none"
                  stroke={earColor}
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  opacity={0.8}
                />
              );
            })()}

            {/* Connect air conduction points with smooth curve */}
            {airConduction.filter(v => v !== null).length > 1 && (() => {
              const points = airConduction
                .map((value, idx) => {
                  if (value === null) return null;
                  const x = getXPosition(idx, plotWidth);
                  const y = getYPosition(value, plotHeight);
                  return { x, y };
                })
                .filter((p): p is { x: number; y: number } => p !== null);
              
              if (points.length < 2) return null;
              
              let path = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const next = points[i + 1] || curr;
                const cp1x = prev.x + (curr.x - prev.x) / 3;
                const cp1y = prev.y;
                const cp2x = curr.x - (next.x - curr.x) / 3;
                const cp2y = curr.y;
                path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
              }
              
              return (
                <path
                  d={path}
                  fill="none"
                  stroke={earColor}
                  strokeWidth={2}
                  strokeDasharray="5,3"
                  opacity={0.6}
                />
              );
            })()}

            {/* Air conduction symbols */}
            {airConduction.map((value, idx) => {
              if (value === null) return null;
              const x = getXPosition(idx, plotWidth);
              const y = getYPosition(value, plotHeight);
              return (
                <g key={`${ear}-air-${idx}`}>
                  {ear === 'right' ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={8}
                      fill="#ffffff"
                      stroke={earColor}
                      strokeWidth={3}
                    />
                  ) : (
                    <>
                      <line
                        x1={x - 7}
                        y1={y - 7}
                        x2={x + 7}
                        y2={y + 7}
                        stroke={earColor}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                      <line
                        x1={x - 7}
                        y1={y + 7}
                        x2={x + 7}
                        y2={y - 7}
                        stroke={earColor}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {masking[idx] && (
                    <text
                      x={x + 12}
                      y={y + 4}
                      fontSize="11"
                      fontWeight="bold"
                      fill={earColor}
                    >
                      [M]
                    </text>
                  )}
                </g>
              );
            })}

            {/* Bone conduction symbols */}
            {boneConduction.map((value, idx) => {
              if (value === null) return null;
              const x = getXPosition(idx, plotWidth);
              const y = getYPosition(value, plotHeight);
              return (
                <g key={`${ear}-bone-${idx}`}>
                  <path
                    d={ear === 'right' 
                      ? `M ${x} ${y} L ${x - 6} ${y + 8} L ${x + 6} ${y + 8} Z`
                      : `M ${x} ${y} L ${x - 6} ${y - 8} L ${x + 6} ${y - 8} Z`}
                    fill={earColor}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}

            {/* Axis labels - professional styling */}
            <text
              x={plotWidth / 2}
              y={plotHeight + 70}
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#1a1a1a"
              letterSpacing="0.5px"
            >
              Frequency (Hz)
            </text>
            <text
              x={-45}
              y={plotHeight / 2}
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#1a1a1a"
              letterSpacing="0.5px"
              transform={`rotate(-90, -45, ${plotHeight / 2})`}
            >
              Hearing Level (dB HL)
            </text>

            {/* Title */}
            <text
              x={plotWidth / 2}
              y={-25}
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#1a1a1a"
            >
              {ear === 'right' ? 'Right Ear' : 'Left Ear'}
            </text>
          </g>
        </svg>
        </Box>
      </Box>
    );
  };

  const renderAudiogram = () => {
    return (
      <Box sx={{ 
        position: 'relative', 
        width: '100%', 
        overflow: 'auto',
        bgcolor: '#ffffff',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        p: 2
      }}>
        <Grid 
          container 
          spacing={3} 
          sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'stretch'
          }}
        >
          {/* Right Ear Audiogram */}
          <Grid 
            item 
            xs={12} 
            sm={6} 
            md={6} 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              minWidth: 0 // Prevent overflow
            }}
          >
            {renderSingleAudiogram('right', '#d32f2f')}
          </Grid>
          
          {/* Left Ear Audiogram */}
          <Grid 
            item 
            xs={12} 
            sm={6} 
            md={6} 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              minWidth: 0 // Prevent overflow
            }}
          >
            {renderSingleAudiogram('left', '#1976d2')}
          </Grid>
        </Grid>

        {/* Professional Legend */}
        <Box sx={{ 
          mt: 3, 
          p: 2, 
          bgcolor: '#f5f5f5', 
          borderRadius: 2,
          border: '1px solid #e0e0e0'
        }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#333' }}>
            Legend
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ 
                    width: 24, 
                    height: 24, 
                    border: '3px solid #d32f2f', 
                    borderRadius: '50%',
                    bgcolor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Right Air</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '10px solid #d32f2f',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Right Bone</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ 
                    width: 24, 
                    height: 24, 
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '16px',
                      height: '3px',
                      bgcolor: '#1976d2',
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '16px',
                      height: '3px',
                      bgcolor: '#1976d2',
                      transform: 'translate(-50%, -50%) rotate(-45deg)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }
                  }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Left Air</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderBottom: '10px solid #1976d2',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Left Bone</Typography>
                </Box>
                <Chip 
                  label="[M] = Masked" 
                  size="small" 
                  variant="outlined" 
                  sx={{ 
                    fontWeight: 500,
                    borderColor: '#999',
                    color: '#666'
                  }} 
                />
              </Box>
            </Grid>
          </Grid>
          
          {/* Hearing Level Zones Legend */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#666', mb: 1, display: 'block' }}>
              Hearing Level Zones:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip label="Normal (-10 to 25 dB)" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 500 }} />
              <Chip label="Mild (26 to 40 dB)" size="small" sx={{ bgcolor: '#fff9c4', color: '#f57f17', fontWeight: 500 }} />
              <Chip label="Moderate (41 to 55 dB)" size="small" sx={{ bgcolor: '#ffe082', color: '#f9a825', fontWeight: 500 }} />
              <Chip label="Moderately Severe (56 to 70 dB)" size="small" sx={{ bgcolor: '#ffcc80', color: '#ef6c00', fontWeight: 500 }} />
              <Chip label="Severe (71 to 90 dB)" size="small" sx={{ bgcolor: '#ffab91', color: '#d84315', fontWeight: 500 }} />
              <Chip label="Profound (91+ dB)" size="small" sx={{ bgcolor: '#ef9a9a', color: '#c62828', fontWeight: 500 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  // Always show the component - staff/admin can view even if no data exists
  // Only hide if it's truly read-only, not editable, AND no data AND not in a hearing test context
  // For now, always show if there's any data or if it's editable
  // if (readOnly && !editable && !hasData()) {
  //   return null;
  // }

  return (
    <Paper sx={{ 
      p: 3, 
      mt: 2, 
      bgcolor: '#ffffff',
      borderRadius: 3,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0'
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        pb: 2,
        borderBottom: '2px solid #e0e0e0'
      }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.5 }}>
            Pure Tone Audiogram (PTA)
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', fontSize: '0.85rem' }}>
            Standard audiometric assessment with air and bone conduction thresholds
          </Typography>
        </Box>
        {editable && !readOnly && (
          <Box>
            {!isEditing ? (
              <Button
                startIcon={<EditIcon />}
                onClick={() => setIsEditing(true)}
                variant="outlined"
                size="small"
              >
                Edit Audiogram
              </Button>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  variant="contained"
                  color="primary"
                  size="small"
                >
                  Save
                </Button>
                <Button
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  variant="outlined"
                  size="small"
                >
                  Cancel
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {isEditing && editable ? (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter hearing thresholds in dB HL (-10 to 120). Leave blank if not tested.
          </Alert>

          <Grid container spacing={2}>
            {/* Right Ear */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: '#ffebee' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#d32f2f' }}>
                    Right Ear (Red)
                  </Typography>
                  <Button size="small" onClick={() => clearEar('right')} color="error">
                    Clear
                  </Button>
                </Box>

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Air Conduction
                </Typography>
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {FREQUENCIES.map((freq, idx) => (
                    <Grid item xs={6} sm={4} key={`right-air-${freq}`}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`${freq} Hz`}
                        type="number"
                        value={localData.rightAirConduction[idx] ?? ''}
                        onChange={(e) => updateValue('right', 'air', idx, e.target.value)}
                        inputProps={{ min: -10, max: 120, step: 5 }}
                        InputProps={{
                          endAdornment: (
                            <Tooltip title="Masking">
                              <IconButton
                                size="small"
                                onClick={() => toggleMasking('right', idx)}
                                sx={{
                                  bgcolor: localData.rightMasking[idx] ? 'primary.main' : 'transparent',
                                  color: localData.rightMasking[idx] ? 'white' : 'inherit',
                                  '&:hover': { bgcolor: localData.rightMasking[idx] ? 'primary.dark' : 'action.hover' }
                                }}
                              >
                                M
                              </IconButton>
                            </Tooltip>
                          )
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Bone Conduction
                </Typography>
                <Grid container spacing={1}>
                  {FREQUENCIES.map((freq, idx) => (
                    <Grid item xs={6} sm={4} key={`right-bone-${freq}`}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`${freq} Hz`}
                        type="number"
                        value={localData.rightBoneConduction[idx] ?? ''}
                        onChange={(e) => updateValue('right', 'bone', idx, e.target.value)}
                        inputProps={{ min: -10, max: 120, step: 5 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>

            {/* Left Ear */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1976d2' }}>
                    Left Ear (Blue)
                  </Typography>
                  <Button size="small" onClick={() => clearEar('left')} color="primary">
                    Clear
                  </Button>
                </Box>

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Air Conduction
                </Typography>
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {FREQUENCIES.map((freq, idx) => (
                    <Grid item xs={6} sm={4} key={`left-air-${freq}`}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`${freq} Hz`}
                        type="number"
                        value={localData.leftAirConduction[idx] ?? ''}
                        onChange={(e) => updateValue('left', 'air', idx, e.target.value)}
                        inputProps={{ min: -10, max: 120, step: 5 }}
                        InputProps={{
                          endAdornment: (
                            <Tooltip title="Masking">
                              <IconButton
                                size="small"
                                onClick={() => toggleMasking('left', idx)}
                                sx={{
                                  bgcolor: localData.leftMasking[idx] ? 'primary.main' : 'transparent',
                                  color: localData.leftMasking[idx] ? 'white' : 'inherit',
                                  '&:hover': { bgcolor: localData.leftMasking[idx] ? 'primary.dark' : 'action.hover' }
                                }}
                              >
                                M
                              </IconButton>
                            </Tooltip>
                          )
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Bone Conduction
                </Typography>
                <Grid container spacing={1}>
                  {FREQUENCIES.map((freq, idx) => (
                    <Grid item xs={6} sm={4} key={`left-bone-${freq}`}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`${freq} Hz`}
                        type="number"
                        value={localData.leftBoneConduction[idx] ?? ''}
                        onChange={(e) => updateValue('left', 'bone', idx, e.target.value)}
                        inputProps={{ min: -10, max: 120, step: 5 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Audiogram Notes"
                value={localData.notes || ''}
                onChange={(e) => setLocalData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about the audiogram..."
              />
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box>
          {hasData() ? (
            <>
              {renderAudiogram()}
              {localData.notes && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    <strong>Notes:</strong> {localData.notes}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <>
              {renderAudiogram()}
              <Alert severity="info" sx={{ mt: 2 }}>
                No audiogram data available. {editable && !readOnly && 'Click "Edit Audiogram" to add data.'}
              </Alert>
            </>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default PureToneAudiogram;

