import type { Timestamp } from 'firebase/firestore';

/** One row in `field_options` — stored values are stable; labels are for display only. */
export interface FieldOptionDoc {
  moduleKey: string;
  fieldKey: string;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FieldOptionResolved {
  id?: string;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FieldDefinition {
  fieldKey: string;
  fieldLabel: string;
  /** Default rows when Firestore has no documents for this module+field */
  defaults: Omit<FieldOptionResolved, 'id' | 'isActive'>[];
}

export interface ModuleFieldGroup {
  moduleKey: string;
  moduleLabel: string;
  fields: FieldDefinition[];
}
