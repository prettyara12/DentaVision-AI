import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classCatalog } from "@/features/scan/class-catalog";
import { analyzeResultSchema, type AnalyzeResult } from "@/features/scan/result";
import type { Database } from "@/lib/supabase/database.types";

export type OperationResult = {
  ok: boolean;
  error?: string;
  notFound?: boolean;
};

export type UserScanSummary = {
  id: string;
  createdAt: string;
  imageUrl: string;
  attentionCount: number;
  detectionsCount: number;
  modelVersion: string;
};

export type UserChatSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  scanId: string | null;
};

export type ScanDetail = {
  id: string;
  userId: string;
  createdAt: string;
  source: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  image: {
    url: string;
    width: number;
    height: number;
  };
  modelVersion: string;
  detections: AnalyzeResult["detections"];
  heatmaps: Record<string, string>;
  insight: {
    locale: string;
    version: string;
    data: unknown;
  } | null;
  chat: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: number;
      role: string;
      content: string;
      createdAt: string;
    }>;
  } | null;
};

/**
 * Saves an uploaded scan to Storage and inserts the scan metadata row into database.
 */
export async function saveScanUpload(
  supabase: SupabaseClient<Database>,
  userId: string,
  scanId: string,
  imageBytes: Uint8Array | Buffer,
  result: AnalyzeResult,
): Promise<void> {
  const originalPath = `${userId}/${scanId}/original.jpg`;
  const { error: originalUploadError } = await supabase.storage
    .from("scans")
    .upload(originalPath, imageBytes, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (originalUploadError) {
    throw new Error(`Failed to upload original scan image: ${originalUploadError.message}`);
  }

  for (const [classId, base64] of Object.entries(result.heatmaps)) {
    const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");
    const heatmapPath = `${userId}/${scanId}/heatmap-${classId}.png`;
    const { error: heatmapUploadError } = await supabase.storage
      .from("scans")
      .upload(heatmapPath, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (heatmapUploadError) {
      throw new Error(`Failed to upload heatmap ${classId}: ${heatmapUploadError.message}`);
    }
  }

  const { error: insertError } = await supabase.from("scans").insert({
    id: scanId,
    user_id: userId,
    image_path: originalPath,
    image_width: result.image.width,
    image_height: result.image.height,
    model_version: result.model_version,
    detections: result.detections,
    heatmap_class_ids: Object.keys(result.heatmaps).map(Number),
    source: "upload",
  });

  if (insertError) {
    throw new Error(`Failed to insert scan record: ${insertError.message}`);
  }
}

/**
 * Deletes scan objects from Storage first, then removes the scan row from the database.
 * If Storage removal fails, the database row is NEVER touched.
 */
export async function deleteScan(
  supabase: SupabaseClient<Database>,
  userId: string,
  scanId: string,
): Promise<OperationResult> {
  const folder = `${userId}/${scanId}`;
  const { data: files, error: listError } = await supabase.storage.from("scans").list(folder);

  if (listError) {
    return { ok: false, error: listError.message };
  }

  if (files && files.length > 0) {
    const paths = files.map((f) => `${folder}/${f.name}`);
    const { error: removeError } = await supabase.storage.from("scans").remove(paths);
    if (removeError) {
      return { ok: false, error: removeError.message };
    }
  }

  const { error: dbError } = await supabase
    .from("scans")
    .delete()
    .eq("id", scanId)
    .eq("user_id", userId);

  if (dbError) {
    return { ok: false, error: dbError.message };
  }

  return { ok: true };
}

/**
 * Deletes a chat row belonging to the user from the database.
 */
export async function deleteChat(
  supabase: SupabaseClient<Database>,
  userId: string,
  chatId: string,
): Promise<OperationResult> {
  const { error: dbError } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", userId);

  if (dbError) {
    return { ok: false, error: dbError.message };
  }

  return { ok: true };
}

/**
 * Lists and removes all user scan files from Storage first, then deletes the auth user via adminClient.
 * If Storage removal fails, the user is NOT deleted.
 */
export async function deleteAccount(
  adminClient: SupabaseClient<Database>,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OperationResult> {
  const storage = supabase?.storage ?? adminClient?.storage;

  const { data: topLevel, error: listError } = await storage.from("scans").list(userId);
  if (listError) {
    return { ok: false, error: listError.message };
  }

  const pathsToRemove: string[] = [];

  if (topLevel && topLevel.length > 0) {
    for (const item of topLevel) {
      if (!item.name) continue;
      if (item.name.includes("/") || item.name.includes(".")) {
        pathsToRemove.push(`${userId}/${item.name}`);
      } else {
        const { data: subFiles, error: subError } = await storage
          .from("scans")
          .list(`${userId}/${item.name}`);
        if (subError) {
          return { ok: false, error: subError.message };
        }
        if (subFiles && subFiles.length > 0) {
          for (const sub of subFiles) {
            pathsToRemove.push(`${userId}/${item.name}/${sub.name}`);
          }
        }
      }
    }
  }

  if (pathsToRemove.length > 0) {
    const { error: removeError } = await storage.from("scans").remove(pathsToRemove);
    if (removeError) {
      return { ok: false, error: removeError.message };
    }
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return { ok: false, error: deleteUserError.message };
  }

  return { ok: true };
}

/**
 * Retrieves scan summaries for a user, ordered by creation date descending, with 1-hour signed thumbnail URLs.
 */
export async function getUserScans(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserScanSummary[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user scans: ${error.message}`);
  }

  const summaries: UserScanSummary[] = [];

  for (const scan of data ?? []) {
    const { data: signedData } = await supabase.storage
      .from("scans")
      .createSignedUrl(scan.image_path, 3600);

    const parsed = analyzeResultSchema.shape.detections.safeParse(scan.detections);
    const detections = parsed.success ? parsed.data : [];

    let attentionCount = 0;
    for (const d of detections) {
      if (classCatalog[d.class_id]?.group === "attention") {
        attentionCount++;
      }
    }

    const detectionsCount = detections.length;

    summaries.push({
      id: scan.id,
      createdAt: scan.created_at,
      imageUrl: signedData?.signedUrl ?? "",
      attentionCount,
      detectionsCount,
      modelVersion: scan.model_version,
    });
  }

  return summaries;
}

/**
 * Retrieves chat summaries for a user, ordered by updated_at descending.
 */
export async function getUserChats(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserChatSummary[]> {
  const { data, error } = await supabase
    .from("chats")
    .select("id, title, created_at, updated_at, scan_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user chats: ${error.message}`);
  }

  return (data ?? []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
    scanId: chat.scan_id,
  }));
}

