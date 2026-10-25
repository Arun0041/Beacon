import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { mesh } from "../../lib/net";
import { useNet } from "../../lib/store";
import { fmtTime } from "../../lib/geo";
import type { Channel } from "../../lib/types";

const CHANNELS: { id: Channel; label: string; hint: string }[] = [
  { id: "general", label: "Neighbourhood", hint: "Everyone on the mesh" },
  { id: "rescue", label: "Rescue coordination", hint: "Volunteers and responders" },
];

export default function Chat() {
  const messages = useNet((s) => s.messages);
  const me = useNet((s) => s.me);
  const [ch, setCh] = useState<Channel>("general");
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => messages.filter((m) => m.ch === ch).sort((a, b) => a.ts - b.ts),
    [messages, ch],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length]);

  function send() {
    const t = text.trim();
    if (!t) return;
    mesh.sendMessage(ch, t);
    setText("");
  }

  return (
    <div className="mx-auto flex h-full max-w-[520px] flex-col pb-[64px]">
      {/* channel switch */}
      <div className="flex gap-2 border-b border-line px-4 py-2.5">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCh(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              ch === c.id ? "bg-ink text-white" : "bg-surface2 text-ink2 hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11.5px] text-ink3">{list.length} messages</span>
      </div>
      <div className="border-b border-line bg-surface px-4 py-1">
        <span className="text-[11.5px] text-ink3">{CHANNELS.find((c) => c.id === ch)?.hint} · no towers needed</span>
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {list.length === 0 ? (
          <div className="card mt-6 p-5 text-center text-[13px] text-ink2">
            No messages yet. Anything you send hops phone-to-phone across the mesh.
          </div>
        ) : (
          list.map((m) => {
            const mine = m.from === (me?.name ?? "") && m.from !== "";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className="mb-1 text-[11px] text-ink3">
                  {mine ? "You" : m.from} · {fmtTime(m.ts)}
                </div>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                    mine
                      ? "rounded-br-md bg-blue text-white"
                      : "rounded-bl-md border border-line bg-surface text-ink"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="border-t border-line bg-surface p-3">
        <div className="mx-auto flex max-w-[520px] gap-2">
          <input
            className="input flex-1 rounded-full"
            placeholder={`Message ${ch === "general" ? "neighbours" : "rescue team"}…`}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="btn btn-primary !rounded-full px-4"
            onClick={send}
            disabled={!text.trim()}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
