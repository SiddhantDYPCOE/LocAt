
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import {
  AuthProvider,
  useAuth
} from "./context/AuthContext.jsx";

import { ConnectionProvider } from "./context/ConnectionContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";

import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";

import Login from "./pages/auth/Login.jsx";
import Signup from "./pages/auth/SignUp.jsx";
import Chats from "./pages/app/Chats.jsx";
import Connections from "./pages/app/Connections.jsx";
import { LocationProvider } from "./context/LocationContext.jsx";

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080D1A] text-white">
        Loading LocAt...
      </div>
    );
  }

  return isAuthenticated
    ? <Navigate to="/chats" replace />
    : children;
};

const Placeholder = ({ title }) => (
  <div className="p-6 text-white">
    <h1 className="text-2xl font-semibold">{title}</h1>
    <p className="mt-2 text-sm text-slate-400">
      This section is coming soon.
    </p>
  </div>
);

const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={<Navigate to="/chats" replace />}
          />

          <Route path="/chats" element={<Chats />} />

          <Route
            path="/connections"
            element={<Connections />}
          />

          <Route
            path="/map"
            element={<Placeholder title="Live Map" />}
          />

          <Route
            path="/journeys"
            element={<Placeholder title="Journeys" />}
          />

          <Route
            path="/profile"
            element={<Placeholder title="Your Profile" />}
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConnectionProvider>
          <ChatProvider>
            <LocationProvider>
              <AppRoutes />
            </LocationProvider>
          </ChatProvider>
        </ConnectionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
