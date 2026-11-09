
import { useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";

import ConversationList from "../../components/chat/ConversationList.jsx";
import ChatWindow from "../../components/chat/ChatWindow.jsx";

import { useChat } from "../../context/ChatContext.jsx";

const Chats = () => {
  const { selectedConversation, setSelectedConversation } = useChat();

  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const handleBack = () => {
    setMobileChatOpen(false);
    setSelectedConversation(null);
  };

  const handleOpenChat = () => {
    setMobileChatOpen(true);
  };

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-hidden lg:h-screen">

      {/* Desktop layout */}
      <div className="hidden h-full min-h-0 lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <ConversationList />
        <ChatWindow />
      </div>

      {/* Mobile layout */}
      <div className="flex h-full min-h-0 flex-col lg:hidden">

        {!mobileChatOpen ? (
          <div className="min-h-0 flex-1">
            <ConversationList onOpenChat={handleOpenChat} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-white/5 bg-[#0D1524] px-4 py-3">
              <button
                onClick={handleBack}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/5"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div>
                <p className="text-sm font-medium text-white">
                  Messages
                </p>
                <p className="text-xs text-slate-500">
                  Your conversation
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <ChatWindow />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Chats;
