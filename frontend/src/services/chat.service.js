import api from "./api.js";

const chatService = {
  createConversation: async (recipientId) => {
    const response = await api.post("/chat/conversation", {
      recipientId,
    });

    return response.data;
  },

  getConversations: async () => {
    const response = await api.get("/chat/conversations");
    return response.data;
  },

  getMessages: async (conversationId) => {
    const response = await api.get(
      `/chat/${conversationId}/messages`
    );

    return response.data;
  },

  sendMessage: async (conversationId, content) => {
    const response = await api.post(
      `/chat/${conversationId}/messages`,
      { content }
    );

    return response.data;
  },
};

export default chatService;