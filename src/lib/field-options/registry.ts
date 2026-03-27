import type { FieldDefinition, ModuleFieldGroup } from './types';
import { ENQUIRIES_OPTION_CATEGORIES } from './enquiriesCatalog';

function enquiriesFieldsFromCatalog(): FieldDefinition[] {
  return ENQUIRIES_OPTION_CATEGORIES.flatMap((c) =>
    c.fields.map((f) => ({
      fieldKey: f.fieldKey,
      fieldLabel: f.displayName,
      defaults: f.defaults,
    }))
  );
}

export const FIELD_OPTIONS_REGISTRY: ModuleFieldGroup[] = [
  {
    moduleKey: 'enquiries',
    moduleLabel: 'Enquiries',
    fields: enquiriesFieldsFromCatalog(),
  },
  {
    moduleKey: 'invoices',
    moduleLabel: 'Invoices / sales',
    fields: [
      {
        fieldKey: 'payment_method',
        fieldLabel: 'Payment method',
        defaults: [
          { optionValue: 'cash', optionLabel: 'Cash', sortOrder: 10 },
          { optionValue: 'card', optionLabel: 'Card', sortOrder: 20 },
          { optionValue: 'upi', optionLabel: 'UPI', sortOrder: 30 },
          { optionValue: 'bank_transfer', optionLabel: 'Bank Transfer', sortOrder: 40 },
          { optionValue: 'cheque', optionLabel: 'Cheque', sortOrder: 50 },
          { optionValue: 'emi', optionLabel: 'EMI', sortOrder: 60 },
          { optionValue: 'mixed', optionLabel: 'Mixed', sortOrder: 70 },
        ],
      },
      {
        fieldKey: 'payment_status',
        fieldLabel: 'Payment status',
        defaults: [
          { optionValue: 'paid', optionLabel: 'Paid', sortOrder: 10 },
          { optionValue: 'pending', optionLabel: 'Pending', sortOrder: 20 },
          { optionValue: 'overdue', optionLabel: 'Overdue', sortOrder: 30 },
          { optionValue: 'cancelled', optionLabel: 'Cancelled', sortOrder: 40 },
        ],
      },
    ],
  },
];

export function getRegistryField(moduleKey: string, fieldKey: string): FieldDefinition | undefined {
  const mod = FIELD_OPTIONS_REGISTRY.find((m) => m.moduleKey === moduleKey);
  return mod?.fields.find((f) => f.fieldKey === fieldKey);
}

export function getDefaultOptionsForField(moduleKey: string, fieldKey: string) {
  return getRegistryField(moduleKey, fieldKey)?.defaults ?? [];
}
