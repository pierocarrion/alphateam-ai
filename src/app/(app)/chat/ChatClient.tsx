"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, Button, Icon, Alpha, TopBar } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import { useChannel } from "@/features/chat/application/hooks/useChannel";
import { useMention } from "@/features/chat/application/hooks/useMention";
import { useSpeechRecognition } from "@/features/chat/application/hooks/useSpeechRecognition";
import { ChatMessage } from "@/features/chat/presentation/components/ChatMessage";
import { DesktopMessage } from "@/features/chat/presentation/components/DesktopMessage";
import { DayDivider } from "@/features/chat/presentation/components/DayDivider";
import { TypingRow } from "@/features/chat/presentation/components/TypingRow";
import { InterceptCard } from "@/features/chat/presentation/components/InterceptCard";
import {
  MentionSuggestions,
  type MentionCandidate,
} from "@/features/chat/presentation/components/MentionSuggestions";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { fetchJson } from "@/shared/lib/api";
import { createLogger } from "@/shared/lib/logger";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import { DesktopRail } from "./DesktopRail";

const log = createLogger("chat");

interface ChatClientProps {
  channelId: string;
  channelName: string;
  channelType: "channel" | "dm";
  peerName?: string | null;
  mood: { value: number; label: string; note: string };
  loadGuardian: { who: string; title: string; note: string } | null;
}

