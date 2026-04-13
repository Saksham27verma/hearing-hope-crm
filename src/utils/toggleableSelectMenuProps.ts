import type * as React from 'react';
import type { SelectProps } from '@mui/material';

/** Match MUI Select option comparison (see SelectInput areEqualValues). */
export function selectOptionMatchesValue(selectedValue: unknown, clickedDataValue: string): boolean {
  if (clickedDataValue === '') {
    return selectedValue === '' || selectedValue == null;
  }
  if (typeof selectedValue === 'object' && selectedValue !== null) {
    return selectedValue === clickedDataValue;
  }
  return String(selectedValue ?? '') === clickedDataValue;
}

/**
 * MUI Select does not fire onChange when the user clicks the already-selected option.
 * Merge this into MenuProps so re-clicking that option runs onClear (e.g. set value to '').
 */
export function mergeMenuPropsForReselectClear(
  selectedValue: unknown,
  onClear: () => void,
  menuProps: SelectProps['MenuProps'] | undefined
): SelectProps['MenuProps'] {
  const prevListProps = menuProps?.MenuListProps ?? {};
  const prevOnClick = prevListProps.onClick;

  return {
    ...menuProps,
    MenuListProps: {
      ...prevListProps,
      onClick: (e: React.MouseEvent<HTMLUListElement>) => {
        if (prevOnClick) {
          (prevOnClick as (ev: React.MouseEvent<HTMLUListElement>) => void)(e);
        }
        const el = (e.target as HTMLElement | null)?.closest?.('[role="option"][data-value]');
        if (!el) return;
        const dv = el.getAttribute('data-value');
        if (dv === null) return;
        if (selectOptionMatchesValue(selectedValue, dv)) {
          onClear();
        }
      },
    },
  };
}
