import { LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const isPresentation = location.pathname.includes('/presentation');

  // Hide header in presentation mode for max screen real estate
  if (isPresentation) return null;

  return (
    <header style={{
      padding: '1rem 2rem',
      background: 'var(--panel-bg)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          background: 'var(--sjsu-gold)',
          padding: '0.5rem',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(234, 171, 0, 0.3)'
        }}>
          <LayoutDashboard size={20} color="#fff" />
        </div>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--sjsu-blue)' }}>
          SJSU Feedback<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>Synthesis</span>
        </h1>
      </Link>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
          System Ready
        </div>
      </div>
    </header>
  );
}
