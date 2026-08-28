import React, { useState, useEffect } from 'react';
import {
  FolderUp,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Lock,
  FileJson,
} from 'lucide-react';
import {
  initDriveAuth,
  googleSignInForDrive,
  exportProjectToDrive,
  getDriveAccessToken,
  googleDriveSignOut,
  DriveExportResult,
} from '../lib/drive';
import { User } from 'firebase/auth';

interface GoogleDriveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: any;
}

export const GoogleDriveExportModal: React.FC<GoogleDriveExportModalProps> = ({
  isOpen,
  onClose,
  projectData,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<DriveExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = initDriveAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await googleSignInForDrive();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal login Google Drive.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleExport = async () => {
    const activeToken = token || getDriveAccessToken();
    if (!activeToken) {
      setError('Silakan Sign in with Google terlebih dahulu.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportResult(null);

    try {
      const result = await exportProjectToDrive(projectData, activeToken);
      setExportResult(result);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengekspor file ke Google Drive.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSignOut = async () => {
    await googleDriveSignOut();
    setUser(null);
    setToken(null);
    setExportResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Ekspor ke Google Drive</h3>
              <p className="text-xs text-zinc-400">Simpan Cetak Biru Sinematik ke Google Drive Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* File Info Card */}
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
            <FileJson className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-200 truncate">
                {projectData?.project?.title || projectData?.title || 'Cetak Biru Proyek'}
              </p>
              <p className="text-[11px] text-zinc-400 font-mono">
                Format: Cetak Biru JSON • Data Lengkap Tahap 1-8
              </p>
            </div>
          </div>

          {/* User Auth Status */}
          {user ? (
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-zinc-700" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{user.displayName || 'Pengguna Google'}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="text-[11px] text-zinc-400 hover:text-rose-400 underline cursor-pointer shrink-0 ml-2"
              >
                Keluar Akun
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 text-center space-y-3">
              <p className="text-xs text-zinc-300">
                Autentikasi akun diperlukan untuk mengunggah berkas cetak biru ke Google Drive Anda.
              </p>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs shadow transition cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-700" />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>Masuk dengan Google</span>
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Success Banner */}
          {exportResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Berhasil Diekspor ke Google Drive!</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Nama Berkas: <span className="font-mono text-zinc-100">{exportResult.name}</span>
              </p>
              {exportResult.webViewLink && (
                <a
                  href={exportResult.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Berkas di Google Drive
                </a>
              )}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-400" />
            Berkas hanya disimpan di akun Google Drive milik Anda.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-1.5 px-3.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || (!user && !token)}
              className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Simpan ke Drive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
