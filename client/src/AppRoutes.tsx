import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ShelvesPage } from './pages/Shelves';
import { InventoryPage } from './pages/Inventory';
import { AlertsPage } from './pages/Alerts';
import { SettingsPage } from './pages/Settings';
import { ReportsPage } from './pages/Reports';
import { DevicesPage } from './pages/Devices';
import { ShelfDetailPage } from './pages/ShelfDetail';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/shelves', element: <ShelvesPage /> },
      { path: '/shelves/:id', element: <ShelfDetailPage /> },
      { path: '/inventory', element: <InventoryPage /> },
      { path: '/alerts', element: <AlertsPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/devices', element: <DevicesPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);

export const AppRoutes = () => <RouterProvider router={router} />;