/**
 * Loads full scan detail by id and userId, including Zod-validated detections, signed image URL,
 * base64 heatmaps from Storage, and related chat messages.
 */
export async function getScanDetail(
  supabase: SupabaseClient<Database>,
  userId: string,
  scanId: string,
): Promise<ScanDetail | null> {
  const { data: scan, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch scan detail: ${error.message}`);
  }
  if (!scan) {
    return null;
  }

  // Validates detections with Zod at runtime
  const validatedDetections = analyzeResultSchema.shape.detections.parse(scan.detections);

  const { data: signedData } = await supabase.storage
    .from("scans")
    .createSignedUrl(scan.image_path, 3600);
  const imageUrl = signedData?.signedUrl ?? "";

  const heatmaps: Record<string, string> = {};
  const classIds = Array.isArray(scan.heatmap_class_ids) ? scan.heatmap_class_ids : [];

  for (const classId of classIds) {
    const path = `${userId}/${scanId}/heatmap-${classId}.png`;
    const { data: blob, error: downloadError } = await supabase.storage
      .from("scans")
      .download(path);

    if (downloadError || !blob) {
      continue;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    heatmaps[String(classId)] = base64;
  }

  const { data: chatData } = await supabase
    .from("chats")
    .select("*")
    .eq("scan_id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  let chat: ScanDetail["chat"] = null;
  if (chatData) {
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatData.id)
      .order("id", { ascending: true });

    chat = {
      id: chatData.id,
      title: chatData.title,
      createdAt: chatData.created_at,
      updatedAt: chatData.updated_at,
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    };
  }

  let parsedInsight: ScanDetail["insight"] = null;
  if (scan.insight && typeof scan.insight === "object") {
    parsedInsight = {
      locale: scan.insight_locale ?? "id",
      version: scan.insight_prompt_version ?? "1.0",
      data: scan.insight,
    };
  }

  return {
    id: scan.id,
    userId: scan.user_id,
    createdAt: scan.created_at,
    source: scan.source,
    imageUrl,
    imageWidth: scan.image_width,
    imageHeight: scan.image_height,
    image: {
      url: imageUrl,
      width: scan.image_width,
      height: scan.image_height,
    },
    modelVersion: scan.model_version,
    detections: validatedDetections,
    heatmaps,
    insight: parsedInsight,
    chat,
  };
}
