import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, MessageCircle } from "lucide-react";
import VerifyEmailStep from "@/components/VerifyEmailStep";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { WHATSAPP_HREF } from "@/components/SupportEscapeHatch";

// err.message here comes straight from Base44's own auth API (no
// isRouterError to branch on, unlike callFunction-based pages) -- usually a
// real, actionable message, but there's no way to be sure from here, so the
// WhatsApp link stays visible alongside it rather than replacing it.
function ErrorBanner({ message, context }) {
  if (!message) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm space-y-2">
      <p>{message}</p>
      <a
        href={`${WHATSAPP_HREF}?text=${encodeURIComponent(context)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
      >
        <MessageCircle className="w-3.5 h-3.5" /> ¿Sigue sin funcionar? Escríbenos
      </a>
    </div>
  );
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verifica tu correo"
        subtitle={`Enviamos un código a ${email}`}
      >
        <VerifyEmailStep
          email={email}
          password={password}
          onVerified={({ needsLogin }) => {
            window.location.href = needsLogin ? "/login" : safeReturnTo();
          }}
          onCancel={() => {
            setShowOtp(false);
            setPassword("");
            setConfirmPassword("");
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Crea tu cuenta"
      subtitle="Regístrate para comenzar"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Inicia sesión
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continuar con Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">o</span>
        </div>
      </div>

      <ErrorBanner message={error} context="Hola, no puedo crear mi cuenta en ArtisKids." />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
