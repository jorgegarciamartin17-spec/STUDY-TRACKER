import { useEffect } from 'react';
import { createHashRouter, NavLink, Outlet, RouterProvider } from 'react-router';
import { cx, ToastProvider } from './components/ui';
import { useSettings } from './data/hooks';
import type { Theme } from './db/types';
import Dashboard from './features/Dashboard';
import SettingsPage from './features/Settings';
import SubjectDetail from './features/SubjectDetail';
import Subjects from './features/Subjects';
import Tasks from './features/Tasks';
import Today from './features/Today';

const NAV = [
  { to: '/', label: 'Hoy', icon: '☀️' },
  { to: '/asignaturas', label: 'Asignaturas', icon: '📚' },
  { to: '/panel', label: 'Panel', icon: '📊' },
  { to: '/tareas', label: 'Entregas', icon: '📝' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* sin almacenamiento */
  }
}

function Layout() {
  const settings = useSettings();
  const theme = settings?.theme ?? 'system';
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl">
      <nav className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r border-slate-200 p-4 sm:flex dark:border-slate-800">
        <p className="mb-4 px-3 text-lg font-bold">🧪 Estudios</p>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium',
                isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )
            }
          >
            <span aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="pb-safe min-w-0 flex-1 px-4 pt-5 sm:px-8 sm:pb-10">
        <Outlet />
      </main>
      <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-900/95">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500')
            }
          >
            <span aria-hidden className="text-lg leading-none">
              {n.icon}
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/asignaturas', element: <Subjects /> },
      { path: '/asignaturas/:id', element: <SubjectDetail /> },
      { path: '/panel', element: <Dashboard /> },
      { path: '/tareas', element: <Tasks /> },
      { path: '/ajustes', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
