import React from 'react';
import { MapPin, ShieldCheck, Sun } from 'lucide-react';
import { LocationBible, ObjectBible } from '../../types';

interface LocationBibleWorkspaceProps {
  locations: LocationBible[];
  objects: ObjectBible[];
}

export const LocationBibleWorkspace: React.FC<LocationBibleWorkspaceProps> = ({ locations, objects }) => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Locations Section */}
      <div className="space-y-4">
        <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-cyan-400 font-bold">
              <MapPin className="w-4 h-4" />
              <span>Stage 3 • Location Intelligence Vault</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
              Location Bible &amp; Architecture
            </h1>
          </div>
          <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-700">
            {locations.length} Lokasi Terkunci
          </span>
        </div>

        {locations.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 bg-[#0F131E] rounded-2xl border border-white/5">
            Belum ada lokasi tercatat.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((loc, idx) => (
              <div
                key={loc.id || loc.name || idx}
                className="bg-[#0F131E] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-cyan-500/15 text-cyan-300 px-2.5 py-0.5 rounded border border-cyan-500/30 font-bold">
                      {loc.architectural_style || 'Arsitektur Kuno'}
                    </span>
                    <h3 className="text-lg font-bold text-zinc-100 mt-2">{loc.name}</h3>
                  </div>
                  <MapPin className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Deskripsi &amp; Suasana</span>
                    <p className="text-zinc-300 leading-relaxed">{loc.description || loc.lighting_atmosphere || 'Suasana autentik sejarah.'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121624] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold">Pencahayaan &amp; Atmosfer</span>
                    <p className="text-zinc-300 leading-relaxed">{loc.lighting_atmosphere || 'Cahaya alami senja'}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Konsistensi Latar
                  </span>
                  <span>ID: #{loc.id || idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Objects Section */}
      <div className="space-y-4 pt-6 border-t border-white/10">
        <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-emerald-400 font-bold">
              <Sun className="w-4 h-4" />
              <span>Stage 3 • Prop &amp; Object Inventory</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
              Object Bible &amp; Pusaka
            </h1>
          </div>
          <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-700">
            {objects.length} Objek Terkunci
          </span>
        </div>

        {objects.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 bg-[#0F131E] rounded-2xl border border-white/5">
            Belum ada objek tercatat.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {objects.map((obj, idx) => (
              <div
                key={obj.id || obj.name || idx}
                className="bg-[#0F131E] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                      {obj.material || 'Material Khas'}
                    </span>
                    <h3 className="text-lg font-bold text-zinc-100 mt-2">{obj.name}</h3>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded">
                    Pemilik: {obj.owner || 'Umum'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#121624] border border-white/5 text-xs text-zinc-300 leading-relaxed">
                  {obj.description || 'Pusaka atau artefak penting dalam narasi.'}
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span className="text-emerald-400">Terverifikasi</span>
                  <span>ID: #{obj.id || idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
