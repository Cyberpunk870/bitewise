import { Link } from 'react-router-dom';

export default function Menu() {
  const items = [
    { to: '/home', label: 'Home' },
    { to: '/orders', label: 'Orders' },
    { to: '/favorites', label: 'Favorites' },
    { to: '/settings', label: 'Settings' },
    { to: '/help', label: 'Help & Support' },
  ];
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Menu</h1>
      <div className="rounded-2xl border bg-white/50 divide-y">
        {items.map(i => (
          <Link key={i.to} to={i.to} className="block px-4 py-3 hover:bg-white/70">
            {i.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
