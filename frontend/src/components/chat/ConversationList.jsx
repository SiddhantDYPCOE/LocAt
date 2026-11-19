
import { useState } from "react";
import {
  Search,
  MessageCircle,
  Loader2,
  Users
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useConnections } from "../../context/ConnectionContext.jsx";
import { useChat } from "../../context/ChatContext.jsx";

const Avatar = ({ user }) => (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-700">
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

const formatMessageTime = (date) => {
  if (!date) return "";

  const messageDate = new Date(date);

  if (Number.isNaN(messageDate.getTime())) return "";

  const now = new Date();
  const isToday =
    messageDate.toDateString() === now.toDateString();

  if (isToday) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return messageDate.toLocaleDateString([], {
    day: "2-digit",
    month: "short"
  });
};

const ConversationList = ({ onOpenChat }) => {
  const { user: currentUser } = useAuth();

  const {
    connections,
    loading: connectionsLoading
  } = useConnections();

  const {
    conversations,
    selectedConversation,
    openConversation,
    selectConversation,
    conversationsLoading
  } = useChat();

  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState(null);
  const [localError, setLocalError] = useState("");

  const filteredConnections = connections.filter((item) => {
    const user = item.user;
    const searchText = `${user?.name || ""} ${user?.username || ""}`;

    return searchText.toLowerCase().includes(search.toLowerCase());
  });

  const filteredConversations = conversations.filter((item) => {
    const user = item.user;
    const searchText = `${user?.name || ""} ${user?.username || ""}`;

    return searchText.toLowerCase().includes(search.toLowerCase());
  });

  const handleOpen = async (connection) => {
    const user = connection.user;

    if (!user?.id) return;

    setOpeningId(user.id);
    setLocalError("");

    try {
      await openConversation(user.id);
      onOpenChat?.();
    } catch (error) {
      setLocalError(error.message || "Unable to open conversation");
    } finally {
      setOpeningId(null);
    }
  };

  const handleSelect = async (conversation) => {
    setLocalError("");

    await selectConversation(conversation);
    onOpenChat?.();
  };

  const getLastMessagePreview = (conversation) => {
    const message = conversation.lastMessage;

    if (!message) return "Start a conversation";

    const isOwnMessage =
      message.senderId === currentUser?.id;

    const prefix = isOwnMessage ? "You: " : "";

    if (message.type === "IMAGE") return `${prefix}Photo`;
    if (message.type === "LOCATION") return `${prefix}Shared a location`;

    return `${prefix}${message.content || "Message"}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-[#E9EDEF] bg-white">

      {/* Header */}
      <div className="border-b border-[#E9EDEF] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#111B21]">
              Messages
            </h2>
            <p className="mt-1 text-xs text-[#8696A0]">
              Chat with your connections
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700">
            <MessageCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8696A0]" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-xl border border-[#E9EDEF] bg-white py-3 pl-10 pr-3 text-sm text-[#111B21] outline-none placeholder:text-[#8696A0] focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* Recent conversations */}
        <div className="px-5 pb-2 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8696A0]">
            Recent chats
          </p>
        </div>

        {conversationsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-700" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <p className="px-5 py-3 text-xs text-[#8696A0]">
            No recent conversations.
          </p>
        ) : (
          filteredConversations.map((conversation) => {
            const user = conversation.user;

            const isSelected =
              selectedConversation?.id === conversation.id;

            const lastMessage = conversation.lastMessage;

            return (
              <button
                key={conversation.id}
                onClick={() => handleSelect(conversation)}
                className={`flex w-full items-center gap-3 px-5 py-4 text-left transition ${
                  isSelected
                    ? "border-r-2 border-indigo-500 bg-indigo-500/10"
                    : "hover:bg-[#F7F9F8]"
                }`}
              >
                <Avatar user={user} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#111B21]">
                      {user?.name || "Unknown user"}
                    </p>

                    <span className="shrink-0 text-[10px] text-[#8696A0]">
                      {formatMessageTime(
                        lastMessage?.createdAt || conversation.updatedAt
                      )}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-[#8696A0]">
                    {getLastMessagePreview(conversation)}
                  </p>
                </div>
              </button>
            );
          })
        )}

        {/* Accepted connections */}
        <div className="px-5 pb-2 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8696A0]">
            Start a conversation
          </p>
        </div>

        {connectionsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-700" />
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <Users className="mx-auto mb-2 h-7 w-7 text-[#8696A0]" />
            <p className="text-sm text-[#667781]">
              No connections found.
            </p>
          </div>
        ) : (
          filteredConnections.map((connection) => {
            const user = connection.user;

            return (
              <button
                key={connection.id}
                onClick={() => handleOpen(connection)}
                disabled={openingId === user?.id}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#F7F9F8] disabled:opacity-50"
              >
                <Avatar user={user} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#111B21]">
                    {user?.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#8696A0]">
                    @{user?.username}
                  </p>
                </div>

                {openingId === user?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-700" />
                ) : (
                  <MessageCircle className="h-4 w-4 text-[#8696A0]" />
                )}
              </button>
            );
          })
        )}

        {localError && (
          <p className="mx-4 my-3 rounded-lg bg-rose-500/10 p-3 text-xs text-red-700">
            {localError}
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
