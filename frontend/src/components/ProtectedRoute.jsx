import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9fc] text-[#4f566b]">
        Завантаження…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