export function ChatClient({
  channelId,
  channelName,
  channelType,
  peerName,
  mood,
  loadGuardian,
}: ChatClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [locale] = useLocale();
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, k, v);
  const { messages, members, isLoading, sendMessage, detected: detectedFromSend, isSending, queryError } =
    useChannel(channelId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [detectedFromApi, setDetectedFromApi] = useState<DetectedTaskDraft | null>(null);
  const detected = detectedFromSend ?? detectedFromApi;

  const { mention, register: registerMention, applyMention, close: closeMention } = useMention(draft, setDraft);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [lastQuery, setLastQuery] = useState(mention.query);

  const candidates = useMemo<MentionCandidate[]>(() => {
    const list: MentionCandidate[] = members.map((m) => ({
      id: m.id,
      name: m.name || "Unknown",
      personId: m.personId,
    }));
    list.push({ id: "alpha", name: "Alpha", personId: "alpha", isBot: true });
    return list;
  }, [members]);

  const filteredCandidates = useMemo(() => {
    const q = mention.query.trim().toLowerCase();
    if (!q) return candidates;
    const matched = candidates.filter((c) => c.name.toLowerCase().includes(q));
    // Always surface Alpha alongside matching members.
    if (!matched.some((c) => c.id === "alpha")) {
      const alpha = candidates.find((c) => c.id === "alpha");
      if (alpha) matched.push(alpha);
    }
    return matched;
  }, [candidates, mention.query]);

  // Reset highlight whenever the mention query changes (during render, no effect).
  if (mention.query !== lastQuery) {
    setLastQuery(mention.query);
    setHighlightIndex(0);
  }

  const mentionOpen = mention.active && filteredCandidates.length > 0;

  const warm = true;

  const micLang = locale.startsWith("es") ? "es-ES" : "en-US";

  const handleMicError = useCallback(
    (code: string) => {
      log.error("mic error", { code });
      let key: string;
      switch (code) {
        case "not-allowed":
        case "service-not-allowed":
          key = "chat.micErrorPermission";
          break;
        case "no-speech":
          key = "chat.micErrorNoSpeech";
          break;
        case "network":
          key = "chat.micErrorNetwork";
          break;
        case "audio-capture":
          key = "chat.micErrorNoMic";
          break;
        case "not-supported":
        case "start-failed":
          key = "chat.micErrorUnsupported";
          break;
        default:
          key = "chat.micErrorUnknown";
      }
      toast.error(tr(key));
    },
    [tr]
  );

  const { supported: micSupported, listening: micListening, interim: micInterim, start: micStart, stop: micStop } =
    useSpeechRecognition({
      lang: micLang,
      onFinal: (finalText) => {
        log.info("mic final transcript", { finalText });
        setDraft((prev) => (prev ? `${prev} ${finalText}` : finalText));
      },
      onError: handleMicError,
    });

  const micActiveText = micListening && micInterim ? `${draft}${draft ? " " : ""}${micInterim}` : draft;
  const isDm = channelType === "dm";
  const titleName = isDm ? (peerName ?? "Direct message") : channelName;
  const peerPersonId = peerName ? personIdFromName(peerName) : "you";

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
    fetchJson<{ detected: DetectedTaskDraft | null }>(`/api/channels/${channelId}/messages`)
      .then((data) => setDetectedFromApi(data.detected ?? null))
      .catch(() => {});
  }, [channelId]);

  const handleSend = () => {
    if (!draft.trim()) return;
    log.info("send", { length: draft.length, channelId });
    sendMessage.mutate(draft, {
      onError: (err) => log.error("send failed", err),
    });
    setDraft("");
    setDismissed(false);
  };

  const handleSelectMention = (c: MentionCandidate) => {
    applyMention(c.name);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filteredCandidates.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Escape") {
        closeMention();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const pick = filteredCandidates[highlightIndex] ?? filteredCandidates[0];
        if (pick) {
          e.preventDefault();
          applyMention(pick.name);
          return;
        }
      }
    }
    if (e.key === "Enter") handleSend();
  };

  const handleShowTask = async () => {
    if (!detected) return;
    try {
      const data = await fetchJson<{ task: { id: string } }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: detected }),
      });
      router.push(`/task/${data.task.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("chat.createTaskError"));
    }
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
          <TopBar kicker={isDm ? tr("chat.dm") : tr("chat.team")} title={isDm ? titleName : `# ${titleName}`} />
          <div className="flex flex-none items-center gap-2 border-b border-line px-4 pb-3 pt-0">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-display text-lg text-ink">
                {isDm ? (
                  <>
                    <Avatar who={peerPersonId} size={20} />
                    {titleName}
                  </>
                ) : (
                  <>
                    <span className="text-ink-3">#</span>
                    {titleName}
                  </>
                )}
              </div>
              <div className="text-xs text-ink-3">
                {session?.user?.name || tr("chat.you")} · {tr("chat.you").toLowerCase()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Alpha size={26} mood="calm" />
              <span className="text-xs text-ink-3">
                {warm ? tr("chat.alphaHere") : tr("chat.alpha")}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden flex-none items-center gap-2 border-b border-line bg-[radial-gradient(120%_60%_at_50%_-10%,#221c2c,var(--color-bg)_60%)] px-6 py-4 lg:flex">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-display text-lg text-ink">
              {isDm ? (
                <>
                  <Avatar who={peerPersonId} size={22} />
                  {titleName}
                </>
              ) : (
                <>
                  <span className="text-ink-3">#</span>
                  {titleName}
                </>
              )}
            </div>
            <div className="text-xs text-ink-3">
              {session?.user?.name || tr("chat.you")} · {tr("chat.listeningQuietly")}
            </div>
          </div>
          <Alpha size={28} mood="calm" />
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pb-2 pt-3 scrollbar-hide lg:px-6 lg:pb-3 lg:pt-5"
        >
          {isLoading ? (
            <div className="py-10 text-center text-ink-3">{tr("chat.loading")}</div>
          ) : queryError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-red-400">{queryError.message}</p>
              <p className="mt-1 text-xs text-ink-3">{tr("chat.errorRetry")}</p>
            </div>
          ) : (
            <>
              <DayDivider label={tr("chat.today")} />
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
          <div className="relative flex items-center gap-2 rounded-full border border-line bg-surface p-1 pl-4">
            {mentionOpen && (
              <MentionSuggestions
                candidates={filteredCandidates}
                highlightIndex={highlightIndex}
                onSelect={handleSelectMention}
                onHover={setHighlightIndex}
              />
            )}
            <input
              value={micActiveText}
              {...registerMention("mobile")}
              onKeyDown={handleInputKeyDown}
              placeholder={tr("chat.placeholder", { target: isDm ? titleName : `#${titleName}` }) + "…"}
              className="flex-1 bg-transparent py-2 text-[15.5px] text-ink outline-none placeholder:text-ink-3"
            />
            {micSupported && (
              <button
                onClick={() => {
                  if (micListening) {
                    micStop();
                  } else {
                    log.info("mic start clicked", { lang: micLang });
                    micStart();
                  }
                }}
                aria-label={micListening ? "Stop voice transcription" : "Transcribe with voice"}
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full transition-colors"
                style={{
                  background: micListening
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)",
                }}
              >
                <Icon
                  name="mic"
                  size={18}
                  color={micListening ? "var(--color-accent-ink)" : "var(--color-ink-3)"}
                />
              </button>
            )}
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
            {micListening ? tr("chat.listeningHint") : tr("chat.micHint")}
          </p>
        </div>

        {/* Desktop composer */}
        <div className="hidden flex-none bg-[radial-gradient(120%_60%_at_50%_-10%,#221c2c,var(--color-bg)_60%)] px-6 pb-5 pt-2 lg:block">
          <div className="relative flex items-center gap-2.5 rounded-2xl border border-line-2 bg-surface p-2 pl-4">
            {mentionOpen && (
              <MentionSuggestions
                candidates={filteredCandidates}
                highlightIndex={highlightIndex}
                onSelect={handleSelectMention}
                onHover={setHighlightIndex}
              />
            )}
            <input
              value={micActiveText}
              {...registerMention("desktop")}
              onKeyDown={handleInputKeyDown}
              placeholder={tr("chat.placeholder", { target: isDm ? titleName : `#${titleName}` }) + "…"}
              className="flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
            {micSupported && (
              <button
                onClick={() => {
                  if (micListening) {
                    micStop();
                  } else {
                    log.info("mic start clicked", { lang: micLang });
                    micStart();
                  }
                }}
                aria-label={micListening ? "Stop voice transcription" : "Transcribe with voice"}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors"
                style={{
                  background: micListening
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)",
                }}
              >
                <Icon
                  name="mic"
                  size={18}
                  color={micListening ? "var(--color-accent-ink)" : "var(--color-ink-3)"}
                />
              </button>
            )}
            <Button
              size="sm"
              disabled={!draft.trim() || isSending}
              onClick={handleSend}
            >
              {micListening ? tr("chat.listening") : tr("chat.send")}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop right rail (channels only) */}
      {channelType === "channel" && (
        <div className="hidden xl:flex">
          <DesktopRail
            detected={detected}
            mood={mood}
            loadGuardian={loadGuardian}
          />
        </div>
      )}
    </div>
  );
}
