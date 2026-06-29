import { describe, it, expect } from "vitest";

import { loginSchema, changePasswordSchema, createUserSchema } from "./auth";

describe("loginSchema", () => {
  it("akzeptiert gültige Eingaben", () => {
    expect(loginSchema.safeParse({ email: "a@b.de", password: "x" }).success).toBe(true);
  });
  it("lehnt leere E-Mail ab", () => {
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
  });
  it("lehnt ungültige E-Mail ab", () => {
    expect(loginSchema.safeParse({ email: "keine-mail", password: "x" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("akzeptiert passende Passwörter ≥ 8 Zeichen", () => {
    const r = changePasswordSchema.safeParse({ password: "geheim12", confirm: "geheim12" });
    expect(r.success).toBe(true);
  });
  it("lehnt zu kurzes Passwort ab", () => {
    const r = changePasswordSchema.safeParse({ password: "kurz", confirm: "kurz" });
    expect(r.success).toBe(false);
  });
  it("lehnt nicht übereinstimmende Passwörter ab", () => {
    const r = changePasswordSchema.safeParse({ password: "geheim12", confirm: "anders12" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("confirm"))).toBe(true);
    }
  });
});

describe("createUserSchema", () => {
  const base = { email: "neu@b.de", fullName: "Max Muster", role: "werker", password: "start123" };
  it("akzeptiert gültige Nutzerdaten", () => {
    expect(createUserSchema.safeParse(base).success).toBe(true);
  });
  it("lehnt unbekannte Rolle ab", () => {
    expect(createUserSchema.safeParse({ ...base, role: "chef" }).success).toBe(false);
  });
  it("lehnt zu kurzen Namen ab", () => {
    expect(createUserSchema.safeParse({ ...base, fullName: "M" }).success).toBe(false);
  });
  it("lehnt zu kurzes Start-Passwort ab", () => {
    expect(createUserSchema.safeParse({ ...base, password: "kurz" }).success).toBe(false);
  });
});
