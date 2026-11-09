
import { useEffect, useRef, useState } from "react";
import {
  Send,
  MessageCircle,
  MoreVertical,
  Phone,
  Video,
  Loader2,
  Wifi,
  WifiOff
} from "lucide-react";

import { useChat } from "../../context/ChatContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const Avatar = ({ user, size = "h-11 w-11" }) => (
  <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-300`}>
    {user?.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="font-semibold">
        {user?.name?.charAt(0)?.toUpperCase() || "U"}
      </span>
    )}
  </div>
);

const formatTime = (date) => {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const ChatWindow = () => {
  const {
    selectedConversation,
    messages,
    loading,
    sending,
    socketConnected,
    error,
    sendMessage
  } = useChat();

  const { user: currentUser } = useAuth();

  const [content, setContent] = useState("");
  const [sendError, setSendError] = useState("");

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const recipient = selectedConversation?.user;

  // Scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  // Clear the input when changing conversations.
  useEffect(() => {
    setContent("");
    setSendError("");
  }, [selectedConversation?.id]);

  const handleSend = async (e) => {
    e.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent || sending) return;

    setSendError("");

    try {
      await sendMessage(trimmedContent);
      setContent("");
      textareaRef.current?.focus();
    } catch (err) {
      setSendError(err.message || "Unable to send message");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  if (!selectedConversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#080D1A] px-6 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-500/10">
          <MessageCircle className="h-12 w-12 text-indigo-400" />
        </div>

        <h2 className="text-2xl font-bold text-white">
          Your conversations
        </h2>

        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Select a connection to start chatting. Your messages will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080D1A]">

      {/* Chat header */}
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/5 bg-[#0D1524] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar user={recipient} />

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-white">
              {recipient?.name || "Conversation"}
            </h2>

            <div className="mt-1 flex items-center gap-1.5">
              {socketConnected ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-emerald-400">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-amber-400">
                    Reconnecting...
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            title="Voice calls coming soon"
            className="rounded-xl p-2.5 text-slate-500"
          >
            <Phone className="h-5 w-5" />
          </button>

          <button
            type="button"
            disabled
            title="Video calls coming soon"
            className="rounded-xl p-2.5 text-slate-500"
          >
            <Video className="h-5 w-5" />
          </button>

          <button
            type="button"
            title="More options coming soon"
            className="rounded-xl p-2.5 text-slate-400 hover:bg-white/5"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
              <MessageCircle className="h-8 w-8 text-slate-500" />
            </div>

            <p className="font-medium text-slate-300">
              No messages yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Say hello and start the conversation.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-5">
            {messages.map((message) => {
              const isOwnMessage =
                message.senderId === currentUser?.id ||
                message.sender?.id === currentUser?.id;

              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    isOwnMessage ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isOwnMessage && (
                    <Avatar
                      user={message.sender || recipient}
                      size="h-8 w-8"
                    />
                  )}

                  <div
                    className={`max-w-[80%] sm:max-w-[65%] ${
                      isOwnMessage ? "items-end" : "items-start"
                    } flex flex-col`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isOwnMessage
                          ? "rounded-br-md bg-indigo-500 text-white"
                          : "rounded-bl-md border border-white/5 bg-[#151F31] text-slate-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {message.content}
                      </p>
                    </div>

                    <span className="mt-1 px-1 text-[10px] text-slate-600">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Connection warning */}
      {!socketConnected && (
        <div className="flex items-center gap-2 border-t border-amber-500/10 bg-amber-500/5 px-4 py-2 text-xs text-amber-400">
          <WifiOff className="h-4 w-4" />
          Reconnecting to chat server...
        </div>
      )}

      {/* Error */}
      {(sendError || error) && (
        <div className="px-4 pb-2 text-xs text-rose-400">
          {sendError || error}
        </div>
      )}

      {/* Message composer */}
      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-white/5 bg-[#0D1524] p-4 sm:px-6"
      >
        <div className="mx-auto flex max-w-4xl items-end gap-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            maxLength={5000}
            className="max-h-32 min-h-[48px] flex-1 resize-y rounded-2xl border border-white/5 bg-[#151F31] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
          />

          <button
            type="submit"
            disabled={!content.trim() || sending || !socketConnected}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>

        <p className="mx-auto mt-2 max-w-4xl text-[10px] text-slate-600">
          Press Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </div>
  );
};

export default ChatWindow;
