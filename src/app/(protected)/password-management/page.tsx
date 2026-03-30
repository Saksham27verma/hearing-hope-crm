import { redirect } from 'next/navigation';

/** @deprecated Use `/user-management`. */
export default function PasswordManagementRedirectPage() {
  redirect('/user-management');
}
