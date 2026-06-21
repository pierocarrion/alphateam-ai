"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Icon, Mira, TopBar } from "@/shared/ui";
import { useChannel } from "@/features/chat/application/hooks/useChannel";
import { ChatMessage } from "@/features/chat/presentation/components/ChatMessage";
import { DesktopMessage } from "@/features/chat/presentation/components/DesktopMessage";
import { DayDivider } from "@/features/chat/presentation/components/DayDivider";
import { TypingRow } from "@/features/chat/presentation/components/TypingRow";
import { InterceptCard } from "@/features/chat/presentation/components/InterceptCard";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { DesktopRail } from "./DesktopRail";

interface ChatClientProps {
  channelId: string;
  channelName: string;
}

export function ChatClient({ channelId, channelName }: ChatClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { messages, isLoading, sendMessage, detected: detectedFromSend, isSending } =
    useChannel(channelId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [detectedFromApi, setDetectedFromApi] = useState<DetectedTaskDraft | null>(null);
  const detected = detectedFromSend ?? detectedFromApi;

  const warm = true;

  const currentUserId = session?.user?.id as string | undefined;
  const isYou = (m: { userId?: string }) => m.userId === currentUserId;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, isSending, detected]);

  useEffect(() => {
    fetch(`/api/channels/${channelId}/messages`)
      .then((res) => res.json())
      .then((data) => setDetectedFromApi(data.detected ?? null));
  }, [channelId]);

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage.mutate(draft);
    setDraft("");
    setDismissed(false);
  };

  const handleShowTask = () => {
    if (!detected) return;
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: detected }),
    })
      .then((res) => res.json())
      .then((data) => {
        router.push(`/task/${data.task.id}`);
      });
  };

  const lastMessage = messages[messages.length - 1];
  const showIntercept =
    detected && !dismissed && lastMessage && isYou(lastMessage);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="lg:hidden">
          <div className="h-[58px] flex-none" />
          <TopBar kicker="Team" title={`# ${channelName}`} />
          <div className="flex flex-none items-center gap-2 border-b border-line px-4 pb-3 pt-0">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-display text-lg text-ink">
                <span className="text-ink-3">#</span>
                {channelName}
              </div>
              <div className="text-xs text-ink-3">
                {session?.user?.name || "You"} · you
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mira size={26} mood="calm" />
              <span className="text-xs text-ink-3">
                {warm ? "Mira’s here" : "Mira"}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden flex-none items-center gap-2 border-b border-line bg-[radial-gradient(120%_60%_at_50%_-10%,#221c2c,var(--color-bg)_60%)] px-6 py-4 lg:flex">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-display text-lg text-ink">
              <span className="text-ink-3">#</span>
              {channelName}
            </div>
            <div className="text-xs text-ink-3">
              {session?.user?.name || "You"} · Mira is listening quietly
            </div>
          </div>
          <Mira size={28} mood="calm" />
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pb-2 pt-3 scrollbar-hide lg:px-6 lg:pb-3 lg:pt-5"
        >
          {isLoading ? (
            <div className="py-10 text-center text-ink-3">Loading chat…</div>
          ) : (
            <>
              <DayDivider label="Today" />
              {messages.map((m) => (
                <div key={m.id}>
                  <div className="lg:hidden">
                    <ChatMessage
                      message={m}
                      isYou={isYou(m)}
                      highlight={Boolean(
                        showIntercept &&
                          isYou(m) &&
                          m.id === lastMessage.id
                      )}
                    />
                  </div>
                  <div className="hidden lg:block">
                    <DesktopMessage
                      message={m}
                      isYou={isYou(m)}
                      highlight={Boolean(
                        showIntercept &&
                          isYou(m) &&
                          m.id === lastMessage.id
                      )}
                    />
                  </div>
                  {showIntercept && m.id === lastMessage.id && (
                    <div className="mb-3 ml-[50px]">
                      <InterceptCard
                        warm={warm}
                        task={detected}
                        onShow={handleShowTask}
                        onDismiss={() => setDismissed(true)}
                      />
                    </div>
                  )}
                </div>
              ))}
              {isSending && <TypingRow who={currentUserId ?? "you"} />}
            </>
          )}
          <div className="h-1.5" />
        </div>

        {/* Mobile composer */}
        <div className="flex-none bg-gradient-to-t from-bg to-transparent px-3.5 pb-3 pt-2 lg:hidden">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface p-1 pl-4">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder={`Message #${channelName}…`}
              className="flex-1 bg-transparent py-2 text-[15.5px] text-ink outline-none placeholder:text-ink-3"
            />
            <button
              onClick={handleSend}
              aria-label="Send"
              disabled={!draft.trim() || isSending}
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full transition-colors disabled:opacity-50"
              style={{
                background: draft.trim() ? "var(--color-accent)" : "var(--color-surface-2)",
              }}
            >
              <Icon
                name="send"
                size={18}
                color={draft.trim() ? "var(--color-accent-ink)" : "var(--color-ink-3)"}
              />
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-ink-3">
            Try “I need to write the launch report” — Mira will quietly notice.
          </p>
        </div>

        {/* Desktop composer */}
        <div className="hidden flex-none bg-[radial-gradient(120%_60%_at_50%_-10%,#221c2c,var(--color-bg)_60%)] px-6 pb-5 pt-2 lg:block">
          <div className="flex items-center gap-2.5 rounded-2xl border border-line-2 bg-surface p-2 pl-4">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder={`Message #${channelName}`}
              className="flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
            <Button
              size="sm"
              disabled={!draft.trim() || isSending}
              onClick={handleSend}
            >
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop right rail */}
      <div className="hidden xl:flex">
        <DesktopRail detected={detected} />
      </div>
    </div>
  );
}
