import { Component, ErrorInfo, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("ParaWallet runtime error", error, info.componentStack);
  }

  reset = () => {
    try {
      sessionStorage.removeItem("parawallet-runtime-error");
      window.location.reload();
    } catch {
      window.location.href = window.location.href.split("#")[0];
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="runtime-error" role="alert">
        <div className="runtime-error-card">
          <div className="runtime-error-mark">!</div>
          <p className="eyebrow">PARAWALLET RECOVERY</p>
          <h1>ระบบยังเปิดหน้าใช้งานไม่ได้</h1>
          <p>เกิดข้อผิดพลาดระหว่างโหลดหน้าเว็บ แต่ข้อมูลใน Google Sheets ไม่ได้ถูกลบ กรุณากดปุ่มลองเปิดใหม่</p>
          <button className="primary" onClick={this.reset}>ลองเปิดใหม่</button>
          <button className="secondary" onClick={() => { caches?.keys?.().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).finally(this.reset); }}>ล้าง cache แล้วเปิดใหม่</button>
          <small>รายละเอียด: {this.state.message || "runtime error"}</small>
        </div>
      </main>
    );
  }
}
