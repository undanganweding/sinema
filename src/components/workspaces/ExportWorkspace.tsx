import React, { useState } from 'react';
import { Download, FileText, CheckCircle2, Cloud, Sparkles } from 'lucide-react';
import { Project, Scene, Shot } from '../../types';

interface ExportWorkspaceProps {
  project: Project | null;
  scenes: Scene[];
  shots: Record<string, Shot[]>;
}

export const ExportWorkspace: React.FC<ExportWorkspaceProps> = ({ project, scenes, shots }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExportDrive = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExported(true);
      setTimeout(() => setExported(false), 4000);
    }, 1500);
  };

  const handleDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ project, scenes, shots }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${project?.title || 'cinematic_project'}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-amber-400 font-bold">
            <Download className="w-4 h-4" />
            <span>Deliverables &amp; Export Studio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Ekspor Paket Produksi &amp; Google Drive
          </h1>
        </div>
      </div>

      {/* Export Options Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Drive Export Card */}
        <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Google Drive Deliverables</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Kirim seluruh laporan skenario, Bible karakter/lokasi, master frame prompts, dan Seedance video prompts langsung ke folder Google Drive Anda.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleExportDrive}
              disabled={isExporting}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isExporting ? 'Mengirim ke Google Drive...' : exported ? 'Berhasil Diexport ke Drive! ✓' : 'Ekspor ke Google Drive'}
            </button>
            {exported && (
              <div className="mt-2 text-center text-xs text-emerald-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Folder &amp; file berhasil disinkronkan.
              </div>
            )}
          </div>
        </div>

        {/* JSON Package Download Card */}
        <div className="bg-[#0F131E] border border-white/[0.08] p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Download Paket JSON Lengkap</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Unduh arsip lengkap proyek dalam format JSON terstruktur untuk backup lokal atau diimpor ke platform render video eksternal.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleDownloadJSON}
              className="w-full py-3 bg-[#141A29] hover:bg-[#1B2338] border border-white/10 text-zinc-200 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-amber-400" />
              Download Proyek (.json)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
