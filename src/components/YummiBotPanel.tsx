import React from 'react';

export type BotMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
  suggestions?: string[];
  pills?: string[];
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
    <div className="fixed right-4 top-24 w-80 max-w-[calc(100vw-2rem)] glass-card z-30 animate-fade-up rounded-2xl p-4 overflow-hidden" role="dialog" aria-label="YummiBot assistant">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">🤖 YummiBot</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium px-3 py-1 rounded-full bg-black/20 hover:bg-black/30 transition"
          aria-label="Close YummiBot"
        >
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
            {msg.pills && msg.pills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {msg.pills.map((pill, idx) => (
                  <button
                    key={`${msg.id}-p-${idx}`}
                    className="px-2 py-1 rounded-full text-[11px] bg-white/15 hover:bg-white/25 text-white/90"
                    onClick={() => onSuggestion(pill)}
                  >
                    {pill}
                  </button>
                ))}
              </div>
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
