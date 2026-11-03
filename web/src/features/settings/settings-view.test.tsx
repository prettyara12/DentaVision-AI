import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountModal, executeDeleteAccount } from "./delete-account-modal";
import { formatJoinedDate, SettingsView } from "./settings-view";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const currentUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  notFound,
  redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  currentUser,
  createClient,
}));

describe("formatJoinedDate", () => {
  it("formats ISO string with locale", () => {
    const formattedId = formatJoinedDate("2026-10-28T10:00:00Z", "id");
    expect(formattedId).toContain("2026");
    expect(formattedId.toLowerCase()).toContain("oktober");

    const formattedEn = formatJoinedDate("2026-10-28T10:00:00Z", "en");
    expect(formattedEn).toContain("2026");
    expect(formattedEn).toContain("October");
  });

  it("handles empty or invalid date gracefully", () => {
    expect(formatJoinedDate("", "id")).toBe("");
    expect(formatJoinedDate("not-a-date", "id")).toBe("not-a-date");
  });
});

describe("SettingsView", () => {
  it("renders user email and joined date in Indonesian", () => {
    const html = renderToString(
      <SettingsView lang="id" email="patient@example.com" createdAt="2026-10-28T10:00:00Z" />,
    );

    expect(html).toContain("Pengaturan");
    expect(html).toContain("Akun");
    expect(html).toContain("Email");
    expect(html).toContain("patient@example.com");
    expect(html).toContain("Bergabung pada");
    expect(html).toContain("2026");

    // Danger zone
    expect(html).toContain("Zona Berbahaya");
    expect(html).toContain("Seluruh riwayat scan");
    expect(html).toContain("Hapus Akun Permanen");
  });

  it("renders user details in English", () => {
    const html = renderToString(
      <SettingsView lang="en" email="patient@example.com" createdAt="2026-10-28T10:00:00Z" />,
    );

    expect(html).toContain("Settings");
    expect(html).toContain("Account");
    expect(html).toContain("Email");
    expect(html).toContain("Joined on");
    expect(html).toContain("Danger Zone");
    expect(html).toContain("Permanently Delete Account");
  });

  it("handles empty email and missing createdAt gracefully", () => {
    const html = renderToString(<SettingsView lang="id" email="" createdAt={null} />);

    expect(html).toContain("-");
    expect(html).not.toContain("Bergabung pada");
  });
});

