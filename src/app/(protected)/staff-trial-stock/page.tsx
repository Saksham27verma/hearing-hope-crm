import { redirect } from 'next/navigation';

/** Legacy path; module renamed to Staff stock assign. */
export default function StaffTrialStockRedirectPage() {
  redirect('/staff-stock-assign');
}
