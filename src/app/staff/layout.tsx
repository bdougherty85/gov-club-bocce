import StaffNavigation from '@/components/StaffNavigation';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Staff Tasks | Governors Club',
  description: 'Staff task management for Governors Club',
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNavigation />
      <main className="flex-1">{children}</main>
      <footer className="bg-primary text-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">
            <Link href="/" className="text-secondary hover:underline">
              &larr; Back to Club Portal
            </Link>
          </p>
          <p className="text-xs text-gray-300 mt-2">
            &copy; {new Date().getFullYear()} Governors Club. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
