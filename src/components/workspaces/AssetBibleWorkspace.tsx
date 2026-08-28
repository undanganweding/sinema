import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Package,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';
import { CharacterBible, LocationBible, ObjectBible } from '../../types';

interface AssetBibleWorkspaceProps {
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
}

export const AssetBibleWorkspace: React.FC<AssetBibleWorkspaceProps> = ({
  characters,
  locations,
  objects,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'characters' | 'locations' | 'objects'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    characters.forEach((c, idx) => {
      nextState[`char-${c.id || idx}`] = expand;
    });
    locations.forEach((l, idx) => {
      nextState[`loc-${l.id || idx}`] = expand;
    });
    objects.forEach((o, idx) => {
      nextState[`obj-${o.id || idx}`] = expand;
    });
    setExpandedIds(nextState);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper Prompt Accessors
  const getCharacterPrompt = (char: CharacterBible) => {
    if (char.master_portrait_prompt && char.master_portrait_prompt.trim().length > 0) return char.master_portrait_prompt;
    const desc = char.physical_description || char.physical_appearance || 'authentic historical facial features';
    const costume = char.costume || char.wardrobe || (char.clothing?.length ? char.clothing.join(', ') : 'traditional clothing');
    return `Photorealistic cinematic master portrait of ${char.name}, ${char.age || 'adult'}, ${desc}, wearing ${costume}, 8k resolution, cinematic golden hour lighting, 85mm portrait lens, ultra-detailed skin texture --no modern clothes, no noise, no anatomical distortion`;
  };

  const getLocationPrompt = (loc: LocationBible) => {
    if (loc.master_environment_prompt && loc.master_environment_prompt.trim().length > 0) return loc.master_environment_prompt;
    const arch = loc.architectural_style || loc.architecture || 'ancient architecture';
    const env = loc.environment || loc.landscape || loc.description || 'historical landscape';
    const light = loc.lighting_atmosphere || loc.lighting_style || 'natural volumetric lighting';
    return `Cinematic wide master landscape shot of ${loc.name}, featuring ${arch}, ${env}, ${light}, 8k ultra-detailed, photorealistic, 35mm anamorphic lens --no modern buildings, no asphalt, no vehicles`;
  };

  const getObjectPrompt = (obj: ObjectBible) => {
    const mat = obj.material || 'authentic material';
    const desc = obj.description || 'narrative hero prop';
    return `Cinematic close-up hero shot of ${obj.name}, ${desc}, crafted from ${mat}, historical craftsmanship, studio volumetric lighting, 8k resolution, macro lens --no plastic, no modern logos, no AI artifacts`;
  };

  // Filter items based on search & tab
  const filteredCharacters = characters.filter((c) =>
    (activeTab === 'all' || activeTab === 'characters') &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.physical_description || c.physical_appearance || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredLocations = locations.filter((l) =>
    (activeTab === 'all' || activeTab === 'locations') &&
    (l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.description || l.environment || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredObjects = objects.filter((o) =>
    (activeTab === 'all' || activeTab === 'objects') &&
    (o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalAssets = characters.length + locations.length + objects.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#181926] border border-[#2B2D44] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-amber-400 font-bold">
            <Layers className="w-4 h-4" />
            <span>Stage 2 &amp; 3 • Visual Asset Bibles</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Visual Asset &amp; Bible Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
            Daftar ringkas Character Bible, Location Bible, dan Object Bible. Default collapsed untuk tampilan ringkas dengan tombol salin prompt 1-klik.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleExpandAll(true)}
            className="px-3 py-2 bg-[#212335] hover:bg-[#282B42] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324D] transition"
          >
            Buka Semua
          </button>
          <button
            onClick={() => toggleExpandAll(false)}
            className="px-3 py-2 bg-[#212335] hover:bg-[#282B42] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324D] transition"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <span>Semua Asset</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20">
              {totalAssets}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('characters')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'characters'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Karakter / Tokoh</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-amber-300">
              {characters.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'locations'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Lokasi &amp; Latar</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-cyan-300">
              {locations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('objects')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'objects'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Objek &amp; Pusaka</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-emerald-300">
              {objects.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari asset, nama tokoh, atau material..."
            className="w-full bg-[#1B1C2E] border border-[#2B2D44] focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* 1. SECTION: CHARACTERS */}
      {(activeTab === 'all' || activeTab === 'characters') && filteredCharacters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
            <Users className="w-4 h-4" />
            <span>1. Character Bibles &amp; Prompts ({filteredCharacters.length})</span>
          </div>

          <div className="space-y-3">
            {filteredCharacters.map((char, idx) => {
              const cardId = `char-${char.id || idx}`;
              const isExpanded = expandedIds[cardId] ?? false; // DEFAULT IS COLLAPSED (false)
              const promptStr = getCharacterPrompt(char);

              return (
                <div
                  key={cardId}
                  className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-xl transition"
                >
                  {/* Card Header Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                        {char.role || 'Tokoh Utama'}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{char.name}</h3>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline-block">
                        Identity Lock v{char.identity_version || 1} 🔒
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(promptStr, cardId)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Salin Prompt Visual Karakter 1-Klik"
                      >
                        {copiedId === cardId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === cardId ? 'Tersalin!' : 'Salin Prompt Karakter'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(cardId)}
                        className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-white transition border border-[#2F324D]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Copyable Prompt Box */}
                  <div className="p-3 rounded-xl bg-[#121320] border border-[#26283D] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Banana Image Prompt (Google Format)
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                      {promptStr}
                    </p>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-[#292B42] text-xs animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="p-2.5 rounded-xl bg-[#212335] border border-[#2F324D]">
                          <span className="text-slate-400 block text-[10px] uppercase">Usia</span>
                          <span className="font-bold text-white">{char.age || 'Dewasa'}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#212335] border border-[#2F324D]">
                          <span className="text-slate-400 block text-[10px] uppercase">Gender</span>
                          <span className="font-bold text-white">{char.gender || 'Laki-Laki'}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi Fisik</span>
                        <p className="text-slate-200 leading-relaxed">
                          {char.physical_description || char.physical_appearance || 'Penampilan fisik khas era sejarah.'}
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Wardrobe &amp; Kostum Lock</span>
                        <p className="text-slate-200 leading-relaxed">
                          {char.costume || char.wardrobe || (char.clothing?.length ? char.clothing.join(', ') : 'Pakaian autentik.')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SECTION: LOCATIONS */}
      {(activeTab === 'all' || activeTab === 'locations') && filteredLocations.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
            <MapPin className="w-4 h-4" />
            <span>2. Location Bibles &amp; Prompts ({filteredLocations.length})</span>
          </div>

          <div className="space-y-3">
            {filteredLocations.map((loc, idx) => {
              const cardId = `loc-${loc.id || idx}`;
              const isExpanded = expandedIds[cardId] ?? false; // DEFAULT IS COLLAPSED (false)
              const promptStr = getLocationPrompt(loc);

              return (
                <div
                  key={cardId}
                  className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-xl transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-md border border-cyan-500/30">
                        {loc.architectural_style || loc.architecture || 'Arsitektur Kuno'}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{loc.name}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(promptStr, cardId)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Salin Prompt Visual Lokasi 1-Klik"
                      >
                        {copiedId === cardId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === cardId ? 'Tersalin!' : 'Salin Prompt Lokasi'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(cardId)}
                        className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-white transition border border-[#2F324D]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Copyable Prompt Box */}
                  <div className="p-3 rounded-xl bg-[#121320] border border-[#26283D] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Location Banana Image Prompt
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                      {promptStr}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-[#292B42] text-xs animate-in fade-in">
                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi Latar</span>
                        <p className="text-slate-200 leading-relaxed">
                          {loc.description || loc.environment || 'Latar tempat autentik sinematik.'}
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">Pencahayaan &amp; Atmosfer</span>
                        <p className="text-slate-200 leading-relaxed">
                          {loc.lighting_atmosphere || loc.lighting_style || 'Cahaya alami atmosferik.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SECTION: OBJECTS */}
      {(activeTab === 'all' || activeTab === 'objects') && filteredObjects.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
            <Package className="w-4 h-4" />
            <span>3. Object Inventory &amp; Prompts ({filteredObjects.length})</span>
          </div>

          <div className="space-y-3">
            {filteredObjects.map((obj, idx) => {
              const cardId = `obj-${obj.id || idx}`;
              const isExpanded = expandedIds[cardId] ?? false; // DEFAULT IS COLLAPSED (false)
              const promptStr = getObjectPrompt(obj);

              return (
                <div
                  key={cardId}
                  className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-xl transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                        Material: {obj.material || 'Kuno'}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{obj.name}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(promptStr, cardId)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Salin Prompt Visual Objek 1-Klik"
                      >
                        {copiedId === cardId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === cardId ? 'Tersalin!' : 'Salin Prompt Objek'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(cardId)}
                        className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-white transition border border-[#2F324D]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Copyable Prompt Box */}
                  <div className="p-3 rounded-xl bg-[#121320] border border-[#26283D] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Object Hero Banana Prompt
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                      {promptStr}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1 text-xs animate-in fade-in">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi &amp; Detail Pusaka</span>
                      <p className="text-slate-200 leading-relaxed">
                        {obj.description || 'Pusaka atau artefak penting dalam alur cerita.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
