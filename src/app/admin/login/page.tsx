"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "@/components/ui/Icons";
import { Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/FormControls";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e?: any) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Prihlásenie zlyhalo.");
      } else {
        window.location.href = "/admin";
      }
    } catch (err) {
      setError("Vyskytla sa chyba sieťového pripojenia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--primary) 9%, var(--paper-2)), var(--paper-2))",
      }}
    >
      <div style={{ width: 420, maxWidth: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Ic name="scale" size={28} sw={2} style={{ color: "#fff" }} />
          </div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 23, fontWeight: 600, margin: 0 }}>
            Prihlásenie administrátora
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "6px 0 0", textAlign: "center" }}>
            Bytový dom Björnsonova 3
          </p>
        </div>
        
        <Card>
          <div>
            <FormRow label="E-mail">
              <Input
                type="email"
                value={email}
                autoFocus
                autoComplete="username"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="vas@email.sk"
                required
              />
            </FormRow>
            <FormRow label="Heslo">
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submit(e);
                  }
                }}
                placeholder="••••••••"
                required
              />
            </FormRow>
            
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: "12.5px",
                  color: "var(--disagree)",
                  marginBottom: 12,
                }}
              >
                <Ic name="alert" size={15} />
                {error}
              </div>
            )}
            
            <Btn onClick={submit} kind="primary" full size="lg" icon="lock" disabled={loading}>
              {loading ? "Prihlasovanie..." : "Prihlásiť sa"}
            </Btn>
          </div>
        </Card>

      </div>
    </div>
  );
}
