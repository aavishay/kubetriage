import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Minimize2, Maximize2, Sparkles, User, Bot } from 'lucide-react';
import { ChatMessage, sendChatMessage } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useEscapeKey } from '../utils/useEscapeKey';

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string | null;
  variant?: 'floating' | 'embedded';
}

export const AIChatWidget: React.FC<AIChatWidgetProps> = ({ isOpen, onClose, initialContext, variant = 'floating' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: 'Hello! I am your AI Ops Co-Pilot. How can I assist with cluster optimization today?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  useEscapeKey(isOpen, onClose);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight } = scrollRef.current;
      scrollRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && initialContext) {
      handleSendMessage(initialContext, true);
    }
  }, [initialContext, isOpen]);

  const handleSendMessage = async (text: string, isSystemContext: boolean = false) => {
    if ((!text.trim() && !isSystemContext)) return;

    const newUserMsg: ChatMessage = {
      role: 'user',
      content: isSystemContext ? `Context for analysis:\n${text}\n\nPlease analyze this.` : text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    const history = messages.map(m => ({
      role: m.role,
      content: m.content
    })) as ChatMessage[];

    const responseText = await sendChatMessage(history, newUserMsg.content);

    setMessages(prev => [...prev, { role: 'model', content: responseText, timestamp: Date.now() }]);
    setIsTyping(false);
  };

  if (!isOpen) return null;

  // Container classes based on variant
  const containerClasses = variant === 'floating'
    ? `fixed right-4 bottom-4 transition-all duration-300 z-50 flex flex-col bg-dark-card border border-white/10 shadow-2xl rounded-2xl overflow-hidden ${
        isExpanded ? 'top-4 w-[600px]' : 'w-[400px] h-[500px]'
      }`
    : `w-full flex flex-col bg-dark-card border border-white/5 rounded-2xl overflow-hidden h-[500px]`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="bg-white/[0.02] border-b border-white/5 p-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary-600 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">AI Co-Pilot</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] text-emerald-400">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {variant === 'floating' && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-primary-600/20 text-primary-400' : 'bg-white/5 text-emerald-400'
            }`}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-tr-sm'
                : 'bg-white/5 text-zinc-300 rounded-tl-sm'
            }`}>
              {msg.role === 'model' ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-white/10 px-1 py-0.5 rounded text-primary-300 text-xs" {...props}>
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
                  ? <div className="text-white/70 italic text-xs border-l-2 border-white/20 pl-2">Context shared</div>
                  : msg.content
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white/[0.02] border-t border-white/5 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }}
          className="flex items-center gap-2 bg-white/5 p-1.5 pr-2 rounded-xl border border-white/5 focus-within:border-primary-500/30 transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this workload..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-zinc-500 px-2"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {isTyping ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-zinc-600">AI-Generated Insights</p>
        </div>
      </div>
    </div>
  );
};
