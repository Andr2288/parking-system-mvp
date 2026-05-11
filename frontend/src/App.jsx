import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ParkingSpotsPage from './pages/ParkingSpotsPage';
import VehiclesPage from './pages/VehiclesPage';
import TariffPage from './pages/TariffPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/spots" replace />} />
              <Route path="/spots" element={<ParkingSpotsPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/tariff" element={<TariffPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/spots" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
