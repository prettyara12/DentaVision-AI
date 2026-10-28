import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatResetTime, QuotaNotice } from "./quota-notice";

describe("formatResetTime", () => {
  it("formats hours and minutes in Indonesian", () => {
    expect(formatResetTime("id", 3660)).toBe("1 jam 1 menit");
    expect(formatResetTime("id", 7200)).toBe("2 jam 0 menit");
  });

  it("formats only minutes when less than an hour in Indonesian", () => {
    expect(formatResetTime("id", 1500)).toBe("25 menit");
  });

  it("formats hours and minutes in English", () => {
    expect(formatResetTime("en", 3660)).toBe("1h 1m");
    expect(formatResetTime("en", 1500)).toBe("25m");
  });
});

describe("QuotaNotice", () => {
  it("renders quota exceeded message and reset countdown for users", () => {
    const html = renderToString(
      <QuotaNotice lang="id" role="user" kind="scan" resetInSeconds={3600} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Batas kuota harian tercapai");
    expect(html).toContain("1 jam 0 menit");
    // Logged in users do not get the guest login CTA
    expect(html).not.toContain("Masuk ke Akun");
  });

  it("renders guest hint and login CTA for guests", () => {
    const html = renderToString(
      <QuotaNotice lang="id" role="guest" kind="scan" resetInSeconds={1800} />,
    );
    expect(html).toContain("Masuk untuk mendapatkan kuota lebih banyak");
    expect(html).toContain("Masuk ke Akun");
    expect(html).toContain('href="/id/login"');
  });

  it("renders in English properly", () => {
    const html = renderToString(
      <QuotaNotice lang="en" role="guest" kind="chat" resetInSeconds={7200} />,
    );
    expect(html).toContain("Daily limit reached");
    expect(html).toContain("2h 0m");
    expect(html).toContain("Sign in");
    expect(html).toContain('href="/en/login"');
  });
});
