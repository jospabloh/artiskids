import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { WHATSAPP_HREF } from "@/components/SupportEscapeHatch";

// Paso de código de verificación (OTP), compartido por Register y Login.
// Verifica el código; si el SDK no devuelve token, inicia sesión con la
// contraseña. Si eso falla, manda a /login con el correo ya verificado.
export default function VerifyEmailStep({ email, password, onVerified, onCancel }) {
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        onVerified({ needsLogin: false });
        return;
      }
    } catch (err) {
      setError(err?.message || "Código inválido o vencido");
      setBusy(false);
      return;
    }
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      onVerified({ needsLogin: false });
    } catch {
      toast({ title: "Correo verificado", description: "Inicia sesión para continuar." });
      onVerified({ needsLogin: true });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Código enviado", description: "Revisa tu correo para el nuevo código." });
    } catch (err) {
      setError(err?.message || "No se pudo reenviar el código");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm space-y-2">
          <p>{error}</p>
          <a
            href={`${WHATSAPP_HREF}?text=${encodeURIComponent("Hola, no puedo verificar mi correo en ArtisKids.")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5" /> ¿Sigue sin funcionar? Escríbenos
          </a>
        </div>
      )}
      <div className="flex justify-center mb-6">
        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={busy || otpCode.length < 6}>
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          "Verificar"
        )}
      </Button>
      <div className="flex justify-between text-sm text-muted-foreground mt-4">
        <button type="button" onClick={handleResend} disabled={resending} className="text-primary font-medium hover:underline">
          {resending ? "Enviando..." : "Reenviar código"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="hover:text-foreground">
            Usar otro correo
          </button>
        )}
      </div>
    </>
  );
}
