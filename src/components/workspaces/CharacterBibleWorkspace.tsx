import React from 'react';
import { Users, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { CharacterBible } from '../../types';

interface CharacterBibleWorkspaceProps {
  characters: CharacterBible[];
}

export const CharacterBibleWorkspace: React.FC<CharacterBibleWorkspaceProps> = ({ characters }) => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-amber-400 font-bold">
            <Users className="w-4 h-4" />
            <span>Stage 2 • Character Detection &amp; Wardrobe Lock</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Character Bible &amp; Identity Vault
          </h1>
        </div>
        <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-700">
          {characters.length} Tokoh Terkunci
        </span>
      </div>

      {characters.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 bg-[#0F131E] rounded-2xl border border-white/5 space-y-3">
          <Users className="w-12 h-12 mx-auto text-zinc-600" />
          <p className="text-xs">Belum ada karakter yang terdeteksi dalam pipeline.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char, idx) => (
            <div
              key={char.id || char.name || idx}
              className="bg-[#0F131E] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded border border-amber-500/30 font-bold">
                      {char.role || 'Tokoh Utama'}
                    </span>
                    <h3 className="text-lg font-bold text-zinc-100 mt-2">{char.name}</h3>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#121624] border border-white/5 space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Usia</span>
                    <p className="font-semibold text-zinc-200">{char.age || 'Dewasa'}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#121624] border border-white/5 space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Versi Identitas</span>
                    <p className="font-semibold text-amber-400 font-mono">v{char.identity_version || 1} 🔒</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Deskripsi Fisik &amp; Wajah</span>
                    <p className="text-zinc-300 leading-relaxed">{char.physical_description || 'Penampilan khas era sejarah.'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Kostum &amp; Wardrobe Lock</span>
                    <p className="text-zinc-300 leading-relaxed">{char.costume || char.wardrobe || 'Busana autentik.'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#0A0D15] border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Konsistensi Terjaga
                </span>
                <span>ID: #{char.id || idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
