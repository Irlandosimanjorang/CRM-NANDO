// Penangkap crash tampilan (1 Okt 2026). Sebelumnya satu kesalahan di satu
// tab bikin SELURUH app jadi layar putih tanpa pesan. Sekarang yang rusak
// cuma area itu: user lihat pesan + tombol muat ulang, menu lain tetap
// jalan, dan errornya masuk client_error_log ("Gagal tampil: ...") supaya
// health check ngabarin lewat Telegram.
import { Component } from "react";
import { report } from "../lib/clientErrorLog";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const where = this.props.name ? ` [${this.props.name}]` : "";
    const firstFrame = String(info?.componentStack || "").trim().split("\n")[0] || "";
    report(`Gagal tampil${where}: ${error?.message || error} ${firstFrame}`);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.fullScreen ? "min-h-screen bg-slate-50 flex items-center justify-center px-4" : "py-10 px-4 flex justify-center"}>
        <div className="w-full max-w-md rounded-panel border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Halaman ini gagal dimuat</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Terjadi kesalahan saat menampilkan halaman. Data Anda tetap aman dan kesalahan ini sudah otomatis dilaporkan ke tim Nexto.
          </p>
          <button onClick={() => window.location.reload()} className="mt-5 w-full rounded-inner bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}
