import type { AnalyzeResult } from "@/features/scan/result";

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
  detectionsCount: number | null;
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
