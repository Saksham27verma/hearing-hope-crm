'use client';

import React, { useMemo, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Popover,
  List,
  ListItemButton,
  ListSubheader,
  InputAdornment,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Tune as TuneIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import { ENQUIRY_STATUS_OPTIONS } from '@/utils/enquiryStatus';
import {
  ENQUIRY_FILTER_FIELD_GROUPS,
  flatFilterFields,
  operatorsByType,
  getFieldMeta,
  REFERENCE_OPTION_OBJECTS,
  ENQUIRY_TYPE_OPTIONS,
  type EnquiryFilterFieldMeta,
} from './enquiryFilterSchema';
import { MEDICAL_SERVICE_SLUGS } from './enquiryFormFieldOptions';

export type AdvancedFilterRow = {
  id: string;
  field: string;
  operator: string;
  value: any;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'array';
  logicalOperator?: 'AND' | 'OR';
};

type CentersOpt = { id: string; name?: string };

export interface EnquiryFilterSectionProps {
  filters: Record<string, any>;
  updateFilter: (key: string, value: any) => void;
  searchTerm: string;
  advancedFilters: AdvancedFilterRow[];
  setAdvancedFilters: React.Dispatch<React.SetStateAction<AdvancedFilterRow[]>>;
  advancedFiltersLogic: 'AND' | 'OR';
  onAdvancedFiltersLogicChange: (mode: 'AND' | 'OR') => void;
  centers: CentersOpt[];
  assignedToOptions: string[];
  telecallerOptions: string[];
  visitorTypeOptions: string[];
  visitTypeRootOptions: string[];
  visitStatusRootOptions: string[];
  enquiryTypeOptions: string[];
  activeFormTypeOptions: string[];
  referenceOptions: string[];
  /** Settings-driven option lists (Firestore / built-in). Keys are filter `field` paths. */
  filterCatalogOverrides: Partial<Record<string, { value: string; label: string }[]>>;
  filterPresets: { id: string; name: string }[];
  currentPreset: string;
  onLoadPreset: (presetId: string) => void;
  onSavePresetClick: () => void;
  onDeletePreset: () => void;
  onClearAll: () => void;
  filteredCount: number;
  totalCount: number;
  page: number;
  rowsPerPage: number;
}

function formatIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function applyCreatedDatePreset(
  preset: 'today' | 'last7' | 'thisMonth',
  updateFilter: (k: string, v: any) => void
) {
  const now = new Date();
  if (preset === 'today') {
    const s = formatIsoDate(now);
    updateFilter('dateFrom', s);
    updateFilter('dateTo', s);
    return;
  }
  if (preset === 'last7') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    updateFilter('dateFrom', formatIsoDate(from));
    updateFilter('dateTo', formatIsoDate(now));
    return;
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  updateFilter('dateFrom', formatIsoDate(start));
  updateFilter('dateTo', formatIsoDate(end));
}

function enumOptionsForField(
  meta: EnquiryFilterFieldMeta | undefined,
  props: Pick<
    EnquiryFilterSectionProps,
    | 'centers'
    | 'assignedToOptions'
    | 'telecallerOptions'
    | 'visitorTypeOptions'
    | 'visitTypeRootOptions'
    | 'visitStatusRootOptions'
    | 'enquiryTypeOptions'
    | 'activeFormTypeOptions'
    | 'referenceOptions'
    | 'filterCatalogOverrides'
  >
): { value: string; label: string }[] {
  if (!meta) return [];
  const ov = meta.field ? props.filterCatalogOverrides?.[meta.field] : undefined;
  if (
    ov?.length &&
    meta.field !== 'visitorType' &&
    meta.field !== 'enquiryType' &&
    meta.field !== 'activeFormTypes' &&
    meta.field !== 'reference'
  ) {
    return ov;
  }
  if (meta.staticOptions?.length && !ov?.length) return meta.staticOptions;
  const mapStrings = (arr: string[]) =>
    arr.filter(Boolean).map(s => ({ value: String(s).trim(), label: String(s).trim() }));
  switch (meta.enumSource) {
    case 'assignedTo':
      return mapStrings(props.assignedToOptions);
    case 'telecaller':
      return mapStrings(props.telecallerOptions);
    case 'visitorType': {
      const seen = new Set<string>();
      const out: { value: string; label: string }[] = [];
      (props.filterCatalogOverrides?.visitorType ?? []).forEach((o) => {
        if (!seen.has(o.value)) {
          seen.add(o.value);
          out.push(o);
        }
      });
      props.visitorTypeOptions.forEach((v) => {
        const s = String(v || '').trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          out.push({ value: s, label: s });
        }
      });
      return out.sort((a, b) => a.label.localeCompare(b.label));
    }
    case 'visitTypeRoot':
      return mapStrings(props.visitTypeRootOptions);
    case 'visitStatusRoot':
      return mapStrings(props.visitStatusRootOptions);
    case 'enquiryType': {
      const seen = new Set<string>();
      const out: { value: string; label: string }[] = [];
      const base = props.filterCatalogOverrides?.enquiryType?.length
        ? props.filterCatalogOverrides.enquiryType!
        : ENQUIRY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
      base.forEach((o) => {
        if (!seen.has(o.value)) {
          seen.add(o.value);
          out.push(o);
        }
      });
      props.enquiryTypeOptions.forEach((v) => {
        const s = String(v || '').trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          out.push({ value: s, label: s });
        }
      });
      return out.sort((a, b) => a.label.localeCompare(b.label));
    }
    case 'activeFormType': {
      const seen = new Set<string>();
      const out: { value: string; label: string }[] = [];
      const labelFor = (slug: string) =>
        ({
          hearing_test: 'Hearing test',
          hearing_aid_trial: 'Hearing aid trial',
          hearing_aid_booked: 'Hearing aid booked',
          hearing_aid_sale: 'Hearing aid sale',
          hearing_aid: 'Hearing aid',
          accessory: 'Accessory',
          programming: 'Programming',
          repair: 'Repair',
          counselling: 'Counselling',
        } as Record<string, string>)[slug] || slug;
      const base = props.filterCatalogOverrides?.activeFormTypes?.length
        ? props.filterCatalogOverrides.activeFormTypes!
        : MEDICAL_SERVICE_SLUGS.map((slug) => ({ value: slug, label: labelFor(slug) }));
      base.forEach((o) => {
        if (!seen.has(o.value)) {
          seen.add(o.value);
          out.push(o);
        }
      });
      props.activeFormTypeOptions.forEach((v) => {
        const s = String(v || '').trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          out.push({ value: s, label: labelFor(s) });
        }
      });
      return out.sort((a, b) => a.label.localeCompare(b.label));
    }
    case 'reference': {
      const seen = new Set<string>();
      const out: { value: string; label: string }[] = [];
      const base = props.filterCatalogOverrides?.reference?.length
        ? props.filterCatalogOverrides.reference!
        : REFERENCE_OPTION_OBJECTS;
      base.forEach((o) => {
        if (!seen.has(o.value)) {
          seen.add(o.value);
          out.push(o);
        }
      });
      props.referenceOptions.forEach((r) => {
        const s = String(r || '').trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          out.push({ value: s, label: s });
        }
      });
      return out.sort((a, b) => a.label.localeCompare(b.label));
    }
    case 'centers':
      return props.centers.map(c => ({ value: String(c.id), label: c.name || String(c.id) }));
    default:
      return [];
  }
}

