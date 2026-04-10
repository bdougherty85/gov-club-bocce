'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

const navItems = [
  { href: '/groups', label: 'All Groups' },
  { href: '/groups/my-groups', label: 'My Groups' },
  { href: '/groups/create', label: 'Create Group' },
];

export default function GroupsNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    // Load saved member identity
    const saved = localStorage.getItem('groupsMemberIdentity');
    if (saved) {
      try {
        setCurrentMember(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse member identity:', e);
      }
    }

    // Fetch all group members for the selector
    fetch('/api/groups/members')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(data);
        }
      })
      .catch(console.error);
  }, []);

  const handleMemberChange = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (member) {
      setCurrentMember(member);
      localStorage.setItem('groupsMemberIdentity', JSON.stringify(member));
      window.dispatchEvent(new CustomEvent('groupsMemberChanged', { detail: member }));
    } else {
      setCurrentMember(null);
      localStorage.removeItem('groupsMemberIdentity');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'lead':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <nav className="bg-indigo-700 shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/groups" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center">
                <span className="text-indigo-700 font-bold text-xl">GC</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">
                Interest Groups
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
                    ? 'bg-indigo-200 text-indigo-900'
                    : 'text-white hover:bg-indigo-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Member selector */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center">
              {currentMember && (
                <span
                  className={`px-2 py-0.5 rounded text-xs text-white mr-2 ${getRoleBadgeColor(
                    currentMember.role
                  )}`}
                >
                  {currentMember.role === 'lead' ? 'Lead' : 'Member'}
                </span>
              )}
              <select
                value={currentMember?.id || ''}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="bg-indigo-600 text-white text-sm rounded-md px-3 py-1.5 border border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Select Identity</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white hover:text-indigo-200 p-2"
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
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-indigo-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Mobile member selector */}
            <div className="px-3 py-2">
              <label className="block text-xs text-indigo-200 mb-1">
                Logged in as:
              </label>
              <select
                value={currentMember?.id || ''}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="w-full bg-indigo-600 text-white text-sm rounded-md px-3 py-2 border border-indigo-500"
              >
                <option value="">Select Identity</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === item.href
                    ? 'bg-indigo-200 text-indigo-900'
                    : 'text-white hover:bg-indigo-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
