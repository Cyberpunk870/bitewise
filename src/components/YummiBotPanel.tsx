import React from 'react';

export type BotMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
  suggestions?: string[];
};

type Props = {
  onClose: () => void;
  messages: BotMessage[];
  typing: boolean;
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  onSuggestion: (label: string) => void;
};

export default function YummiBotPanel({ onClose, messages, typing, input, onInput, onSend, onSuggestion }: Props) {
  return (
    <div className="fixed right-4 bottom-20 w-80 glass-card border border-white/10 p-4 backdrop-blur-lg z-50 shadow-2xl animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span role="img" aria-label="bot">
            🤖
          </span>
          YummiBot
        </div>
        <button className="text-xs text-white/60 hover:text-white" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-line ${
              msg.from === 'bot' ? 'bg-white/10 text-white self-start' : 'bg-white text-black self-end'
            }`}
          >
            {msg.text}
            {msg.suggestions && (
              <ul className="mt-2 space-y-1 text-xs text-white/80">
                {msg.suggestions.map((line, idx) => (
                  <li key={`${msg.id}-s-${idx}`}>
                    <button className="underline decoration-dotted hover:text-white" onClick={() => onSuggestion(line)}>
                      {line}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {typing && (
          <div className="px-3 py-2 rounded-2xl bg-white/10 text-xs text-white/80 self-start">YummiBot is thinking…</div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
          placeholder="Ask for dishes or cuisines"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
        />
        <button className="rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-black" onClick={onSend}>
          Send
        </button>
      </div>
    </div>
  );
}
