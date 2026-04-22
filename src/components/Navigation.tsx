'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/bocce', label: 'Dashboard' },
  { href: '/bocce/players', label: 'Players' },
  { href: '/bocce/teams', label: 'Teams' },
  { href: '/bocce/divisions', label: 'Divisions' },
  { href: '/bocce/schedule', label: 'Schedule' },
  { href: '/bocce/games', label: 'Games & Scores' },
  { href: '/bocce/lineups', label: 'Lineups' },
  { href: '/bocce/availability', label: 'Availability' },
  { href: '/bocce/standings', label: 'Standings' },
  { href: '/bocce/stats', label: 'Player Stats' },
  { href: '/bocce/review', label: 'Review' },
  { href: '/bocce/playoffs', label: 'Playoffs' },
  { href: '/bocce/settings', label: 'Settings' },
  { href: '/bocce/admin', label: 'Admin' },
];

const tvDisplayItem = { href: '/bocce/display', label: 'TV Display' };

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-primary shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/bocce" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-xl">GC</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">
                Governors Club Bocce
              </span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-secondary text-primary'
                    : 'text-white hover:bg-primary-light'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={tvDisplayItem.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 px-3 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1"
            >
              <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
              {tvDisplayItem.label}
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-secondary p-2"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-primary-dark">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === item.href
                    ? 'bg-secondary text-primary'
                    : 'text-white hover:bg-primary-light'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={tvDisplayItem.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 rounded-md text-base font-medium bg-red-600 text-white hover:bg-red-700 mt-2"
            >
              <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse mr-2"></span>
              {tvDisplayItem.label}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
