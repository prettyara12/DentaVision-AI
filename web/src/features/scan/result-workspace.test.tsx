import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StoredScan } from "./result";
import { ResultWorkspace } from "./result-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/insight/use-insight", () => ({
  useInsight: () => ({
    state: {
      status: "done",
      insight: { summary: "Test summary", findings: [], questions_for_dentist: [] },
    },
    generate: vi.fn(),
  }),
}));

vi.mock("@/features/chat/use-chat", () => ({
  useChat: () => ({ messages: [], draft: "", status: "idle", send: vi.fn(), retry: vi.fn() }),
}));

const mockScan: StoredScan = {
  image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  result: {
    model_version: "v1",
    image: { width: 100, height: 100 },
    low_quality: false,
    detections: [],
    heatmaps: {},
    timing_ms: {},
  },
};

describe("ResultWorkspace Guest Import UI", () => {
  it("renders 'Simpan ke riwayat' button when user is a guest viewing unsaved scan", () => {
    const html = renderToString(
      <ResultWorkspace lang="id" initialScan={mockScan} isSaved={false} userLoggedIn={false} />,
    );
    expect(html).toContain("Simpan ke riwayat");
  });

  it("does NOT render 'Simpan ke riwayat' button when viewing sample scan", () => {
    const sampleScan: StoredScan = { ...mockScan, sample: "impacted" };
    const html = renderToString(
      <ResultWorkspace lang="id" initialScan={sampleScan} isSaved={false} userLoggedIn={false} />,
    );
    expect(html).not.toContain("Simpan ke riwayat");
  });

  it("does NOT render 'Simpan ke riwayat' button when user is logged in", () => {
    const html = renderToString(
      <ResultWorkspace lang="id" initialScan={mockScan} isSaved={false} userLoggedIn={true} />,
    );
    expect(html).not.toContain("Simpan ke riwayat");
  });

  it("does NOT render 'Simpan ke riwayat' button on an already saved scan (isSaved=true / history)", () => {
    const html = renderToString(
      <ResultWorkspace lang="id" initialScan={mockScan} isSaved={true} userLoggedIn={false} />,
    );
    expect(html).not.toContain("Simpan ke riwayat");
  });
});
