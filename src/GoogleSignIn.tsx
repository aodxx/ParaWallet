import { useEffect, useRef, useState } from "react";

type Props = { clientId: string; onCredential: (token: string) => void; onError: (message: string) => void };

export default function GoogleSignIn({ clientId, onCredential, onError }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const setup = () => {
      if (cancelled) return;
      if (!clientId) { onError("ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID"); return; }
      if (!window.google?.accounts?.id || !buttonRef.current) { window.setTimeout(setup, 250); return; }
      window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => {
        if (response.credential) onCredential(response.credential);
        else onError("Google ไม่ส่งข้อมูลยืนยันตัวตนกลับมา");
      }, auto_select: false, cancel_on_tap_outside: true });
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 280 });
      setReady(true);
    };
    setup();
    return () => { cancelled = true; };
  }, [clientId, onCredential, onError]);

  return <div className="google-signin"><div ref={buttonRef} />{!ready && <span>กำลังเตรียม Google Sign-In...</span>}</div>;
}
