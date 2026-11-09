
import { useState } from "react";
import {
  Search,
  UserPlus,
  Users,
  UserCheck,
  Clock,
  Check,
  X,
  Trash2,
  Loader2
} from "lucide-react";

import { useConnections } from "../../context/ConnectionContext.jsx";

const tabs = [
  { id: "discover", label: "Discover", icon: Search },
  { id: "incoming", label: "Incoming", icon: UserPlus },
  { id: "sent", label: "Sent", icon: Clock },
  { id: "connections", label: "Connections", icon: Users }
];

const Avatar = ({ user }) => (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-300">
    {user?.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="text-lg font-semibold">
        {user?.name?.charAt(0)?.toUpperCase() || "U"}
      </span>
    )}
  </div>
);

const Connections = () => {
  const {
    connections,
    incomingRequests,
    outgoingRequests,
    searchResults,
    loading,
    error,
    searchUsers,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeConnection,
    refreshConnections
  } = useConnections();

  const [activeTab, setActiveTab] = useState("discover");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState("");

  const getUser = (item) => item?.user || item?.recipient || item?.sender || item;

  const getConnectionId = (item) => item?.id || item?.connectionId;

  const handleSearch = async (value) => {
    setQuery(value);
    setMessage("");

    if (value.trim().length < 2) {
      await searchUsers("");
      return;
    }

    setSearching(true);

    try {
      await searchUsers(value);
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Unable to search users"
      );
    } finally {
      setSearching(false);
    }
  };

  const handleAction = async (id, action, successMessage) => {
    setActionLoading(id);
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Something went wrong"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const renderUser = (user, actions) => (
    <div
      key={user?.id}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#111A2B] p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={user} />

        <div className="min-w-0">
          <p className="truncate font-medium text-white">
            {user?.name || "Unknown user"}
          </p>
          <p className="truncate text-sm text-slate-400">
            @{user?.username || "unknown"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
      </div>
    </div>
  );

  const renderEmpty = (title, description) => (
    <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
      <Users className="mx-auto mb-3 h-9 w-9 text-slate-600" />
      <p className="font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );

  const renderContent = () => {
    if (activeTab === "discover") {
      return (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full rounded-2xl border border-white/10 bg-[#111A2B] py-4 pl-12 pr-4 text-white outline-none transition focus:border-indigo-500"
            />

            {searching && (
              <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-indigo-400" />
            )}
          </div>

          {query.trim().length < 2 ? (
            renderEmpty(
              "Find people on LocAt",
              "Enter at least two characters to search."
            )
          ) : searchResults.length === 0 && !searching ? (
            renderEmpty(
              "No users found",
              "Try searching with another name or username."
            )
          ) : (
            searchResults.map((item) => {
              const user = getUser(item);

              return renderUser(user, (
                <button
                  key={`send-${user.id}`}
                  disabled={actionLoading === user.id}
                  onClick={() =>
                    handleAction(
                      user.id,
                      () => sendRequest(user.username),
                      "Connection request sent."
                    )
                  }
                  className="flex items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
                >
                  {actionLoading === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Add
                </button>
              ));
            })
          )}
        </div>
      );
    }

    if (activeTab === "incoming") {
      return incomingRequests.length === 0
        ? renderEmpty(
            "No pending requests",
            "New connection requests will appear here."
          )
        : (
          <div className="space-y-3">
            {incomingRequests.map((item) => {
              const user = getUser(item);
              const id = getConnectionId(item);

              return renderUser(user, (
                <>
                  <button
                    disabled={actionLoading === id}
                    onClick={() =>
                      handleAction(
                        id,
                        () => acceptRequest(id),
                        "Connection request accepted."
                      )
                    }
                    className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                    title="Accept request"
                  >
                    <Check className="h-5 w-5" />
                  </button>

                  <button
                    disabled={actionLoading === id}
                    onClick={() =>
                      handleAction(
                        id,
                        () => rejectRequest(id),
                        "Connection request rejected."
                      )
                    }
                    className="rounded-xl bg-rose-500/15 p-2 text-rose-400 hover:bg-rose-500/25 disabled:opacity-50"
                    title="Reject request"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </>
              ));
            })}
          </div>
        );
    }

    if (activeTab === "sent") {
      return outgoingRequests.length === 0
        ? renderEmpty(
            "No outgoing requests",
            "Requests you send will appear here."
          )
        : (
          <div className="space-y-3">
            {outgoingRequests.map((item) => {
              const user = getUser(item);

              return renderUser(user, (
                <span className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                  <Clock className="h-4 w-4" />
                  Pending
                </span>
              ));
            })}
          </div>
        );
    }

    return connections.length === 0
      ? renderEmpty(
          "No connections yet",
          "Discover people and connect with them."
        )
      : (
        <div className="space-y-3">
          {connections.map((item) => {
            const user = getUser(item);
            const id = getConnectionId(item);

            return renderUser(user, (
              <>
                <span className="hidden items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400 sm:flex">
                  <UserCheck className="h-4 w-4" />
                  Connected
                </span>

                <button
                  disabled={actionLoading === id}
                  onClick={() =>
                    handleAction(
                      id,
                      () => removeConnection(id),
                      "Connection removed."
                    )
                  }
                  className="rounded-xl bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
                  title="Remove connection"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ));
          })}
        </div>
      );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <div>
        <p className="text-sm font-medium text-indigo-400">
          YOUR NETWORK
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">
          Connections
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Find people, manage requests, and build your LocAt network.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-[#111A2B] p-4">
          <Users className="mb-3 h-5 w-5 text-indigo-400" />
          <p className="text-2xl font-bold text-white">
            {connections.length}
          </p>
          <p className="text-xs text-slate-400">Connections</p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#111A2B] p-4">
          <UserPlus className="mb-3 h-5 w-5 text-emerald-400" />
          <p className="text-2xl font-bold text-white">
            {incomingRequests.length}
          </p>
          <p className="text-xs text-slate-400">Incoming requests</p>
        </div>

        <div className="col-span-2 rounded-2xl border border-white/5 bg-[#111A2B] p-4 sm:col-span-1">
          <Clock className="mb-3 h-5 w-5 text-amber-400" />
          <p className="text-2xl font-bold text-white">
            {outgoingRequests.length}
          </p>
          <p className="text-xs text-slate-400">Sent requests</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/5 bg-[#0D1524] p-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id);
              setMessage("");
              if (id !== "discover") refreshConnections();
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
              activeTab === id
                ? "bg-indigo-500 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === "incoming" && incomingRequests.length > 0 && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                {incomingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
          <span>{message}</span>
          <button
            onClick={() => setMessage("")}
            className="text-indigo-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
};

export default Connections;
