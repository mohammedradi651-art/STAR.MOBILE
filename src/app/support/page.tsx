'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
};

export default function GeminiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // رسالة ترحيب
  useEffect(() => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'model',
        content:
          'يا حيّاك الله 🌟\nأنا مساعد ستار موبايل الذكي، اسألني أي شيء 😊',
      },
    ]);
  }, []);

  // النزول للأسفل تلقائي
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // إرسال الرسالة
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // تجهيز history لـ Gemini
      const history = updatedMessages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      // طلب Gemini
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: history,
          }),
        }
      );

      const data = await response.json();

      console.log(data);

      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'ما قدرت أرد حالياً 😅';

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        content: aiText,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          content:
            'حصل خطأ أثناء الاتصال بـ Gemini 😢\nتأكد من API KEY أو الإنترنت.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // مسح المحادثة
  const clearChat = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'model',
        content: 'تم مسح المحادثة ✨\nكيف أقدر أساعدك؟',
      },
    ]);
  };

  return (
    <div className="h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">

      {/* Header */}
      <div className="bg-primary text-white p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Bot className="w-7 h-7" />
          <div>
            <h1 className="font-black text-lg">Gemini AI Chat</h1>
            <p className="text-xs opacity-70">متصل الآن</p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-2 rounded-xl hover:bg-white/10 transition"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === 'user'
                ? 'justify-start'
                : 'justify-end'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-md text-sm font-bold whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-white dark:bg-slate-900 rounded-bl-md'
              }`}
            >
              <div className="flex items-center gap-2 mb-2 opacity-60 text-[10px]">
                {msg.role === 'user' ? (
                  <>
                    <User size={12} />
                    أنت
                  </>
                ) : (
                  <>
                    <Bot size={12} />
                    Gemini
                  </>
                )}
              </div>

              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-3xl rounded-bl-md shadow-md flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-bold">
                Gemini يفكر...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t">
        <div className="relative max-w-2xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                sendMessage();
              }
            }}
            placeholder="اكتب رسالتك هنا..."
            className="w-full h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 px-5 pr-14 outline-none font-bold"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}