import Link from 'next/link';

const apps = [
  {
    id: 'bocce',
    name: 'Bocce League',
    description: 'Manage teams, schedules, standings, and playoffs for the Bocce League',
    href: '/bocce',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="none" />
        <circle cx="32" cy="32" r="8" fill="currentColor" />
        <circle cx="20" cy="20" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="44" cy="44" r="4" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    color: 'bg-primary',
    available: true,
  },
  {
    id: 'staff',
    name: 'Staff Tasks',
    description: 'Manage staff action items, track progress, and surface blockers',
    href: '/staff',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="8" width="40" height="48" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
        <path d="M20 24H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 32H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 40H36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="44" cy="44" r="8" fill="currentColor" />
        <path d="M41 44L43 46L47 42" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: 'bg-indigo-600',
    available: true,
  },
  {
    id: 'groups',
    name: 'Interest Groups',
    description: 'Join social groups, schedule meetings, and connect with fellow members',
    href: '/groups',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="20" r="8" fill="currentColor" />
        <circle cx="16" cy="28" r="6" fill="currentColor" opacity="0.7" />
        <circle cx="48" cy="28" r="6" fill="currentColor" opacity="0.7" />
        <path d="M32 28C38 28 44 32 44 40H20C20 32 26 28 32 28Z" fill="currentColor" />
        <path d="M16 34C20 34 24 36 24 42H8C8 36 12 34 16 34Z" fill="currentColor" opacity="0.7" />
        <path d="M48 34C52 34 56 36 56 42H40C40 36 44 34 48 34Z" fill="currentColor" opacity="0.7" />
        <circle cx="32" cy="52" r="4" fill="currentColor" />
        <path d="M28 48H36" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    color: 'bg-purple-600',
    available: true,
  },
  {
    id: 'golf',
    name: 'Golf Events',
    description: 'Tournament registration, tee times, and handicap tracking',
    href: '/golf',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="16" r="6" fill="currentColor" />
        <path d="M32 22V52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 52C32 52 20 48 20 56H44C44 48 32 52 32 52Z" fill="currentColor" />
      </svg>
    ),
    color: 'bg-emerald-600',
    available: false,
  },
  {
    id: 'tennis',
    name: 'Tennis & Pickleball',
    description: 'Court reservations, ladder standings, and match scheduling',
    href: '/tennis',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="3" fill="none" />
        <path d="M32 12C24 20 24 44 32 52" stroke="currentColor" strokeWidth="2" />
        <path d="M32 12C40 20 40 44 32 52" stroke="currentColor" strokeWidth="2" />
        <path d="M12 32H52" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    color: 'bg-yellow-600',
    available: false,
  },
  {
    id: 'dining',
    name: 'Dining Reservations',
    description: 'Book tables, view menus, and manage dining preferences',
    href: '/dining',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 12V28C20 32 24 36 28 36H20V52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 12V52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 12C44 12 52 16 52 24C52 32 44 32 44 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    color: 'bg-rose-600',
    available: false,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-2xl">GC</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Governors Club</h1>
              <p className="text-white/80">Member Portal</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-2">Club Applications</h2>
            <p className="text-muted">Select an application to get started</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {apps.map((app) => (
              <div key={app.id} className="relative">
                {app.available ? (
                  <Link
                    href={app.href}
                    className="block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                  >
                    <div className={`${app.color} p-6 text-white flex justify-center`}>
                      <div className="transform group-hover:scale-110 transition-transform duration-300">
                        {app.icon}
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-foreground mb-2">{app.name}</h3>
                      <p className="text-muted text-sm">{app.description}</p>
                    </div>
                    <div className="px-6 pb-6">
                      <span className="inline-flex items-center text-primary font-medium text-sm group-hover:translate-x-1 transition-transform">
                        Open App
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div className={`${app.color} p-6 text-white flex justify-center opacity-50`}>
                      {app.icon}
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-foreground mb-2">{app.name}</h3>
                      <p className="text-muted text-sm">{app.description}</p>
                    </div>
                    <div className="px-6 pb-6">
                      <span className="inline-flex items-center text-muted font-medium text-sm">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Info Section */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Real-Time Updates</h3>
              <p className="text-muted text-sm">Stay informed with live scores, standings, and event updates</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Member Community</h3>
              <p className="text-muted text-sm">Connect with fellow members and join club activities</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Secure Access</h3>
              <p className="text-muted text-sm">Your club information is private and protected</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} Governors Club. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
