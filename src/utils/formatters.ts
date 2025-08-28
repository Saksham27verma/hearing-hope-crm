/**
 * Format a number as Indian currency (INR)
 * @param value - Number to format
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format a date as a string
 * @param date - Date to format
 * @param format - Format type ('short', 'medium', 'long')
 * @returns Formatted date string
 */
export const formatDate = (date: Date | string | number, format: 'short' | 'medium' | 'long' = 'medium'): string => {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'short' ? '2-digit' : 'long',
    day: '2-digit'
  };
  
  return dateObj.toLocaleDateString('en-IN', options);
};

/**
 * Format a number as a percentage
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format a number with commas for thousands separator
 * @param value - Number to format
 * @returns Formatted number string
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-IN').format(value);
}; 