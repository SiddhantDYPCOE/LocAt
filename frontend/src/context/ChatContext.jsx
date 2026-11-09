
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { useAuth } from "./AuthContext.jsx";
import { useConnections } from "./ConnectionContext.jsx";

import chatService from "../services/chat.service.js";
import {
  connectSocket,
  disconnectSocket
} from "../socket/socket.js";

const ChatContext = createContext(null);

const extractConversation = (response) => {
  const payload = response?.data ?? response;

  return (
    payload?.conversation ||
    payload?.data?.conversation ||
    payload?.data ||
    payload
  );
};

const extractConversations = (response) => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.conversations)) {
    return payload.conversations;
  }
  if (Array.isArray(payload?.data?.conversations)) {
    return payload.data.conversations;
  }

  return [];
};

const extractMessages = (response) => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data?.messages)) {
    return payload.data.messages;
  }
  if (Array.isArray(payload?.data)) return payload.data;

  return [];
};

export const ChatProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { connections } = useConnections();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const joinedConversationRef = useRef(null);

  // Keep selected conversation available to socket callbacks.
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Fetch persisted conversations after authentication.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const fetchConversations = async () => {
      setConversationsLoading(true);

      try {
        const response = await chatService.getConversations();
        const fetchedConversations = extractConversations(response);

        if (!cancelled) {
          setConversations(fetchedConversations);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
            "Unable to load conversations"
          );
        }
      } finally {
        if (!cancelled) {
          setConversationsLoading(false);
        }
      }
    };

    fetchConversations();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Connect Socket.IO after authentication.
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      socketRef.current = null;
      joinedConversationRef.current = null;
      setSocketConnected(false);
      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setSocketConnected(true);

      const conversationId =
        selectedConversationRef.current?.id;

      if (conversationId) {
        socket.emit(
          "chat:join",
          { conversationId },
          (response) => {
            if (response?.success) {
              joinedConversationRef.current = conversationId;
            } else {
              console.error(
                "Chat room join failed:",
                response?.message
              );
            }
          }
        );
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      joinedConversationRef.current = null;
    };

    const handleNewMessage = (message) => {
      if (
        message?.conversationId !==
        selectedConversationRef.current?.id
      ) {
        return;
      }

      setMessages((previousMessages) => {
        const exists = previousMessages.some(
          (item) => item.id === message.id
        );

        if (exists) return previousMessages;

        return [...previousMessages, message];
      });

      // Update latest message and ordering in conversation list.
      setConversations((previous) => {
        const updated = previous.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                lastMessage: message,
                updatedAt: message.createdAt
              }
            : conversation
        );

        return updated.sort(
          (a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:new-message", handleNewMessage);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:new-message", handleNewMessage);
    };
  }, [isAuthenticated]);

  // Leave previous room and join selected room.
  useEffect(() => {
    const socket = socketRef.current;
    const conversationId = selectedConversation?.id;

    if (!socket?.connected || !conversationId) {
      joinedConversationRef.current = null;
      return;
    }

    const previousId = joinedConversationRef.current;

    if (previousId && previousId !== conversationId) {
      socket.emit("chat:leave", {
        conversationId: previousId
      });
    }

    socket.emit(
      "chat:join",
      { conversationId },
      (response) => {
        if (response?.success) {
          joinedConversationRef.current = conversationId;
        } else {
          joinedConversationRef.current = null;
          setError(
            response?.message || "Unable to join conversation"
          );
        }
      }
    );
  }, [selectedConversation, socketConnected]);

  // Reset chat state when the user logs out.
  useEffect(() => {
    if (!isAuthenticated) {
      setConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      setError(null);
      setConversationsLoading(false);
    }
  }, [isAuthenticated]);

  // Create or retrieve a direct conversation.
  const openConversation = useCallback(async (recipientId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await chatService.createConversation(recipientId);
      const conversation = extractConversation(response);

      if (!conversation?.id) {
        throw new Error("Invalid conversation response from server");
      }

      const connection = connections.find(
        (item) => item.user?.id === recipientId
      );

      const conversationWithUser = {
        ...conversation,
        user:
          conversation.user ||
          connection?.user ||
          null
      };

      setConversations((previous) => {
        const exists = previous.some(
          (item) => item.id === conversation.id
        );

        const updated = exists
          ? previous.map((item) =>
              item.id === conversation.id
                ? { ...item, ...conversationWithUser }
                : item
            )
          : [conversationWithUser, ...previous];

        return updated.sort(
          (a, b) =>
            new Date(b.updatedAt || 0) -
            new Date(a.updatedAt || 0)
        );
      });

      setSelectedConversation(conversationWithUser);
      setMessages([]);

      const messageResponse = await chatService.getMessages(
        conversation.id
      );

      setMessages(extractMessages(messageResponse));

      return conversationWithUser;
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to open conversation"
      );

      throw err;
    } finally {
      setLoading(false);
    }
  }, [connections]);

  // Select an existing conversation.
  const selectConversation = useCallback(async (conversation) => {
    if (!conversation?.id) return;

    setSelectedConversation(conversation);
    setMessages([]);
    setLoading(true);
    setError(null);

    try {
      const response = await chatService.getMessages(
        conversation.id
      );

      setMessages(extractMessages(response));
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load messages"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Send messages using Socket.IO.
  const sendMessage = useCallback(async (content) => {
    const socket = socketRef.current;
    const conversationId = selectedConversationRef.current?.id;

    if (!conversationId) {
      throw new Error("Select a conversation first");
    }

    if (!socket?.connected) {
      throw new Error("Chat server is disconnected");
    }

    if (
      !joinedConversationRef.current ||
      joinedConversationRef.current !== conversationId
    ) {
      throw new Error("Conversation is not connected yet");
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) return;

    setSending(true);
    setError(null);

    try {
      return await new Promise((resolve, reject) => {
        socket.timeout(10000).emit(
          "chat:send",
          {
            conversationId,
            content: trimmedContent
          },
          (timeoutError, response) => {
            if (timeoutError) {
              reject(new Error("Message sending timed out"));
              return;
            }

            if (!response?.success) {
              reject(
                new Error(
                  response?.message || "Unable to send message"
                )
              );
              return;
            }

            resolve(response.data);
          }
        );
      });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  const value = {
    conversations,
    selectedConversation,
    messages,
    loading,
    conversationsLoading,
    sending,
    socketConnected,
    error,

    openConversation,
    selectConversation,
    setSelectedConversation,
    sendMessage
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useChat must be used inside ChatProvider");
  }

  return context;
};
