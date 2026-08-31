import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  RefreshCw,
  Plus,
  CheckCircle2,
  Users,
  MapPin,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  CharacterBible,
  LocationBible,
  ObjectBible,
  CharacterContinuityState,
  ContinuitySnapshot,
  Scene,
  ApprovedCostumeTransition,
} from '../types';

interface ContinuityPanelProps {
  projectId: string;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  scenes: Scene[];
  continuityStates: CharacterContinuityState[];
  onApproveTransition?: (characterName: string, transition: ApprovedCostumeTransition) => Promise<void>;
}

export const ContinuityPanel: React.FC<ContinuityPanelProps> = ({
  projectId,
  characters,
  locations,
  objects,
  scenes,
  continuityStates = [],
  onApproveTransition,
}) => {
  const [selectedCharName, setSelectedCharName] = useState<string>(characters[0]?.name || '');
  const [showTransitionModal, setShowTransitionModal] = useState<boolean>(false);
  const [toCostumeVersion, setToCostumeVersion] = useState<string>('');
  const [fromCostumeVersion, setFromCostumeVersion] = useState<string>('v1_canonical');
  const [atSceneNumber, setAtSceneNumber] = useState<number>(1);
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // O(1) character continuity state lookup map to avoid O(K) linear array scans per character render
  const continuityStatesMap = useMemo(() => {
    const map = new Map<string, CharacterContinuityState>();
    for (const cs of continuityStates) {
      if (cs.name) {
        map.set(cs.name.toLowerCase(), cs);
      }
    }
    return map;
  }, [continuityStates]);

  const activeChar = useMemo(
    () => characters.find((c) => c.name.toLowerCase() === selectedCharName.toLowerCase()) || characters[0],
    [characters, selectedCharName]
  );
  const activeCharState = activeChar ? continuityStatesMap.get(activeChar.name.toLowerCase()) : undefined;

  // Single-pass memoized aggregation of scene statistics and continuity violations to eliminate flatMap/filter on every re-render
  const { allViolations, failedScenesCount, passedScenesCount } = useMemo(() => {
    let failed = 0;
    let passed = 0;
    const violations = [];
    for (const s of scenes) {
      if (s.continuity_status === 'continuity_failed') failed++;
      if (s.continuity_status === 'passed') passed++;
      if (s.continuity_violations) {
        for (const v of s.continuity_violations) {
          violations.push({ ...v, scene_number: s.scene_number });
        }
      }
    }
    return { allViolations: violations, failedScenesCount: failed, passedScenesCount: passed };
  }, [scenes]);

  const handleOpenTransitionModal = (charName: string) => {
    setSelectedCharName(charName);
    const charSt = continuityStatesMap.get(charName.toLowerCase());
    setFromCostumeVersion(charSt?.current_state.costume_version || 'v1_canonical');
    setToCostumeVersion(`${charSt?.current_state.costume_version || 'v1'}_variasi_adegan`);
    setAtSceneNumber(2);
    setTransitionReason('');
    setShowTransitionModal(true);
  };

  const handleSaveTransition = async () => {
    if (!selectedCharName || !toCostumeVersion || !transitionReason || !onApproveTransition) return;
    setIsSubmitting(true);
    try {
      const transition: ApprovedCostumeTransition = {
        from_costume_version: fromCostumeVersion,
        to_costume_version: toCostumeVersion,
        scene_number: atSceneNumber,
        reason: transitionReason,
        approved_at: new Date().toISOString(),
      };
      await onApproveTransition(selectedCharName, transition);
      setShowTransitionModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Continuity Status */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 backdrop-blur">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Mesin Kontinuitas Produksi (Continuity Engine)
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-400 font-mono">Hierarki: Data Kanonikal &gt; State Inherit &gt; Override Disetujui</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-100">Kunci Konsistensi Tokoh, Busana, Latar, &amp; Properti</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Memastikan tidak ada perubahan busana liar tanpa alasan naratif (anachronism lock, head-cover lock, prop lock), serta mewariskan status adegan sebelumnya secara berurutan.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center min-w-[100px]">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">Status Lolos</div>
              <div className="text-lg font-bold text-emerald-400">{passedScenesCount} / {scenes.length}</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center min-w-[100px]">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">Pelanggaran</div>
              <div className={`text-lg font-bold ${failedScenesCount > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                {allViolations.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Violations Alert if any */}
      {allViolations.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Peringatan Inkonsistensi Kontinuitas Terdeteksi ({allViolations.length} Catatan)</span>
          </div>
          <div className="space-y-2">
            {allViolations.map((v, idx) => (
              <div key={`viol-${v.scene_number || 0}-${v.character_name || ''}-${idx}`} className="bg-zinc-950/70 border border-rose-900/40 rounded-xl p-3 text-xs flex items-start gap-3">
                <span className={`px-2 py-0.5 rounded font-mono font-bold uppercase text-[10px] shrink-0 ${
                  v.severity === 'critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  Adegan #{v.scene_number} • {v.severity}
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-zinc-200">{v.issue}</div>
                  <div className="text-zinc-400">Rekomendasi Koreksi: {v.recommendation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Character Continuity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Character Selector List */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" /> Tokoh &amp; Kunci Busana
            </h4>
            <span className="text-[10px] text-zinc-500">{characters.length} Tokoh</span>
          </div>

          <div className="space-y-2">
            {characters.map((c) => {
              const state = continuityStatesMap.get(c.name.toLowerCase());
              const isSelected = activeChar?.name.toLowerCase() === c.name.toLowerCase();
              return (
                <button
                  key={c.name}
                  onClick={() => setSelectedCharName(c.name)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/40 text-zinc-100'
                      : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-amber-400/90">{state?.current_state.costume_version || 'v1_canonical'}</span>
                      {state?.head_cover?.is_locked && <span className="text-emerald-400">🔒 Tutup Kepala</span>}
                    </div>
                  </div>
                  <Lock className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-zinc-600'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Character Continuity Detail */}
        <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
          {activeChar ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-zinc-100">{activeChar.name}</h4>
                    <span className="bg-amber-500/20 text-amber-300 font-mono text-xs px-2 py-0.5 rounded border border-amber-500/30">
                      Versi Aktif: {activeCharState?.current_state.costume_version || 'v1_canonical'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{activeChar.role_in_story}</div>
                </div>

                <button
                  onClick={() => handleOpenTransitionModal(activeChar.name)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Setujui Variasi / Transisi Kostum
                </button>
              </div>

              {/* Locked Costume Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" /> Penutup Kepala / Rambut (Locked)
                  </div>
                  <div className="text-xs text-zinc-200 font-medium">
                    {activeCharState?.head_cover?.value || activeChar.visual_features?.clothing_style || 'Mengikuti deskripsi kanonikal'}
                  </div>
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" /> Busana Luar &amp; Jubah (Locked)
                  </div>
                  <div className="text-xs text-zinc-200 font-medium">
                    {activeCharState?.outer_garment?.value || activeChar.visual_features?.clothing_style || 'Mengikuti deskripsi kanonikal'}
                  </div>
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" /> Palet Warna Busana
                  </div>
                  <div className="text-xs text-zinc-200 font-medium">
                    {activeCharState?.costume?.color_palette?.join(', ') || activeChar.visual_features?.color_palette?.join(', ') || 'Palet tekstil alami historis'}
                  </div>
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" /> Aksesori &amp; Properti Melekat
                  </div>
                  <div className="text-xs text-zinc-200 font-medium">
                    {activeCharState?.accessories?.map((a) => a.value).join(', ') || activeChar.visual_features?.accessories?.join(', ') || 'Tidak ada aksesori khusus'}
                  </div>
                </div>
              </div>

              {/* Approved Costume Transitions History */}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> Riwayat Transisi Kostum yang Disetujui
                </div>
                {activeCharState?.approved_transitions && activeCharState.approved_transitions.length > 0 ? (
                  <div className="space-y-2">
                    {activeCharState.approved_transitions.map((t, idx) => (
                      <div key={`trans-${activeChar.name}-${t.scene_number}-${t.to_costume_version}-${idx}`} className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 font-mono text-zinc-300">
                            Adegan #{t.scene_number}
                          </span>
                          <span className="font-mono text-zinc-400">{t.from_costume_version}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-mono text-amber-300 font-bold">{t.to_costume_version}</span>
                        </div>
                        <div className="text-zinc-400 italic">"{t.reason}"</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-500 italic">
                    Belum ada perubahan kostum. Tokoh ini konsisten memakai versi kanonikal (v1_canonical) di seluruh adegan.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-zinc-500 py-8 text-center">Pilih tokoh untuk melihat detail kontinuitas.</div>
          )}
        </div>
      </div>

      {/* Location & Object Locks Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Locations */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> Kontinuitas Latar &amp; Arsitektur ({locations.length})
            </h4>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {locations.map((loc, lIdx) => (
              <div key={loc.id || `loc-${loc.name}-${lIdx}`} className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-zinc-200">
                  <span>{loc.name}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">🔒 Kunci Tata Letak</span>
                </div>
                <div className="text-zinc-400 text-[11px]">{loc.architecture_features || loc.atmosphere}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Objects */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-400" /> Kontinuitas Objek Kunci ({objects.length})
            </h4>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {objects.map((obj, oIdx) => (
              <div key={obj.id || `obj-${obj.name}-${oIdx}`} className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-zinc-200">
                  <span>{obj.name}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">🔒 Kunci Visual</span>
                </div>
                <div className="text-zinc-400 text-[11px]">{obj.visual_details || obj.narrative_significance}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Approve Costume Transition */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-zinc-100 text-base">Setujui Transisi Kostum: {selectedCharName}</h4>
              <button
                onClick={() => setShowTransitionModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Dari Versi Kostum</label>
                <input
                  type="text"
                  value={fromCostumeVersion}
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Ke Versi Kostum Baru (Label/Nama ID)</label>
                <input
                  type="text"
                  value={toCostumeVersion}
                  onChange={(e) => setToCostumeVersion(e.target.value)}
                  placeholder="e.g. jubah_perang_v2, baju_penobatan_v2"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Mulai Berlaku Pada Adegan Nomor</label>
                <input
                  type="number"
                  min={1}
                  max={scenes.length || 99}
                  value={atSceneNumber}
                  onChange={(e) => setAtSceneNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Alasan Naratif Perubahan Kostum (Wajib)</label>
                <textarea
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Tokoh berganti pakaian setelah penobatan resmi menjadi raja; atau mengenakan baju zirah tempur menjelang perang."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTransition}
                disabled={isSubmitting || !toCostumeVersion || !transitionReason}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
              >
                {isSubmitting ? 'Menyimpan...' : 'Setujui & Kunci Transisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