describe("DeleteAccountModal", () => {
  it("returns null when open is false", () => {
    const html = renderToString(<DeleteAccountModal open={false} lang="id" onClose={vi.fn()} />);
    expect(html).toBe("");
  });

  it("renders accessible modal when open is true", () => {
    const html = renderToString(<DeleteAccountModal open={true} lang="id" onClose={vi.fn()} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('id="delete-account-dialog-title"');
    expect(html).toContain("Konfirmasi Hapus Akun");
    expect(html).toContain('id="delete-account-dialog-description"');
    expect(html).toContain("Seluruh riwayat scan");
    expect(html).toContain('placeholder="HAPUS"');
    expect(html).toContain("Ketik HAPUS untuk melanjutkan:");
    expect(html).toContain("Batal");
    expect(html).toContain("Hapus Akun Permanen");
    // Delete button should have disabled attribute initially because input is empty
    expect(html).toContain("disabled");
  });

  it("renders English text and confirmation word DELETE", () => {
    const html = renderToString(<DeleteAccountModal open={true} lang="en" onClose={vi.fn()} />);

    expect(html).toContain("Confirm Account Deletion");
    expect(html).toContain('placeholder="DELETE"');
    expect(html).toContain("Type DELETE to continue:");
    expect(html).toContain("Cancel");
    expect(html).toContain("Permanently Delete Account");
  });
});

describe("executeDeleteAccount", () => {
  it("rejects deletion when confirmation word does not match", async () => {
    const fetchFn = vi.fn();
    const router = { push: vi.fn(), refresh: vi.fn() };
    const onDeleted = vi.fn();

    const result = await executeDeleteAccount({
      lang: "id",
      confirmationInput: "SALAH",
      fetchFn: fetchFn as unknown as typeof fetch,
      router,
      onDeleted,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("word_mismatch");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("calls DELETE /api/account and redirects when confirmation word matches exactly", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
    });
    const router = { push: vi.fn(), refresh: vi.fn() };
    const onDeleted = vi.fn();

    const result = await executeDeleteAccount({
      lang: "id",
      confirmationInput: "HAPUS",
      fetchFn: fetchFn as unknown as typeof fetch,
      router,
      onDeleted,
    });

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith("/api/account", { method: "DELETE" });
    expect(onDeleted).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/id");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("works with English confirmation word DELETE", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
    });
    const router = { push: vi.fn(), refresh: vi.fn() };

    const result = await executeDeleteAccount({
      lang: "en",
      confirmationInput: "DELETE",
      fetchFn: fetchFn as unknown as typeof fetch,
      router,
    });

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith("/api/account", { method: "DELETE" });
    expect(router.push).toHaveBeenCalledWith("/en");
  });

  it("handles server error response gracefully", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
    });
    const router = { push: vi.fn(), refresh: vi.fn() };
    const onDeleted = vi.fn();

    const result = await executeDeleteAccount({
      lang: "id",
      confirmationInput: "HAPUS",
      fetchFn: fetchFn as unknown as typeof fetch,
      router,
      onDeleted,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Gagal menghapus akun. Silakan coba lagi.");
    expect(router.push).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("handles fetch exception gracefully", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network failed"));
    const router = { push: vi.fn(), refresh: vi.fn() };

    const result = await executeDeleteAccount({
      lang: "id",
      confirmationInput: "HAPUS",
      fetchFn: fetchFn as unknown as typeof fetch,
      router,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Gagal menghapus akun. Silakan coba lagi.");
  });
});

describe("/settings page Server Component", () => {
  beforeEach(() => {
    notFound.mockClear();
    redirect.mockClear();
    currentUser.mockReset();
    createClient.mockReset();
  });

  it("generateMetadata returns localized title for valid locale", async () => {
    const { generateMetadata } = await import("@/app/[lang]/settings/page");
    const metaId = await generateMetadata({
      params: Promise.resolve({ lang: "id" }),
    });
    expect(metaId.title).toBe("Pengaturan · DentaVision AI");

    const metaEn = await generateMetadata({
      params: Promise.resolve({ lang: "en" }),
    });
    expect(metaEn.title).toBe("Settings · DentaVision AI");
  });

  it("generateMetadata returns empty object for invalid locale", async () => {
    const { generateMetadata } = await import("@/app/[lang]/settings/page");
    const meta = await generateMetadata({
      params: Promise.resolve({ lang: "de" }),
    });
    expect(meta).toEqual({});
  });

  it("redirects to login when unauthenticated", async () => {
    currentUser.mockResolvedValue(null);
    const { SettingsContent } = await import("@/app/[lang]/settings/page");

    await expect(SettingsContent({ lang: "id" })).rejects.toThrow(
      "NEXT_REDIRECT:/id/login?next=/id/settings",
    );
    expect(redirect).toHaveBeenCalledWith("/id/login?next=/id/settings");
  });

  it("queries user details and renders SettingsView when authenticated", async () => {
    currentUser.mockResolvedValue({ id: "user-123", email: "user@example.com" });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              email: "user@example.com",
              created_at: "2026-10-28T12:00:00Z",
            },
          },
        }),
      },
    });

    const { SettingsContent } = await import("@/app/[lang]/settings/page");
    const node = await SettingsContent({ lang: "id" });
    const html = renderToString(node);

    expect(html).toContain("user@example.com");
    expect(html).toContain("Pengaturan");
    expect(html).toContain("Zona Berbahaya");
  });
});
