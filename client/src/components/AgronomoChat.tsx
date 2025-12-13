import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send, Bot, User, Sparkles, Leaf, Bug, Droplets, Sun } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgronomoChatProps {
  fieldId?: number;
  fieldName?: string;
  className?: string;
}

const SUGGESTED_QUESTIONS = [
  { icon: Leaf, text: "Como está a saúde do meu campo?", color: "text-green-600" },
  { icon: Bug, text: "Há risco de pragas?", color: "text-orange-600" },
  { icon: Droplets, text: "Quando devo irrigar?", color: "text-blue-600" },
  { icon: Sun, text: "Previsão do tempo", color: "text-yellow-600" },
];

export function AgronomoChat({ fieldId, fieldName, className }: AgronomoChatProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const chatMutation = trpc.agronomist.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        timestamp: data.timestamp 
      }]);
    },
    onError: (error) => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Desculpe, ocorreu um erro: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    }
  });
  
  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = (text?: string) => {
    const msgToSend = text || message;
    if (!msgToSend.trim()) return;
    
    // Adicionar mensagem do usuário
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: msgToSend,
      timestamp: new Date().toISOString()
    }]);
    
    // Preparar histórico para contexto
    const history = messages.slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
    
    // Enviar para API
    chatMutation.mutate({ 
      message: msgToSend, 
      fieldId,
      conversationHistory: history
    });
    
    setMessage('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className={cn("flex flex-col h-[500px] bg-white rounded-xl border shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-green-800">Agrônomo IA</h3>
          <p className="text-xs text-green-600">
            {fieldName ? `Analisando: ${fieldName}` : 'Seu assistente agrícola'}
          </p>
        </div>
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-800 mb-2">Olá! Sou seu agrônomo virtual</h4>
            <p className="text-sm text-gray-500 mb-6">
              Pergunte qualquer coisa sobre seu campo, pragas, irrigação ou clima.
            </p>
            
            {/* Sugestões */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q.text)}
                  className="flex items-center gap-2 p-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <q.icon className={cn("w-4 h-4", q.color)} />
                  <span className="text-gray-700">{q.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex gap-3",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-green-600" />
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[80%] p-3 rounded-2xl",
                  msg.role === 'user' 
                    ? "bg-green-600 text-white rounded-br-md" 
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                )}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {chatMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-green-600 animate-pulse" />
                </div>
                <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      
      {/* Input */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seu campo..."
            disabled={chatMutation.isPending}
            className="flex-1 bg-white"
          />
          <Button 
            onClick={() => handleSend()} 
            disabled={chatMutation.isPending || !message.trim()}
            size="icon"
            className="bg-green-600 hover:bg-green-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AgronomoChat;
