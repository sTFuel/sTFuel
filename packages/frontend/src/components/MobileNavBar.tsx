'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MobileNavBar = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/stats', label: 'Stats', icon: 'bar_chart' },
    { href: '/whitepaper', label: 'Whitepaper', icon: 'description' },
    { href: '/wallet', label: 'Wallet', icon: 'account_balance_wallet' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-background-dark/95 backdrop-blur-sm py-2 md:hidden" 
      style={{ 
        position: 'fixed',
        bottom: -1,
        left: 0,
        right: 0,
        width: '100%',
        height: '64px',
        minHeight: '64px',
        maxHeight: '64px',
        transform: 'translateZ(0)',
        willChange: 'transform',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        margin: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 flex-1"
          >
            <span className={`material-symbols-outlined text-2xl leading-none ${active ? 'text-tfuel-color' : 'text-gray-color'}`}>
              {item.icon}
            </span>
            <span className={`text-[10px] font-medium leading-tight truncate w-full text-center ${active ? 'text-tfuel-color' : 'text-gray-color'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileNavBar;

