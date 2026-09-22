import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { WHATSAPP_HREF } from "@/components/SupportEscapeHatch";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword });
      window.location.href = "/login";
    } catch (err) {
      // err.message here comes from Base44's own auth API (no isRouterError
      // to branch on, unlike callFunction-based pages) -- usually a real,
      // actionable message, but there's no way to be sure from here, so the
      // WhatsApp link stays visible alongside it rather than replacing it.
      setError(err.message || "No se pudo restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Enlace inválido"
        subtitle="Este enlace para restablecer tu contraseña falta o no es válido"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Solicitar un nuevo enlace
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          El enlace que usaste parece estar incompleto. Solicita un nuevo correo para restablecer tu contraseña.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Nueva contraseña"
      subtitle="Ingresa tu nueva contraseña abajo"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm space-y-2">
          <p>{error}</p>
          <a
            href={`${WHATSAPP_HREF}?text=${encodeURIComponent("Hola, no puedo restablecer mi contraseña en ArtisKids.")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5" /> ¿Sigue sin funcionar? Escríbenos
          </a>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirma tu contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Restableciendo...
            </>
          ) : (
            "Restablecer contraseña"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
