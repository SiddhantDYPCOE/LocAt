
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Map,
  Route,
  User,
  Users,
  Menu,
  X,
  LogOut,
  MapPin
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";

const navigation = [
  {
    name: "Chats",
    path: "/chats",
    icon: MessageCircle
  },
  {
    name: "Connections",
    path: "/connections",
    icon: Users
  },
  {
    name: "Live Map",
    path: "/map",
    icon: Map
  },
  {
    name: "Journeys",
    path: "/journeys",
    icon: Route
  },
  {
    name: "Profile",
    path: "/profile",
    icon: User
  }
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const NavItem = ({ item, mobile = false }) => {
    const Icon = item.icon;

    return (
      <NavLink
        to={item.path}
        onClick={() => setMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
            isActive
              ? "bg-indigo-500/15 text-indigo-700"
              : "text-[#667781] hover:bg-[#F7F9F8] hover:text-[#111B21]"
          } ${
            mobile ? "flex-col gap-1 px-2 py-2 text-xs" : ""
          }`
        }
      >
        <Icon className="h-5 w-5" />
        <span>{item.name}</span>
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#111B21]">

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#E9EDEF] bg-white lg:flex">

        <div className="flex h-20 items-center gap-3 border-b border-[#E9EDEF] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500">
            <MapPin className="h-6 w-6 text-[#111B21]" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-wide">
              LocAt
            </h1>
            <p className="text-xs text-[#8696A0]">
              Stay connected
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <p className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-[#8696A0]">
            Menu
          </p>

          {navigation.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        <div className="border-t border-[#E9EDEF] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#F7F9F8] p-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-700">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || "U"
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.name || "User"}
              </p>
              <p className="truncate text-xs text-[#8696A0]">
                @{user?.username || "username"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#667781] transition hover:bg-rose-500/10 hover:text-red-700"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E9EDEF] bg-white/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500">
            <MapPin className="h-5 w-5" />
          </div>

          <span className="text-lg font-bold">LocAt</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-xl p-2 text-[#111B21] hover:bg-[#F7F9F8]"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-50 border-b border-[#E9EDEF] bg-white p-4 lg:hidden">
          <nav className="space-y-2">
            {navigation.map((item) => (
              <NavItem key={item.path} item={item} />
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-700 hover:bg-rose-500/10"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="min-h-screen lg:ml-64">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E9EDEF] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        {navigation.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            mobile
          />
        ))}
      </nav>

    </div>
  );
};

export default AppLayout;
