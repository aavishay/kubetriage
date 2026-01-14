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
    { role: 'model', content: 'Hello! I am your KubeTriage assistant. How can I help you optimize your cluster today?', timestamp: Date.now() }
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
      const { scrollHeight, clientHeight } = scrollRef.current;
      // Ensure we scroll to the bottom of the container
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
    ? `fixed right-4 transition-all duration-300 z-50 flex flex-col bg-white dark:bg-dark-card border border-gray-100 dark:border-white/5 shadow-2xl rounded-[2rem] overflow-hidden ${isExpanded ? 'top-4 bottom-4 w-[800px]' : 'bottom-4 w-[400px] h-[600px]'}`
    : `w-full flex flex-col bg-white dark:bg-dark-card border border-gray-100 dark:border-white/5 rounded-[2rem] overflow-hidden h-[500px] mb-6 shadow-sm`;

  return (
    <div className={containerClasses}>

      {/* Header */}
      <div className="bg-gray-50/80 dark:bg-dark-bg/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary-600 rounded-lg shadow-lg shadow-primary-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tighter">KubeTriage Copilot</h3>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {variant === 'floating' && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area - Scoped scrolling via ref */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-dark-bg scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-primary-600' : 'bg-primary-700'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className={`max-w-[85%] p-4 rounded-3xl text-sm shadow-sm font-sans ${msg.role === 'user'
              ? 'bg-primary-600 text-white rounded-tr-sm shadow-xl shadow-primary-500/20'
              : 'bg-white dark:bg-dark-card border border-gray-100 dark:border-white/5 text-gray-800 dark:text-gray-200 rounded-tl-sm'
              }`}>
              {msg.role === 'model' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:bg-zinc-900 prose-pre:p-2 prose-pre:rounded">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.8rem', overflowX: 'auto', maxWidth: '100%' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
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
                  ? <div className="italic opacity-90">Shared workload context for analysis...</div>
                  : msg.content
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-white/5 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }}
          className="flex items-center gap-2 bg-gray-100 dark:bg-dark-bg p-1.5 rounded-2xl border border-gray-100 dark:border-white/5 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask specific questions about this workload..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 px-3"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-3 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isTyping ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <div className="mt-2 text-center text-[10px] text-zinc-400">
          AI can make mistakes. Check important info.
        </div>
      </div>
    </div>
  );
};