export default function EnquiryFilterSection({
  filters,
  updateFilter,
  searchTerm,
  advancedFilters,
  setAdvancedFilters,
  advancedFiltersLogic,
  onAdvancedFiltersLogicChange,
  centers,
  assignedToOptions,
  telecallerOptions,
  visitorTypeOptions,
  visitTypeRootOptions,
  visitStatusRootOptions,
  enquiryTypeOptions,
  activeFormTypeOptions,
  referenceOptions,
  filterCatalogOverrides,
  filterPresets,
  currentPreset,
  onLoadPreset,
  onSavePresetClick,
  onDeletePreset,
  onClearAll,
  filteredCount,
  totalCount,
  page,
  rowsPerPage,
}: EnquiryFilterSectionProps) {
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [pickerStep, setPickerStep] = useState<'fields' | 'configure'>('fields');
  const [fieldSearch, setFieldSearch] = useState('');
  const [filterBuilder, setFilterBuilder] = useState({
    field: '',
    operator: '',
    value: '' as any,
    dataType: 'text' as AdvancedFilterRow['dataType'],
  });
  const [multiEnumValue, setMultiEnumValue] = useState<string[]>([]);

  const filterableFlat = useMemo(() => flatFilterFields(), []);

  const handleOpenAdd = (e: React.MouseEvent<HTMLElement>) => {
    setAddAnchor(e.currentTarget);
    setPickerStep('fields');
    setFieldSearch('');
    setFilterBuilder({ field: '', operator: '', value: '', dataType: 'text' });
    setMultiEnumValue([]);
  };

  const handleCloseAdd = () => {
    setAddAnchor(null);
    setPickerStep('fields');
  };

  const selectField = (fieldPath: string) => {
    const meta = getFieldMeta(fieldPath);
    const dataType = meta?.dataType || 'text';
    const hasEnum = Boolean(meta?.enumSource || meta?.staticOptions?.length);
    const ops = operatorsByType[dataType] || [];
    const defaultOp = hasEnum && dataType === 'text' ? 'in_list' : ops[0]?.value || 'contains';
    setFilterBuilder({
      field: fieldPath,
      operator: defaultOp,
      value: '',
      dataType,
    });
    setMultiEnumValue([]);
    setPickerStep('configure');
  };

  const getAvailableOperators = () =>
    operatorsByType[filterBuilder.dataType] || operatorsByType.text;

  const metaForBuilder = getFieldMeta(filterBuilder.field);
  const enumOpts = enumOptionsForField(metaForBuilder, {
    centers,
    assignedToOptions,
    telecallerOptions,
    visitorTypeOptions,
    visitTypeRootOptions,
    visitStatusRootOptions,
    enquiryTypeOptions,
    activeFormTypeOptions,
    referenceOptions,
    filterCatalogOverrides,
  });
  const isEnumField = enumOpts.length > 0;

  const addAdvancedRule = () => {
    if (!filterBuilder.field || !filterBuilder.operator) return;
    let val = filterBuilder.value;
    if (filterBuilder.operator === 'in_list' && isEnumField) {
      val = multiEnumValue.join('|||');
    }
    if (
      ['is_null', 'is_not_null', 'is_empty', 'is_not_empty', 'this_month', 'last_month', 'this_year'].includes(
        filterBuilder.operator
      )
    ) {
      val = '';
    }
    const row: AdvancedFilterRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      field: filterBuilder.field,
      operator: filterBuilder.operator,
      value: val,
      dataType: filterBuilder.dataType,
      logicalOperator: 'AND',
    };
    setAdvancedFilters(prev => [...prev, row]);
    setPickerStep('fields');
    setFilterBuilder({ field: '', operator: '', value: '', dataType: 'text' });
    setMultiEnumValue([]);
  };

  const removeAdvanced = (id: string) => {
    setAdvancedFilters(prev => prev.filter(r => r.id !== id));
  };

  const filteredGroups = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return ENQUIRY_FILTER_FIELD_GROUPS;
    return ENQUIRY_FILTER_FIELD_GROUPS.map(g => ({
      ...g,
      fields: g.fields.filter(
        f => f.label.toLowerCase().includes(q) || f.field.toLowerCase().includes(q)
      ),
    })).filter(g => g.fields.length > 0);
  }, [fieldSearch]);

  const operatorLabel = (op: string, dt: AdvancedFilterRow['dataType']) =>
    operatorsByType[dt]?.find(o => o.value === op)?.label || op;

  const legacyChips = useMemo(() => {
    const chips: { key: string; label: string; onDelete: () => void }[] = [];
    const f = filters;

    if (f.status && f.status !== 'all') {
      const label = ENQUIRY_STATUS_OPTIONS.find(o => o.value === f.status)?.label || f.status;
      chips.push({
        key: 'legacy-status',
        label: `Status: ${label}`,
        onDelete: () => updateFilter('status', 'all'),
      });
    }
    if (f.enquiryType && f.enquiryType !== 'all') {
      chips.push({
        key: 'legacy-type',
        label: `Type: ${f.enquiryType}`,
        onDelete: () => updateFilter('enquiryType', 'all'),
      });
    }
    if (f.dateFrom || f.dateTo) {
      chips.push({
        key: 'legacy-created-range',
        label: `Created: ${f.dateFrom || '…'} → ${f.dateTo || '…'}`,
        onDelete: () => {
          updateFilter('dateFrom', '');
          updateFilter('dateTo', '');
        },
      });
    }
    if (f.hasEmail && f.hasEmail !== 'all') {
      chips.push({
        key: 'legacy-email',
        label: `Has email: ${f.hasEmail}`,
        onDelete: () => updateFilter('hasEmail', 'all'),
      });
    }
    if (f.hasPhone && f.hasPhone !== 'all') {
      chips.push({
        key: 'legacy-phone',
        label: `Has phone: ${f.hasPhone}`,
        onDelete: () => updateFilter('hasPhone', 'all'),
      });
    }
    if (f.assignedTo && f.assignedTo !== 'all') {
      chips.push({
        key: 'legacy-assigned',
        label: `Assigned: ${f.assignedTo}`,
        onDelete: () => updateFilter('assignedTo', 'all'),
           });
    }
    if (f.telecaller && f.telecaller !== 'all') {
      chips.push({
        key: 'legacy-tel',
        label: `Telecaller: ${f.telecaller}`,
        onDelete: () => updateFilter('telecaller', 'all'),
      });
    }
    if (f.visitingCenter && f.visitingCenter !== 'all') {
      const cn = centers.find(c => String(c.id) === String(f.visitingCenter))?.name || f.visitingCenter;
      chips.push({
        key: 'legacy-center',
        label: `Center: ${cn}`,
        onDelete: () => updateFilter('visitingCenter', 'all'),
      });
    }
    if (f.visitorType && f.visitorType !== 'all') {
      chips.push({
        key: 'legacy-vt',
        label: `Visitor: ${f.visitorType}`,
        onDelete: () => updateFilter('visitorType', 'all'),
      });
    }
    if (f.visitType && f.visitType !== 'all') {
      chips.push({
        key: 'legacy-vtype',
        label: `Visit type: ${f.visitType}`,
        onDelete: () => updateFilter('visitType', 'all'),
      });
    }
    if (f.visitStatus && f.visitStatus !== 'all') {
      chips.push({
        key: 'legacy-vs',
        label: `Visit status: ${f.visitStatus}`,
        onDelete: () => updateFilter('visitStatus', 'all'),
      });
    }
    if (f.hasFollowUps && f.hasFollowUps !== 'all') {
      chips.push({
        key: 'legacy-fu',
        label: `Follow-ups: ${f.hasFollowUps === 'yes' ? 'Has' : 'None'}`,
        onDelete: () => updateFilter('hasFollowUps', 'all'),
      });
    }
    if (f.hasTestResults && f.hasTestResults !== 'all') {
      chips.push({
        key: 'legacy-tr',
        label: `Test results: ${f.hasTestResults === 'yes' ? 'Has' : 'None'}`,
        onDelete: () => updateFilter('hasTestResults', 'all'),
      });
    }
    if (f.visitDateFrom || f.visitDateTo) {
      chips.push({
        key: 'legacy-vd',
        label: `Visit date: ${f.visitDateFrom || '…'} → ${f.visitDateTo || '…'}`,
        onDelete: () => {
          updateFilter('visitDateFrom', '');
          updateFilter('visitDateTo', '');
        },
      });
    }
    if (f.companyName?.trim()) {
      chips.push({
        key: 'legacy-co',
        label: `Company contains: ${f.companyName}`,
        onDelete: () => updateFilter('companyName', ''),
      });
    }
    if (f.purposeOfVisit?.trim()) {
      chips.push({
        key: 'legacy-pov',
        label: `Purpose: ${f.purposeOfVisit}`,
        onDelete: () => updateFilter('purposeOfVisit', ''),
      });
    }
    if (f.reference?.trim()) {
      chips.push({
        key: 'legacy-ref',
        label: `Reference: ${f.reference}`,
        onDelete: () => updateFilter('reference', ''),
      });
    }
    if (Array.isArray(f.activeFormTypes) && f.activeFormTypes.length > 0) {
      chips.push({
        key: 'legacy-forms',
        label: `Form types (${f.activeFormTypes.length})`,
        onDelete: () => updateFilter('activeFormTypes', []),
      });
    }

    return chips;
  }, [filters, centers, updateFilter]);

  const hasSearch = Boolean((filters.searchTerm || searchTerm || '').trim());
  const activeRuleCount = advancedFilters.length + legacyChips.length + (hasSearch ? 1 : 0);

  const renderValueControl = () => {
    const { operator, dataType, value } = filterBuilder;
    if (
      ['is_null', 'is_not_null', 'is_empty', 'is_not_empty', 'this_month', 'last_month', 'this_year'].includes(
        operator
      )
    ) {
      return (
        <Typography variant="caption" color="text.secondary">
          No value needed for this operator.
        </Typography>
      );
    }

    if (dataType === 'text' && operator === 'in_list' && isEnumField) {
      return (
        <Autocomplete
          multiple
          size="small"
          options={enumOpts}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(a, b) => String(a?.value) === String(b?.value)}
          value={enumOpts.filter(o => multiEnumValue.map(String).includes(String(o.value)))}
          onChange={(_, v) => setMultiEnumValue(v.map(o => String(o.value)))}
          renderInput={params => <TextField {...params} label="Values" placeholder="Search…" />}
          sx={{ width: '100%' }}
        />
      );
    }

    switch (dataType) {
      case 'number':
        if (operator === 'between' || operator === 'not_between') {
          return (
            <TextField
              size="small"
              fullWidth
              label="Min, max"
              placeholder="10,100"
              value={value}
              onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
            />
          );
        }
        return (
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Value"
            value={value}
            onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
          />
        );
      case 'date':
        if (filterBuilder.field === 'createdAt' && operator === 'between') {
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(['today', 'last7', 'thisMonth'] as const).map(preset => (
                  <Chip
                    key={preset}
                    size="small"
                    label={preset === 'today' ? 'Today' : preset === 'last7' ? 'Last 7 days' : 'This month'}
                    onClick={() => {
                      const now = new Date();
                      if (preset === 'today') {
                        const s = formatIsoDate(now);
                        setFilterBuilder(p => ({ ...p, value: `${s},${s}` }));
                      } else if (preset === 'last7') {
                        const from = new Date(now);
                        from.setDate(from.getDate() - 6);
                        setFilterBuilder(p => ({
                          ...p,
                          value: `${formatIsoDate(from)},${formatIsoDate(now)}`,
                        }));
                      } else {
                        const start = new Date(now.getFullYear(), now.getMonth(), 1);
                        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        setFilterBuilder(p => ({
                          ...p,
                          value: `${formatIsoDate(start)},${formatIsoDate(end)}`,
                        }));
                      }
                    }}
                    variant="outlined"
                  />
                ))}
              </Box>
              <TextField
                size="small"
                fullWidth
                label="From, to (YYYY-MM-DD,YYYY-MM-DD)"
                value={value}
                onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
              />
            </Box>
          );
        }
        if (operator === 'between') {
          return (
            <TextField
              size="small"
              fullWidth
              label="Start, end dates"
              placeholder="YYYY-MM-DD,YYYY-MM-DD"
              value={value}
              onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
            />
          );
        }
        if (operator === 'last_days' || operator === 'next_days') {
          return (
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Days"
              value={value}
              onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
            />
          );
        }
        return (
          <TextField
            size="small"
            fullWidth
            type="date"
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={value}
            onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
          />
        );
      case 'array':
        if (operator.includes('length')) {
          return (
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Length"
              value={value}
              onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
            />
          );
        }
        return (
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={enumOpts.length ? enumOpts.map(o => o.value) : activeFormTypeOptions}
            value={typeof value === 'string' && value ? value.split(',').map(s => s.trim()) : []}
            onChange={(_, v) => setFilterBuilder(p => ({ ...p, value: (v as string[]).join(',') }))}
            renderInput={params => <TextField {...params} label="Values" placeholder="Comma / pick" />}
            sx={{ width: '100%' }}
          />
        );
      default:
        if (isEnumField && operator !== 'in_list') {
          return (
            <Autocomplete
              size="small"
              options={enumOpts}
              getOptionLabel={o => o.label}
              isOptionEqualToValue={(a, b) => String(a?.value) === String(b?.value)}
              value={enumOpts.find(o => String(o.value) === String(value)) || null}
              onChange={(_, v) => setFilterBuilder(p => ({ ...p, value: v != null ? String(v.value) : '' }))}
              renderInput={params => <TextField {...params} label="Value" />}
              sx={{ width: '100%' }}
            />
          );
        }
        return (
          <TextField
            size="small"
            fullWidth
            label="Value"
            value={value}
            onChange={e => setFilterBuilder(p => ({ ...p, value: e.target.value }))}
            helperText={operator === 'regex' ? 'Regex pattern' : ''}
          />
        );
    }
  };

  const canAddRule =
    filterBuilder.field &&
    filterBuilder.operator &&
    (['is_null', 'is_not_null', 'is_empty', 'is_not_empty', 'this_month', 'last_month', 'this_year'].includes(
      filterBuilder.operator
    ) ||
      (filterBuilder.operator === 'in_list' && isEnumField ? multiEnumValue.length > 0 : String(filterBuilder.value || '').length > 0));

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        bgcolor: '#fafbfc',
        border: '1px solid #e8eaed',
        borderRadius: 2,
        boxShadow: '0 1px 2px rgba(60,64,67,0.08)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mr: 1 }}>
          Filter presets
        </Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="preset-select">Preset</InputLabel>
          <Select
            labelId="preset-select"
            label="Preset"
            value={currentPreset}
            onChange={e => onLoadPreset(e.target.value as string)}
          >
            <MenuItem value="">
              <em>Select preset</em>
            </MenuItem>
            {filterPresets.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" onClick={onSavePresetClick} startIcon={<AddIcon />}>
          Save current
        </Button>
        {currentPreset ? (
          <Button size="small" variant="outlined" color="error" onClick={onDeletePreset} startIcon={<DeleteIcon />}>
            Delete
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Combine advanced rules">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <AccountTreeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={advancedFiltersLogic}
              onChange={(_, v) => v && onAdvancedFiltersLogicChange(v)}
              sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.25, textTransform: 'none', fontWeight: 600 } }}
            >
              <ToggleButton value="AND">Match all</ToggleButton>
              <ToggleButton value="OR">Match any</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Tooltip>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="Search name, phone, email, reference, notes, message, address…"
        value={filters.searchTerm ?? searchTerm}
        onChange={e => updateFilter('searchTerm', e.target.value)}
        sx={{
          mb: 1.5,
          '& .MuiOutlinedInput-root': { bgcolor: 'white', borderRadius: 1.5 },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: (filters.searchTerm || searchTerm) ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => updateFilter('searchTerm', '')} edge="end">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'white', borderRadius: 1 }}>
          <InputLabel id="journey-status-label">Journey status</InputLabel>
          <Select
            labelId="journey-status-label"
            label="Journey status"
            value={filters.status || 'all'}
            onChange={e => updateFilter('status', e.target.value)}
          >
            <MenuItem value="all">All statuses</MenuItem>
            {ENQUIRY_STATUS_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'white', borderRadius: 1 }}>
          <InputLabel id="enquiry-type-label">Enquiry type</InputLabel>
          <Select
            labelId="enquiry-type-label"
            label="Enquiry type"
            value={filters.enquiryType || 'all'}
            onChange={e => updateFilter('enquiryType', e.target.value)}
          >
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="general">General</MenuItem>
            <MenuItem value="product">Product inquiry</MenuItem>
            <MenuItem value="service">Service request</MenuItem>
            <MenuItem value="complaint">Complaint</MenuItem>
            <MenuItem value="appointment">Appointment</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}>
        Created date (table filters)
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        {(['today', 'last7', 'thisMonth'] as const).map(preset => (
          <Chip
            key={preset}
            size="small"
            variant="outlined"
            label={preset === 'today' ? 'Today' : preset === 'last7' ? 'Last 7 days' : 'This month'}
            onClick={() => applyCreatedDatePreset(preset, updateFilter)}
            sx={{ borderColor: '#ffccbc', '&:hover': { bgcolor: '#fff3e0' } }}
          />
        ))}
        <TextField
          type="date"
          size="small"
          label="From"
          value={filters.dateFrom || ''}
          onChange={e => updateFilter('dateFrom', e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160, bgcolor: 'white', borderRadius: 1 }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={filters.dateTo || ''}
          onChange={e => updateFilter('dateTo', e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160, bgcolor: 'white', borderRadius: 1 }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<TuneIcon />}
          onClick={handleOpenAdd}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%)',
            boxShadow: '0 2px 8px rgba(255,107,53,0.35)',
            '&:hover': { background: 'linear-gradient(135deg, #ff5722 0%, #ff6b35 100%)' },
          }}
        >
          Add filter
        </Button>
        {advancedFilters.length > 0 ? (
          <Chip
            size="small"
            label={`${advancedFilters.length} rule${advancedFilters.length === 1 ? '' : 's'}`}
            color="primary"
            variant="outlined"
          />
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="text"
          color="inherit"
          startIcon={<ClearIcon />}
          onClick={onClearAll}
          disabled={activeRuleCount === 0 && !filters.dateFrom && !filters.dateTo}
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          Clear all
        </Button>
      </Box>

      {(hasSearch || legacyChips.length > 0 || advancedFilters.length > 0) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', width: '100%', mb: 0.5 }}>
            Active filters
          </Typography>
          {hasSearch ? (
            <Chip
              size="small"
              label={`Contains: “${(filters.searchTerm || searchTerm).trim().slice(0, 40)}${(filters.searchTerm || searchTerm).trim().length > 40 ? '…' : ''}”`}
              onDelete={() => updateFilter('searchTerm', '')}
              color="primary"
              variant="filled"
              sx={{ fontWeight: 600 }}
            />
          ) : null}
          {legacyChips.map(c => (
            <Chip key={c.key} size="small" label={c.label} onDelete={c.onDelete} variant="outlined" sx={{ fontWeight: 500 }} />
          ))}
          {advancedFilters.map(rule => {
            const meta = filterableFlat.find(f => f.field === rule.field);
            const label = meta?.label || rule.field;
            const opL = operatorLabel(rule.operator, rule.dataType);
            let val = rule.value;
            if (rule.operator === 'in_list' && typeof val === 'string') {
              val = val
                .split('|||')
                .map(v => {
                  const opts = enumOptionsForField(meta, {
                    centers,
                    assignedToOptions,
                    telecallerOptions,
                    visitorTypeOptions,
                    visitTypeRootOptions,
                    visitStatusRootOptions,
                    enquiryTypeOptions,
                    activeFormTypeOptions,
                    referenceOptions,
                    filterCatalogOverrides,
                  });
                  return opts.find(o => String(o.value) === String(v))?.label || v;
                })
                .join(', ');
            }
            return (
              <Chip
                key={rule.id}
                size="small"
                label={`${label}: ${opL}${val !== '' && val != null ? ` ${String(val)}` : ''}`}
                onDelete={() => removeAdvanced(rule.id)}
                sx={{ fontWeight: 600, bgcolor: 'rgba(25,118,210,0.08)', border: '1px solid rgba(25,118,210,0.25)' }}
              />
            );
          })}
        </Box>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {Math.min(page * rowsPerPage + 1, filteredCount)}–{Math.min((page + 1) * rowsPerPage, filteredCount)} of{' '}
          {filteredCount}
          {filteredCount !== totalCount ? ` (from ${totalCount} total)` : ''}
        </Typography>
      </Box>

      <Popover
        open={Boolean(addAnchor)}
        anchorEl={addAnchor}
        onClose={handleCloseAdd}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { width: 400, maxWidth: 'calc(100vw - 24px)', borderRadius: 2, mt: 1, maxHeight: 480 },
          },
        }}
      >
        {pickerStep === 'fields' ? (
          <Box>
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Add filter
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Find a field…"
                value={fieldSearch}
                onChange={e => setFieldSearch(e.target.value)}
                sx={{ mt: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <List dense sx={{ maxHeight: 360, overflow: 'auto', py: 0 }}>
              {filteredGroups.map(group => [
                <ListSubheader key={group.category} sx={{ bgcolor: '#f5f5f5', lineHeight: '32px', fontWeight: 700 }}>
                  {group.category}
                </ListSubheader>,
                ...group.fields.map(f => (
                  <ListItemButton key={f.field} onClick={() => selectField(f.field)}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {f.label}
                      </Typography>
                      {f.description ? (
                        <Typography variant="caption" color="text.secondary">
                          {f.description}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {f.field}
                        </Typography>
                      )}
                    </Box>
                  </ListItemButton>
                )),
              ])}
            </List>
          </Box>
        ) : (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={() => setPickerStep('fields')} aria-label="Back">
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={700}>
                {metaForBuilder?.label || filterBuilder.field}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <InputLabel>Operator</InputLabel>
              <Select
                label="Operator"
                value={filterBuilder.operator}
                onChange={e => setFilterBuilder(p => ({ ...p, operator: e.target.value, value: '' }))}
              >
                {getAvailableOperators().map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {renderValueControl()}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
              <Button size="small" onClick={handleCloseAdd}>
                Cancel
              </Button>
              <Button size="small" variant="contained" disabled={!canAddRule} onClick={addAdvancedRule}>
                Add
              </Button>
            </Box>
          </Box>
        )}
      </Popover>
    </Paper>
  );
}
