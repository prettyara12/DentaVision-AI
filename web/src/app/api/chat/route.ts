import { chatRequestSchema, lastTurns, type ChatEvent } from "@/features/chat/chat";
import { findingsContext } from "@/features/insight/insight";
import { readBody } from "@/lib/body";
import { streamChat } from "@/lib/gemini";
import { consumeQuota, getQuotaLimit, getQuotaSubject, quotaHeaders } from "@/lib/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, currentUser } from "@/lib/supabase/server";

// 100 messages of history plus up to 500 detections stay well under this.
const MAX_BODY_BYTES = 256 * 1024;

const fail = (status: number, code: string) => Response.json({ code }, { status });

export async function POST(request: Request) {
  const read = await readBody(request, MAX_BODY_BYTES);
  if ("error" in read) return read.error;
  const body = chatRequestSchema.safeParse(await read.body.json().catch(() => null));
  if (!body.success) return fail(400, "invalid_request");

  const { locale, messages, scan, chatId, scanId } = body.data;
  const history = lastTurns(messages);
  if (history.at(-1)?.role !== "user") return fail(400, "invalid_request");
  const scanContext = scan && {
    findingsContext: findingsContext(scan.detections).text,
    insightSummary: scan.insightSummary,
  };

  const user = await currentUser();
  const supabase = user ? await createClient() : null;

  let activeChatId: string | undefined = undefined;

  if (user && supabase) {
    if (chatId) {
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .eq("id", chatId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingChat) {
        return fail(404, "not_found");
      }
      activeChatId = existingChat.id;
    } else if (scanId) {
      const { data: scanRow } = await supabase
        .from("scans")
        .select("id")
        .eq("id", scanId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!scanRow) {
        return fail(404, "not_found");
      }

      const { data: scanChat } = await supabase
        .from("chats")
        .select("id")
        .eq("scan_id", scanId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (scanChat) {
        activeChatId = scanChat.id;
      } else {
        const { data: newChat, error: chatErr } = await supabase
          .from("chats")
          .insert({
            user_id: user.id,
            scan_id: scanId,
            title: "Chat Scan",
          })
          .select("id")
          .single();

        if (chatErr || !newChat) {
          return fail(500, "database_error");
        }
        activeChatId = newChat.id;
      }
    } else {
      const userQuestion = history.at(-1)?.text ?? "Diskusi";
      const { data: newChat, error: chatErr } = await supabase
        .from("chats")
        .insert({
          user_id: user.id,
          scan_id: null,
          title: userQuestion.slice(0, 50),
        })
        .select("id")
        .single();

      if (chatErr || !newChat) {
        return fail(500, "database_error");
      }
      activeChatId = newChat.id;
    }
  }

  // Quota is consumed only after authorization and validation succeed (docs/architecture.md §4.1).
  const subjectInfo = getQuotaSubject(user, request);
  const limit = getQuotaLimit(subjectInfo.role, "chat");
  const adminClient = createAdminClient();
  const quota = await consumeQuota(adminClient, subjectInfo.subject, "chat", limit);
  if (!quota.ok) {
    return Response.json(
      {
        code: "quota_exceeded",
        resetInSeconds: quota.resetInSeconds,
        role: subjectInfo.role,
      },
      {
        status: 429,
        headers: quotaHeaders({ limit, remaining: 0, resetInSeconds: quota.resetInSeconds }),
      },
    );
  }

  if (user && supabase && activeChatId) {
    const lastMsg = history.at(-1)!;
    const { error: msgErr } = await supabase.from("chat_messages").insert({
      chat_id: activeChatId,
      role: "user",
      content: lastMsg.text,
    });
    if (msgErr) {
      return fail(500, "database_error");
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let sent = 0;
      let fullText = "";
      try {
        for await (const text of streamChat(locale, scanContext ?? null, history, request.signal)) {
          fullText = text;
          if (text.length > sent) send({ type: "delta", text: text.slice(sent) });
          sent = text.length;
        }
        if (!sent) throw new Error("empty answer");

        if (user && supabase && activeChatId) {
          const { error: modelMsgErr } = await supabase.from("chat_messages").insert({
            chat_id: activeChatId,
            role: "model",
            content: fullText,
          });
          if (modelMsgErr) {
            console.error("Failed to persist model chat message:", modelMsgErr.message);
            send({ type: "error" });
            return;
          }
        }
        send({ type: "done", ...(activeChatId ? { chatId: activeChatId } : {}) });
      } catch (error) {
        if (!request.signal.aborted) {
          // Never log message content (docs/security-privacy.md §1).
          console.error("chat failed:", error instanceof Error ? error.message : "unknown");
          send({ type: "error" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // the client already went away
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
