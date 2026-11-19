
import { useEffect, useRef, useState } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import {
  useNavigate
} from "react-router-dom";

import {
  Send,
  MessageCircle,
  MoreVertical,
  Phone,
  Video,
  Loader2,
  WifiOff,
  MapPin,
  Navigation
} from "lucide-react";

import { useChat } from "../../context/ChatContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// ==========================================
// AVATAR
// ==========================================

const Avatar = ({ user, size = "h-11 w-11" }) => (
  <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20 text-indigo-700`}>
    {user?.avatarUrl ? (
      <img
        src={user.avatarUrl}
        alt={user.name || "User"}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="font-semibold">
        {user?.name?.charAt(0)?.toUpperCase() || "U"}
      </span>
    )}
  </div>
);

// ==========================================
// TIME FORMATTER
// ==========================================

const formatTime = (date) => {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
};

// ==========================================
// LOCATION PREVIEW
// ==========================================

const LocationPreview = ({
  latitude,
  longitude,
  onClick
}) => {
  const validCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (!validCoordinates) {
    return (
      <div className="rounded-xl bg-[#F7F9F8] p-4 text-sm text-[#111B21]">
        Location unavailable
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="w-[240px] max-w-full cursor-pointer overflow-hidden rounded-xl border border-[#D9E1E5] bg-white text-left transition hover:border-indigo-400/50"
      title="Open location in LocAt Map"
    >
      {/* MINI MAP */}

      <div className="relative h-[145px] w-full overflow-hidden">
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
          zoomControl={false}
          attributionControl={false}
          keyboard={false}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <CircleMarker
            center={[latitude, longitude]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#25D366",
              fillOpacity: 1
            }}
          />
        </MapContainer>

        <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-white/90 p-2 text-[#111B21] shadow-lg">
          <Navigation size={15} />
        </div>
      </div>

      {/* LOCATION DETAILS */}

      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700">
          <MapPin size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#111B21]">
            Location
          </p>

          <p className="text-xs text-[#667781]">
            Tap to view on LocAt Map
          </p>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CHAT WINDOW
// ==========================================

const ChatWindow = () => {
  const navigate = useNavigate();

  const {
    selectedConversation,
    messages,
    loading,
    sending,
    socketConnected,
    error,
    sendMessage,
    sendLocationMessage
  } = useChat();

  const { user: currentUser } = useAuth();

  const [content, setContent] = useState("");
  const [sendError, setSendError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const recipient = selectedConversation?.user;

  // ==========================================
  // SCROLL TO LATEST MESSAGE
  // ==========================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  // ==========================================
  // RESET INPUT ON CONVERSATION CHANGE
  // ==========================================

  useEffect(() => {
    setContent("");
    setSendError("");
  }, [selectedConversation?.id]);

  // ==========================================
  // SEND TEXT MESSAGE
  // ==========================================

  const handleSend = async (event) => {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent || sending) return;

    setSendError("");

    try {
      await sendMessage(trimmedContent);

      setContent("");

      textareaRef.current?.focus();
    } catch (err) {
      setSendError(
        err.message || "Unable to send message"
      );
    }
  };

  // ==========================================
  // SEND LOCATION MESSAGE
  // ==========================================

  const handleShareLocation = async () => {
    if (locationLoading || sending) return;

    setSendError("");

    if (!navigator.geolocation) {
      setSendError(
        "Geolocation is not supported by this browser."
      );
      return;
    }

    setLocationLoading(true);

    try {
      const position = await new Promise(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0
            }
          );
        }
      );

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      await sendLocationMessage(
        latitude,
        longitude
      );
    } catch (err) {
      let message = err.message || "Unable to share location.";

      if (err.code === 1) {
        message = "Location permission was denied. Allow location access in your browser.";
      } else if (err.code === 2) {
        message = "Your current location is unavailable.";
      } else if (err.code === 3) {
        message = "Location request timed out. Please try again.";
      }

      setSendError(message);
    } finally {
      setLocationLoading(false);
    }
  };

  // ==========================================
  // OPEN SHARED LOCATION ON LOCAT MAP
  // ==========================================

  const handleOpenLocation = (latitude, longitude) => {
    navigate("/map", {
      state: {
        focusLocation: {
          latitude,
          longitude
        }
      }
    });
  };

  // ==========================================
  // KEYBOARD HANDLING
  // ==========================================

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  };

  // ==========================================
  // NO CONVERSATION SELECTED
  // ==========================================

  if (!selectedConversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-500/10">
          <MessageCircle className="h-12 w-12 text-indigo-700" />
        </div>

        <h2 className="text-2xl font-bold text-[#111B21]">
          Your conversations
        </h2>

        <p className="mt-2 max-w-sm text-sm leading-6 text-[#8696A0]">
          Select a connection to start chatting. Your messages will
          appear here.
        </p>
      </div>
    );
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">

      {/* CHAT HEADER */}

      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#E9EDEF] bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar user={recipient} />

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-[#111B21]">
              {recipient?.name || "Conversation"}
            </h2>

            <div className="mt-1 flex items-center gap-1.5">
              {socketConnected ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                  <span className="text-xs text-green-700">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

                  <span className="text-xs text-amber-700">
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
            className="rounded-xl p-2.5 text-[#8696A0]"
          >
            <Phone className="h-5 w-5" />
          </button>

          <button
            type="button"
            disabled
            title="Video calls coming soon"
            className="rounded-xl p-2.5 text-[#8696A0]"
          >
            <Video className="h-5 w-5" />
          </button>

          <button
            type="button"
            title="More options coming soon"
            className="rounded-xl p-2.5 text-[#667781] hover:bg-[#F7F9F8]"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* MESSAGES */}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-700" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F9F8]">
              <MessageCircle className="h-8 w-8 text-[#8696A0]" />
            </div>

            <p className="font-medium text-[#111B21]">
              No messages yet
            </p>

            <p className="mt-1 text-sm text-[#8696A0]">
              Say hello and start the conversation.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-5">

            {messages.map((message) => {
              const isOwnMessage =
                message.senderId === currentUser?.id ||
                message.sender?.id === currentUser?.id;

              const isLocationMessage =
                message.type === "LOCATION";

              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    isOwnMessage
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {!isOwnMessage && (
                    <Avatar
                      user={message.sender || recipient}
                      size="h-8 w-8"
                    />
                  )}

                  <div
                    className={`flex max-w-[80%] flex-col ${
                      isOwnMessage
                        ? "items-end"
                        : "items-start"
                    }`}
                  >
                    {isLocationMessage ? (
                      <LocationPreview
                        latitude={message.latitude}
                        longitude={message.longitude}
                        onClick={() =>
                          handleOpenLocation(
                            message.latitude,
                            message.longitude
                          )
                        }
                      />
                    ) : (
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          isOwnMessage
                            ? "rounded-br-md bg-indigo-500 text-[#111B21]"
                            : "rounded-bl-md border border-[#E9EDEF] bg-[#F7F9F8] text-[#111B21]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">
                          {message.content}
                        </p>
                      </div>
                    )}

                    <span className="mt-1 px-1 text-[10px] text-[#8696A0]">
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

      {/* CONNECTION WARNING */}

      {!socketConnected && (
        <div className="flex items-center gap-2 border-t border-amber-500/10 bg-amber-500/5 px-4 py-2 text-xs text-amber-700">
          <WifiOff className="h-4 w-4" />
          Reconnecting to chat server...
        </div>
      )}

      {/* ERROR */}

      {(sendError || error) && (
        <div className="px-4 pb-2 text-xs text-red-700">
          {sendError || error}
        </div>
      )}

      {/* MESSAGE COMPOSER */}

      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-[#E9EDEF] bg-white p-4 sm:px-6"
      >
        <div className="mx-auto flex max-w-4xl items-end gap-2 sm:gap-3">

          {/* TEXT INPUT */}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            maxLength={5000}
            className="max-h-32 min-h-[48px] flex-1 resize-y rounded-2xl border border-[#E9EDEF] bg-[#F7F9F8] px-4 py-3 text-sm text-[#111B21] outline-none placeholder:text-[#8696A0] focus:border-indigo-500"
          />

          {/* SHARE LOCATION */}

          <button
            type="button"
            onClick={handleShareLocation}
            disabled={
              sending ||
              locationLoading ||
              !socketConnected
            }
            title="Share current location"
            aria-label="Share current location"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D9E1E5] bg-[#F7F9F8] text-indigo-700 transition hover:bg-indigo-500/10 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {locationLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </button>

          {/* SEND MESSAGE */}

          <button
            type="submit"
            disabled={
              !content.trim() ||
              sending ||
              !socketConnected
            }
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-[#111B21] transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>

        </div>

        <p className="mx-auto mt-2 max-w-4xl text-[10px] text-[#8696A0]">
          Press Enter to send · Shift + Enter for a new line
        </p>
      </form>

    </div>
  );
};

export default ChatWindow;
