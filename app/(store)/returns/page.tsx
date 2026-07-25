import { redirect } from 'next/navigation';

/** Returns portal removed — send shoppers to contact support instead. */
export default function ReturnsPortalPage() {
  redirect('/contact');
}
