"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChatMessageData } from "@/features/chat/presentation/components/ChatMessage";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { fetchJson, ApiError } from "@/shared/lib/api";

export interface ChannelMember {
  id: string;
  name: string;
  role: string;
  personId: string;
}

interface ChannelResponse {
  channel: { id: string; name: string };
  messages: ChatMessageData[];
  detected: DetectedTaskDraft | null;
  members?: ChannelMember[];
}

interface SendMessageResponse {
  message: ChatMessageData;
  detected: DetectedTaskDraft | null;
  alphaReply?: ChatMessageData | null;
}

export function useChannel(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["channel", channelId];

  const { data, isLoading, error } = useQuery<ChannelResponse>({
    queryKey,
    queryFn: () => fetchJson<ChannelResponse>(`/api/channels/${channelId}/messages`),
  });

  const sendMessage = useMutation<SendMessageResponse, Error, string>({
    mutationFn: async (text) => {
      const data = await fetchJson<SendMessageResponse>(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<ChannelResponse>(queryKey, (old) => {
        if (!old) return old;
        const next = [...old.messages, result.message];
        if (result.alphaReply) next.push(result.alphaReply);
        return { ...old, messages: next };
      });
    },
  });

  const queryError = error instanceof ApiError ? error : null;

  return {
    channel: data?.channel,
    messages: data?.messages ?? [],
    members: data?.members ?? [],
    isLoading,
    queryError,
    sendMessage,
    detected: sendMessage.data?.detected ?? null,
    isSending: sendMessage.isPending,
  };
}
