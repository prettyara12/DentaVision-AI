import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeleteModal } from "./delete-modal";
import { formatDate, HistoryView, onTabKey } from "./history-view";
import type { UserChatSummary, UserScanSummary } from "./types";

const mockScans: UserScanSummary[] = [
  {
    id: "scan-1",
    createdAt: "2026-10-28T10:00:00Z",
    imageUrl: "https://example.com/scan1.jpg",
    attentionCount: 2,
    detectionsCount: 5,
    modelVersion: "best_resnet50.pt",
  },
  {
    id: "scan-2",
    createdAt: "2026-10-27T08:30:00Z",
    imageUrl: "",
    attentionCount: 0,
    detectionsCount: 1,
    modelVersion: "best_resnet50.pt",
  },
];

const mockChats: UserChatSummary[] = [
  {
    id: "chat-1",
    title: "Konsultasi Gigi Berlubang",
    createdAt: "2026-10-28T11:00:00Z",
    updatedAt: "2026-10-28T11:15:00Z",
    scanId: "scan-1",
  },
  {
    id: "chat-2",
    title: "Tanya Sikat Gigi",
    createdAt: "2026-10-27T09:00:00Z",
    updatedAt: "2026-10-27T09:05:00Z",
    scanId: null,
  },
];

describe("HistoryView", () => {
  it("renders scan list tab by default with scan items", () => {
    const html = renderToString(
      <HistoryView lang="id" initialScans={mockScans} initialChats={mockChats} />,
    );

    expect(html).toContain('id="tab-scans"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="tab-chats"');
    expect(html).toContain('aria-selected="false"');

    // Scans panel visible
    expect(html).toContain('id="panel-scans"');
    expect(html).not.toMatch(/id="panel-scans"[^>]*hidden/);

    // Chats panel hidden
    expect(html).toMatch(/id="panel-chats"[^>]*hidden/);

    // Scan items rendered
    expect(html).toContain("https://example.com/scan1.jpg");
    expect(html).toContain("2 temuan perlu perhatian");
    expect(html).toContain('href="/id/scans/scan-1"');
    expect(html).toContain("Buka hasil");
    expect(html).toContain("Hapus");
  });

  it("renders chats tab when defaultTab is chats", () => {
    const html = renderToString(
      <HistoryView
        lang="id"
        initialScans={mockScans}
        initialChats={mockChats}
        defaultTab="chats"
      />,
    );

    // Scans panel hidden, chats panel visible
    expect(html).toMatch(/id="panel-scans"[^>]*hidden/);
    expect(html).not.toMatch(/id="panel-chats"[^>]*hidden/);

    // Chat items rendered
    expect(html).toContain("Konsultasi Gigi Berlubang");
    expect(html).toContain("Per Scan");
    expect(html).toContain('href="/id/chats/chat-1"');
    expect(html).toContain("Buka percakapan");

    expect(html).toContain("Tanya Sikat Gigi");
    expect(html).toContain("Umum");
    expect(html).toContain('href="/id/chats/chat-2"');
  });

  it("renders empty state for scans when initialScans is empty", () => {
    const html = renderToString(
      <HistoryView lang="id" initialScans={[]} initialChats={mockChats} />,
    );

    expect(html).toContain("Belum ada riwayat scan gigi.");
    expect(html).toContain('href="/id/scan"');
    expect(html).toContain("Upload X-ray baru");
  });

  it("renders empty state for chats when initialChats is empty", () => {
    const html = renderToString(
      <HistoryView lang="id" initialScans={mockScans} initialChats={[]} defaultTab="chats" />,
    );

    expect(html).toContain("Belum ada riwayat percakapan.");
    expect(html).toContain('href="/id/chat"');
    expect(html).toContain("Mulai chat baru");
  });

  it("renders English translations correctly", () => {
    const html = renderToString(
      <HistoryView lang="en" initialScans={mockScans} initialChats={mockChats} />,
    );

    expect(html).toContain("Dental Scans");
    expect(html).toContain("Conversations");
    expect(html).toContain("View result");
    expect(html).toContain("findings need attention");
  });
});

describe("onTabKey navigation", () => {
  it("switches from scans to chats on ArrowRight", () => {
    const select = vi.fn();
    onTabKey({ key: "ArrowRight" }, "scans", select);
    expect(select).toHaveBeenCalledWith("chats");
  });

  it("switches from scans to chats on ArrowLeft (wrapping)", () => {
    const select = vi.fn();
    onTabKey({ key: "ArrowLeft" }, "scans", select);
    expect(select).toHaveBeenCalledWith("chats");
  });

  it("switches from chats to scans on ArrowRight (wrapping)", () => {
    const select = vi.fn();
    onTabKey({ key: "ArrowRight" }, "chats", select);
    expect(select).toHaveBeenCalledWith("scans");
  });

  it("ignores non-arrow keys", () => {
    const select = vi.fn();
    onTabKey({ key: "Enter" }, "scans", select);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("formatDate", () => {
  it("formats ISO string with locale", () => {
    const formattedId = formatDate("2026-10-28T10:00:00Z", "id");
    expect(formattedId).toContain("2026");

    const formattedEn = formatDate("2026-10-28T10:00:00Z", "en");
    expect(formattedEn).toContain("2026");
  });

  it("handles invalid date gracefully", () => {
    expect(formatDate("not-a-date", "id")).toBe("not-a-date");
  });
});

describe("DeleteModal", () => {
  it("returns null when open is false", () => {
    const html = renderToString(
      <DeleteModal
        open={false}
        title="Hapus scan ini?"
        message="Gambar akan dihapus permanen."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders accessible dialog when open is true", () => {
    const html = renderToString(
      <DeleteModal
        open={true}
        title="Hapus scan ini?"
        message="Gambar dan riwayat percakapan akan dihapus permanen."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('id="delete-dialog-title"');
    expect(html).toContain("Hapus scan ini?");
    expect(html).toContain('id="delete-dialog-description"');
    expect(html).toContain("Gambar dan riwayat percakapan akan dihapus permanen.");
    expect(html).toContain("Batal");
    expect(html).toContain("Hapus");
  });

  it("shows loading state when loading is true", () => {
    const html = renderToString(
      <DeleteModal
        open={true}
        title="Hapus scan"
        message="Konfirmasi"
        loading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(html).toContain("Menghapus...");
    expect(html).toContain("disabled");
  });
});
