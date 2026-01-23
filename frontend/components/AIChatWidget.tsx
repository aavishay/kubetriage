import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Minimize2, Maximize2, Sparkles, User, Bot } from 'lucide-react';
import { ChatMessage } from '../types';
import { createChatSession, streamChatMessage } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Chat } from "@google/genai";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string | null;
  variant?: 'floating' | 'embedded';
}

export const AIChatWidget: React.FC<AIChatWidgetProps> = ({ isOpen, onClose, initialContext, variant = 'floating' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: 'Hello! I am your Neural Ops Co-Pilot. How can I assist with cluster optimization today?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Ref for the scrollable container
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ref to hold the Chat Session instance
  const chatSessionRef = useRef<Chat | null>(null);

  useEffect(() => {
    // Initialize chat session
    chatSessionRef.current = createChatSession();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight } = scrollRef.current;
      scrollRef.current.scrollTo({
        top: scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isOpen]);

  // Handle incoming context from other views
  useEffect(() => {
    if (isOpen && initialContext && chatSessionRef.current) {
      handleSendMessage(initialContext, true);
    }
  }, [initialContext, isOpen]);

  const handleSendMessage = async (text: string, isSystemContext: boolean = false) => {
    if ((!text.trim() && !isSystemContext) || !chatSessionRef.current) return;

    // User Message
    const newUserMsg: ChatMessage = {
      role: 'user',
      content: isSystemContext ? `Context for analysis:\n${text}\n\nPlease analyze this.` : text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Placeholder for Model Response
    const modelMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { role: 'model', content: '', timestamp: modelMsgId }]);

    let fullResponse = "";

    await streamChatMessage(chatSessionRef.current, newUserMsg.content, (chunk) => {
      fullResponse += chunk;
      setMessages(prev => prev.map(msg =>
        msg.timestamp === modelMsgId
          ? { ...msg, content: fullResponse }
          : msg
      ));
    });

    setIsTyping(false);
  };

  if (!isOpen) return null;

  // Dynamic classes based on variant
  const containerClasses = variant === 'floating'
    ? `fixed right-6 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-50 flex flex-col bg-dark-bg/90 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden ring-1 ring-white/5 ${isExpanded ? 'top-6 bottom-6 w-[800px]' : 'bottom-6 w-[450px] h-[650px]'}`
    : `w-full flex flex-col bg-dark-card/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden h-[600px] mb-8 shadow-inner`;

  return (
    <div className={containerClasses}>

      {/* Header */}
      <div className="bg-white/5 dark:bg-black/20 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary-500 blur-lg opacity-40 animate-pulse"></div>
            <div className="p-2 bg-gradient-to-br from-primary-600 to-primary-900 rounded-xl relative border border-white/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-sm text-white tracking-wide font-display">NEURAL CO-PILOT</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Online & Linked</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {variant === 'floating' && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-lg mt-1 ${msg.role === 'user'
                ? 'bg-primary-600/20 border-primary-500/30'
                : 'bg-white/5 border-white/10'
              }`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-primary-400" /> : <Bot className="w-4 h-4 text-emerald-400" />}
            </div>

            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm relative overflow-hidden group ${msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-tr-sm shadow-primary-500/20'
                : 'bg-white/5 border border-white/5 text-zinc-300 rounded-tl-sm'
              }`}>
              {/* Subtle background gradient for messages */}
              <div className={`absolute inset-0 opacity-10 pointer-events-none ${msg.role === 'user' ? 'bg-gradient-to-br from-white to-transparent' : 'bg-gradient-to-br from-blue-500 to-transparent'
                }`}></div>

              <div className="relative z-10">
                {msg.role === 'model' ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg">
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.8rem', overflowX: 'auto', maxWidth: '100%', background: '#00000040' }}
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={`${className} bg-white/10 px-1 py-0.5 rounded text-primary-300`} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {msg.content || (isTyping && idx === messages.length - 1 ? "Thinking..." : "")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content.startsWith('Context for analysis:')
                    ? <div className="text-white/70 italic text-xs border-l-2 border-white/30 pl-3">Context shared for analysis</div>
                    : msg.content
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/20 backdrop-blur-md border-t border-white/5 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }}
          className="flex items-center gap-3 bg-white/5 p-2 pr-2.5 rounded-xl border border-white/5 focus-within:ring-1 focus-within:ring-primary-500/50 focus-within:border-primary-500/50 transition-all shadow-inner"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask specific questions about this workload..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-100 placeholder:text-zinc-500 px-3"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
          >
            {isTyping ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <div className="mt-3 flex justify-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center gap-1.5 align-middle">
            <Sparkles className="w-3 h-3 text-primary-800" />
            AI-Generated Insights
          </p>
        </div>
      </div>
    </div>
  );
};
