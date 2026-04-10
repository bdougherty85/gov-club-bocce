import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'Bocce League | Governors Club',
  description: 'Governors Club Bocce League Management',
};

export default function BocceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1">{children}</main>
      <footer className="bg-primary text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm opacity-80">
            &copy; {new Date().getFullYear()} Governors Club Bocce League. All
            rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
