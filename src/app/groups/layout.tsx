import GroupsNavigation from '@/components/GroupsNavigation';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interest Groups | Governors Club',
  description: 'Join and manage interest groups at Governors Club',
};

export default function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <GroupsNavigation />
      <main className="flex-1">{children}</main>
      <footer className="bg-indigo-800 text-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">
            <Link href="/" className="text-indigo-200 hover:underline">
              &larr; Back to Club Portal
            </Link>
          </p>
          <p className="text-xs text-indigo-300 mt-2">
            &copy; {new Date().getFullYear()} Governors Club. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
