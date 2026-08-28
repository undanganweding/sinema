import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  Clock,
  Sliders,
  Languages,
  FileText,
  AlertCircle,
  HelpCircle,
  Film,
  Zap,
  Cpu,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  Lock,
  Globe,
  Key,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Server,
  Tag,
} from 'lucide-react';
import { PromptLanguage, GeminiModelOption, ReasoningConfig, ReasoningProviderType } from '../types';

interface NewProjectFormProps {
  onSubmit: (formData: {
    title: string;
    raw_script: string;
    total_duration_target_sec: number;
    max_scene_shot_duration_sec: number | null;
    scene_duration_sec?: number | null;
    allow_final_scene_override?: boolean;
    prompt_language: PromptLanguage;
    ai_model?: string;
    reasoning_config?: ReasoningConfig;
    image_model?: 'nano_banana_pro';
    video_model?: ('veo' | 'gemini_omni')[];
    include_seedance_format?: boolean;
  }) => Promise<void>;
  isLoading: boolean;
}

const PRESET_DURATIONS = [
  { label: '30 dtk', value: 30 },
  { label: '1 mnt', value: 60 },
  { label: '2 mnt', value: 120 },
  { label: '3 mnt', value: 180 },
  { label: '5 mnt', value: 300 },
  { label: '10 mnt', value: 600 },
  { label: 'Kustom', value: -1 },
];

const PRESET_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Direkomendasikan',
    description: 'Generasi terbaru dengan penalaran adaptif sinematik & latensi sangat responsif.',
    isRecommended: true,
    tier: 'flash',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Cepat & Stabil',
    description: 'Model ultra cepat dan stabil untuk pemrosesan teks, karakter & durasi.',
    isRecommended: false,
    tier: 'flash',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Penalaran Mendalam',
    description: 'Analisis naratif mendalam & struktur cerita sinematik berlapis.',
    isRecommended: false,
    tier: 'pro',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Cepat',
    description: 'Model teringan dan super cepat untuk drafting cepat.',
    isRecommended: false,
    tier: 'lite',
  },
];

const SAMPLE_SCRIPTS = [
  {
    title: 'Cyberpunk 2099: Project Chimera',
    script: `EXT. NEO-JAKARTA DISTRICT 9 - NIGHT
Hujan asam berpendar diterangi lampu hologram raksasa perusahaan bioteknologi GENE-CORP.

KAYLA (29, seorang cyber-infiltrator dengan mata bionik safir dan jaket kulit sintetis usang) memanjat ventilasi atap gedung pencakar langit. Nafasnya terengah, uap dingin keluar dari masker filter karbonnya.

KAYLA
(berbisik ke interkom)
"Gema, protokol sensor optik mereka mati selama 90 detik. Beri aku akses pintu masuk."

GEMA (V.O.)
(suara tenang, dingin lewat transmisi radio frekuensi rendah)
"Waktumu berjalan sekarang, Kayla. Jangan sentuh konsol pusat sebelum inti AI diisolasi."

INT. RUANG SERVER VAULT - CONTINUOUS
Kayla mendarat tanpa suara di lantai marmer hitam bergradien cahaya biru cryogenic. Di tengah ruangan, sebuah tabung silinder berisi 'Protius Core' berdenyut memancarkan partikel cahaya keemasan.

Kayla mengeluarkan dek dekripsi holografik berbentuk belati kristal. Saat ia memasukkan dek, alarm merah berputar seketika.

SUARA SISTEM
"Penyusup terdeteksi. Protokol lockdown level 4 aktif."

Pintu baja terbuka, menampakkan ARYA (42, kepala keamanan Gene-Corp dengan lengan cybernetic tempur berat dan mantel hitam lapis baja).

ARYA
"Kau terlambat, Kayla. File memori ayahmu sudah lama dimusnahkan."

Kayla menatap tajam, menggenggam belati kristal yang kini menyala terang.

KAYLA
"Ayahku tidak pernah meninggalkan memorinya di sini. Dia meninggalkan kunci untuk menghancurkan kalian."`,
  },
  {
    title: 'Nusantara: Pusaka Keraton Bayangan',
    script: `EXT. ALUN-ALUN KERATON JAWA KUNO - KABUT SENJA
Kabut tebal menyelimuti pelataran batu hitam candi. Angin berhembus kencang mengibarkan panji-panji perang kerajaan Majapahit akhir.

SENOPATI MAHESA (35, ksatria bertubuh tegap, mengenakan zirah tembaga berukir naga dan selendang merah tua) berdiri memegang Keris Kyai Sengkelat yang memancarkan aura hawa panas.

Di hadapannya, NYAI KINANTI (60-an, ahli kebatinan berpakaian kebaya hitam sutra dengan rambut sanggul perak) menatap pusaka tersebut dengan mata penuh firasat.

NYAI KINANTI
"Keris ini menuntut pengorbanan darah seorang pemimpin sejati sebelum fajar menyingsing, Senopati."

SENOPATI MAHESA
"Bukan darah rakyat yang akan tumpah malam ini, Nyai. Pasukan bayangan Kadipaten Utara telah melewati gerbang barat."

Suara derap ratusan kuda berzirah mulai menggetarkan tanah. Mahesa menghunus kerisnya ke angkasa, kilat menyambar membelah langit senja.`,
  },
];

export const NewProjectForm: React.FC<NewProjectFormProps> = ({ onSubmit, isLoading }) => {
  const [title, setTitle] = useState('');
  const [rawScript, setRawScript] = useState('');
  const [selectedDurationPreset, setSelectedDurationPreset] = useState<number>(120); // default 2m
  const [customDuration, setCustomDuration] = useState<number>(90);
  const [isAutoSceneDuration, setIsAutoSceneDuration] = useState<boolean>(true); // default Auto (null)
  const [fixedSceneDuration, setFixedSceneDuration] = useState<number>(10);
  const [allowFinalSceneOverride, setAllowFinalSceneOverride] = useState<boolean>(false);
  const [promptLanguage, setPromptLanguage] = useState<PromptLanguage>('id');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash');
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [isCustomModelActive, setIsCustomModelActive] = useState<boolean>(false);
  // Reasoning Model Provider State
  const [providerType, setProviderType] = useState<ReasoningProviderType>('google');
  const [externalBaseUrl, setExternalBaseUrl] = useState<string>('');
  const [externalModelId, setExternalModelId] = useState<string>('');
  const [externalApiKey, setExternalApiKey] = useState<string>('');
  const [externalDisplayName, setExternalDisplayName] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const [selectedVideoModels, setSelectedVideoModels] = useState<('veo' | 'gemini_omni')[]>(['veo']);
  const [includeSeedance, setIncludeSeedance] = useState<boolean>(false);
  const [hasOmniCapability, setHasOmniCapability] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capability check for Gemini Omni
  useEffect(() => {
    fetch('/api/capabilities/omni')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.hasOmni) {
          setHasOmniCapability(true);
        }
      })
      .catch(() => {
        setHasOmniCapability(false);
      });
  }, []);

  const effectiveTotalDuration =
    selectedDurationPreset === -1 ? customDuration : selectedDurationPreset;

  const effectiveModel = isCustomModelActive ? customModelInput.trim() || 'gemini-3.7-flash' : selectedModel;

  const getProviderName = (type: ReasoningProviderType): string => {
    switch (type) {
      case 'google': return 'Google Gemini';
      case 'openrouter': return 'OpenRouter';
      case 'openai': return 'OpenAI';
      case 'xai': return 'xAI / Grok';
      case 'custom_openai': return 'Custom OpenAI-Compatible';
    }
  };

  const handleProviderChange = (type: ReasoningProviderType) => {
    setProviderType(type);
    setTestStatus('idle');
    setTestMessage(null);
    if (type === 'openrouter') {
      if (!externalBaseUrl || externalBaseUrl.includes('api.openai.com') || externalBaseUrl.includes('api.x.ai')) {
        setExternalBaseUrl('https://openrouter.ai/api/v1');
      }
      if (!externalModelId) setExternalModelId('qwen/qwen-2.5-72b-instruct:free');
    } else if (type === 'openai') {
      if (!externalBaseUrl || externalBaseUrl.includes('openrouter.ai') || externalBaseUrl.includes('api.x.ai')) {
        setExternalBaseUrl('https://api.openai.com/v1');
      }
      if (!externalModelId) setExternalModelId('gpt-4o');
    } else if (type === 'xai') {
      if (!externalBaseUrl || externalBaseUrl.includes('openrouter.ai') || externalBaseUrl.includes('api.openai.com')) {
        setExternalBaseUrl('https://api.x.ai/v1');
      }
      if (!externalModelId) setExternalModelId('grok-2-latest');
    } else if (type === 'custom_openai') {
      if (!externalBaseUrl || externalBaseUrl.includes('together.xyz') || externalBaseUrl.includes('openrouter.ai') || externalBaseUrl.includes('openai.com')) {
        setExternalBaseUrl('https://tabitoken.com/v1');
      }
      if (!externalModelId || externalModelId.includes('DeepSeek')) setExternalModelId('ops-5');
      if (!externalDisplayName) setExternalDisplayName('Tabitoken ops-5');
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(null);

    const modelToTest = providerType === 'google' ? effectiveModel : externalModelId.trim();
    if (!modelToTest) {
      setTestStatus('failed');
      setTestMessage('Model ID wajib diisi sebelum melakukan uji koneksi.');
      return;
    }

    try {
      const res = await fetch('/api/test-llm-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_type: providerType,
          provider_name: getProviderName(providerType),
          base_url: externalBaseUrl.trim() || undefined,
          model_id: modelToTest,
          api_key: externalApiKey.trim() || undefined,
          display_name: externalDisplayName.trim() || modelToTest,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestMessage(data.message || 'Koneksi ke LLM berhasil! Model siap digunakan.');
      } else {
        setTestStatus('failed');
        setTestMessage(data.message || 'Gagal terhubung ke model.');
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage(err?.message || 'Error saat menghubungi server untuk uji koneksi.');
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawScript(content);
        if (!title) {
          const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setTitle(autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const loadSampleScript = (sampleIndex: number) => {
    const sample = SAMPLE_SCRIPTS[sampleIndex];
    if (sample) {
      setTitle(sample.title);
      setRawScript(sample.script);
    }
  };

  const toggleVideoModel = (modelKey: 'veo' | 'gemini_omni') => {
    if (selectedVideoModels.includes(modelKey)) {
      if (selectedVideoModels.length === 1) return; // Keep at least one
      setSelectedVideoModels(selectedVideoModels.filter((m) => m !== modelKey));
    } else {
      setSelectedVideoModels([...selectedVideoModels, modelKey]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Silakan isi judul proyek.');
      return;
    }
    if (!rawScript.trim()) {
      setErrorMessage('Silakan masukkan naskah atau storyboard cerita.');
      return;
    }
    if (effectiveTotalDuration < 10) {
      setErrorMessage('Total durasi minimal adalah 10 detik.');
      return;
    }

    if (providerType === 'google') {
      if (isCustomModelActive && !customModelInput.trim()) {
        setErrorMessage('Silakan masukkan nama/ID model Google Gemini kustom.');
        return;
      }
    } else {
      if (!externalModelId.trim()) {
        setErrorMessage('Silakan masukkan ID Model untuk penyedia terpilih.');
        return;
      }
    }

    const isDivisible = isAutoSceneDuration || (effectiveTotalDuration % fixedSceneDuration === 0);
    if (!isAutoSceneDuration && !isDivisible && !allowFinalSceneOverride) {
      setErrorMessage(
        `Durasi target (${effectiveTotalDuration} detik) tidak habis dibagi durasi adegan (${fixedSceneDuration} detik). Silakan sesuaikan durasi adegan, total durasi, atau aktifkan 'Izinkan Penyesuaian Adegan Terakhir'.`
      );
      return;
    }

    let reasoning_config: ReasoningConfig;
    if (providerType === 'google') {
      reasoning_config = {
        provider_type: 'google',
        provider_name: 'Google Gemini',
        model_id: effectiveModel,
        display_name: effectiveModel,
      };
    } else {
      reasoning_config = {
        provider_type: providerType,
        provider_name: getProviderName(providerType),
        base_url: externalBaseUrl.trim() || undefined,
        model_id: externalModelId.trim(),
        api_key: externalApiKey.trim() || undefined,
        display_name: externalDisplayName.trim() || externalModelId.trim(),
      };
    }

    const payload = {
      title: title.trim(),
      raw_script: rawScript.trim(),
      total_duration_target_sec: effectiveTotalDuration,
      max_scene_shot_duration_sec: isAutoSceneDuration ? null : fixedSceneDuration,
      scene_duration_sec: isAutoSceneDuration ? null : fixedSceneDuration,
      allow_final_scene_override: allowFinalSceneOverride,
      prompt_language: promptLanguage,
      ai_model: reasoning_config.model_id,
      reasoning_config,
      image_model: 'nano_banana_pro' as const,
      video_model: selectedVideoModels,
      include_seedance_format: includeSeedance,
    };

    try {
      await onSubmit(payload);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memulai proyek.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      <div className="mb-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
          <Film className="w-3.5 h-3.5" />
          <span>Pipeline Produksi Sinematik Tahap 1-8</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
          Proyek Sinematik Baru
        </h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
          Ubah naskah mentah menjadi cetak biru produksi film lengkap (Fondasi Cerita, Kitab Karakter & Lokasi, Struktur 5-Babak, Linimasa Adegan, Master Frame Nano Banana Pro, dan Prompt Video).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Validasi Masukan</p>
              <p className="text-xs text-red-400/90 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* INPUT 1: Judul + Naskah */}
        <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              1. Judul Proyek & Naskah Mentah / Storyboard
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 hidden sm:inline">Contoh Naskah:</span>
              {SAMPLE_SCRIPTS.map((sample, idx) => (
                <button
                  key={sample.title}
                  type="button"
                  onClick={() => loadSampleScript(idx)}
                  className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition border border-zinc-700/50 cursor-pointer"
                >
                  Contoh {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="project-title" className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Judul Proyek
            </label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pelarian Neon 2099 / Pusaka Keraton Bayangan"
              className="w-full bg-zinc-950/80 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition font-medium"
            />
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-xl transition ${
              dragActive ? 'ring-2 ring-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="raw-script" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Teks Naskah Mentah / Storyboard
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.fountain,.md"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                  id="file-upload-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1.5 px-2 py-1 rounded hover:bg-amber-500/10 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah .txt/.md</span>
                </button>
                <span className="text-[11px] text-zinc-400">
                  {rawScript.length} karakter • {rawScript.split(/\s+/).filter(Boolean).length} kata
                </span>
              </div>
            </div>

            <textarea
              id="raw-script"
              rows={8}
              value={rawScript}
              onChange={(e) => setRawScript(e.target.value)}
              placeholder="Tempelkan naskah skenario, draf adegan, deskripsi visual storyboard, atau dialog di sini..."
              className="w-full bg-zinc-950/80 border border-zinc-700/80 rounded-xl p-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition font-mono leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* INPUT 2: Total Durasi Video */}
        <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              2. Total Durasi Video (Target Eksak)
            </label>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20">
              {effectiveTotalDuration} Detik ({Math.floor(effectiveTotalDuration / 60)} mnt {effectiveTotalDuration % 60} dtk)
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Pilih target durasi film. Orkestrator akan memvalidasi alokasi durasi adegan dengan toleransi eksak 0 detik.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {PRESET_DURATIONS.map((preset) => {
              const isSelected = selectedDurationPreset === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setSelectedDurationPreset(preset.value)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-950/70 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {selectedDurationPreset === -1 && (
            <div className="pt-2 flex items-center gap-3">
              <label htmlFor="custom-duration-input" className="text-xs text-zinc-400 whitespace-nowrap">
                Durasi Kustom (Detik):
              </label>
              <input
                id="custom-duration-input"
                type="number"
                min={10}
                max={3600}
                value={customDuration}
                onChange={(e) => setCustomDuration(Math.max(10, Number(e.target.value)))}
                className="w-32 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400 font-mono">
                = {Math.floor(customDuration / 60)} menit {customDuration % 60} detik
              </span>
            </div>
          )}
        </div>

        {/* INPUT 3: Durasi Scene */}
        <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              3. Durasi Adegan (Scene)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAutoSceneDuration(true)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  isAutoSceneDuration
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
              >
                Otomatis (Naratif)
              </button>
              <button
                type="button"
                onClick={() => setIsAutoSceneDuration(false)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  !isAutoSceneDuration
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
              >
                Durasi Adegan Tetap
              </button>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            {isAutoSceneDuration
              ? 'Mode Otomatis: Orkestrator menentukan distribusi durasi adegan berdasarkan struktur naratif (5-30 detik per adegan). Total seluruh adegan dipastikan TEPAT sama dengan target durasi.'
              : 'Durasi setiap adegan. Durasi shot akan ditentukan otomatis berdasarkan rincian adegan. SEMUA ADEGAN WAJIB menggunakan durasi ini.'}
          </p>

          {!isAutoSceneDuration && (
            <div className="space-y-4 pt-2">
              {/* Presets for Scene Duration */}
              <div className="flex flex-wrap items-center gap-2">
                {[5, 6, 7, 8, 10, 12, 15, 20, 30].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setFixedSceneDuration(dur)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition border cursor-pointer ${
                      fixedSceneDuration === dur
                        ? 'bg-amber-500 text-zinc-950 border-amber-400'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {dur} dtk
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">5 detik</span>
                  <span className="font-bold text-amber-400 text-sm px-2.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                    {fixedSceneDuration} Detik / Adegan ({Math.floor(effectiveTotalDuration / fixedSceneDuration)} Adegan)
                  </span>
                  <span className="text-zinc-400">30 detik</span>
                </div>
                <input
                  id="fixed-scene-slider"
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={fixedSceneDuration}
                  onChange={(e) => setFixedSceneDuration(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Divisibility Alert & Explicit Choices */}
              {effectiveTotalDuration % fixedSceneDuration !== 0 && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3 text-xs">
                  <div className="flex items-start gap-2.5 text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Durasi target tidak habis dibagi durasi adegan.</p>
                      <p className="text-amber-400/80 text-[11px] mt-0.5">
                        Target Total = {effectiveTotalDuration} detik, Durasi Adegan = {fixedSceneDuration} detik.
                        (Menghasilkan {Math.floor(effectiveTotalDuration / fixedSceneDuration)} adegan penuh + sisa {effectiveTotalDuration % fixedSceneDuration} detik).
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-500/20 space-y-2">
                    <p className="font-semibold text-zinc-200">Pilih Penyesuaian:</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Option 1: Adjust Scene Duration to nearest divisor
                          const divisors = [5, 6, 7, 8, 10, 12, 15, 20, 30].filter(
                            (d) => effectiveTotalDuration % d === 0
                          );
                          if (divisors.length > 0) {
                            const closest = divisors.reduce((prev, curr) =>
                              Math.abs(curr - fixedSceneDuration) < Math.abs(prev - fixedSceneDuration)
                                ? curr
                                : prev
                            );
                            setFixedSceneDuration(closest);
                          } else {
                            setFixedSceneDuration(10);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 transition cursor-pointer"
                      >
                        1. Sesuaikan Durasi Adegan
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          // Option 2: Adjust Total Duration to nearest multiple
                          const multiples = Math.round(effectiveTotalDuration / fixedSceneDuration);
                          const newTotal = Math.max(10, multiples * fixedSceneDuration);
                          setSelectedDurationPreset(-1);
                          setCustomDuration(newTotal);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 transition cursor-pointer"
                      >
                        2. Sesuaikan Total Durasi ({Math.round(effectiveTotalDuration / fixedSceneDuration) * fixedSceneDuration} detik)
                      </button>
                    </div>

                    <label className="flex items-center gap-2 pt-1 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowFinalSceneOverride}
                        onChange={(e) => setAllowFinalSceneOverride(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>3. Izinkan Penyesuaian Adegan Terakhir (Adegan terakhir berdurasi {effectiveTotalDuration % fixedSceneDuration} detik)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT 4: Prompt Language */}
        <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Languages className="w-4 h-4 text-amber-400" />
              4. Konfigurasi Bahasa Prompt
            </label>
            <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
              Diterapkan pada Tahap 6-8
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Bahasa keluaran analisis naratif, rincian shot, master frame, dan format prompt video.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <button
              type="button"
              onClick={() => setPromptLanguage('id')}
              className={`py-2.5 px-4 rounded-xl text-xs font-semibold transition border flex items-center justify-center gap-2 cursor-pointer ${
                promptLanguage === 'id'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
              }`}
            >
              <span className="text-base">🇮🇩</span>
              <span>Bahasa Indonesia</span>
            </button>
            <button
              type="button"
              onClick={() => setPromptLanguage('en')}
              className={`py-2.5 px-4 rounded-xl text-xs font-semibold transition border flex items-center justify-center gap-2 cursor-pointer ${
                promptLanguage === 'en'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
              }`}
            >
              <span className="text-base">🇬🇧</span>
              <span>English (Global)</span>
            </button>
          </div>
        </div>

        {/* INPUT 5: Model Target Prompt (Image & Video) */}
        <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              5. Format Target Prompt (Tahap 7 & Tahap 8)
            </label>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Output Siap Pakai
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image Prompt Target: Nano Banana Pro */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Target Prompt Gambar
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Tahap 7 Teks/JSON
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/90 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-100 block">Format Nano Banana Pro</span>
                  <span className="text-[10px] text-zinc-400">Spesifikasi Prompt Master Frame Sinematik</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Tahap 7 merumuskan prompt terstruktur siap salin untuk dibuat secara manual di AI Studio / Aplikasi Gemini, lalu diunggah ke studio.
              </p>
            </div>

            {/* Video Model Multi-Select */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <VideoIcon className="w-3.5 h-3.5 text-amber-400" />
                  Target Model Video (Tahap 8)
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Pilihan ganda</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Google Veo */}
                <button
                  type="button"
                  onClick={() => toggleVideoModel('veo')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                    selectedVideoModels.includes('veo')
                      ? 'bg-amber-500/15 border-amber-500/60 text-zinc-100'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">Google Veo</span>
                    <span className="text-[9px] text-zinc-400">Target Prompt</span>
                  </div>
                  {selectedVideoModels.includes('veo') && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                {/* Gemini Omni (Access Check Guarded) */}
                <button
                  type="button"
                  disabled={!hasOmniCapability}
                  onClick={() => hasOmniCapability && toggleVideoModel('gemini_omni')}
                  className={`p-3 rounded-lg border text-left transition ${
                    !hasOmniCapability
                      ? 'opacity-40 cursor-not-allowed bg-zinc-900/30 border-zinc-800 text-zinc-500'
                      : selectedVideoModels.includes('gemini_omni')
                      ? 'bg-amber-500/15 border-amber-500/60 text-zinc-100 cursor-pointer'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 cursor-pointer'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">Gemini Omni</span>
                    <span className="text-[9px] text-zinc-400">
                      {hasOmniCapability ? 'Format Multi-Turn' : 'Tidak Tersedia'}
                    </span>
                  </div>
                  {selectedVideoModels.includes('gemini_omni') && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            </div>
          </div>

          {/* Seedance Format Checkbox */}
          <div
            className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800 flex items-start gap-3 cursor-pointer hover:border-zinc-700 transition"
            onClick={() => setIncludeSeedance(!includeSeedance)}
          >
            <input
              type="checkbox"
              id="checkbox-seedance"
              checked={includeSeedance}
              onChange={(e) => setIncludeSeedance(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-amber-400 text-zinc-950 cursor-pointer"
            />
            <label htmlFor="checkbox-seedance" className="cursor-pointer space-y-0.5">
              <span className="text-xs font-bold text-zinc-200 block">
                Sertakan format prompt untuk Seedance
              </span>
              <span className="text-[11px] text-zinc-400 block leading-relaxed">
                Menghasilkan struktur prompt target terpisah (Gaya Global, Referensi, Sub-timestamp, Jangan Diubah). Bukan opsi pembuatan video langsung.
              </span>
            </label>
          </div>
        </div>

        {/* INPUT 6: Multi-LLM Reasoning Model Provider Selection */}
        <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div>
              <label className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                6. Model Penalaran Naskah (Penyedia Multi-LLM)
              </label>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pilih penyedia dan model AI untuk mengeksekusi analisis naskah, rincian adegan/shot, dan perumusan prompt sinematik.
              </p>
            </div>
            <span className="self-start sm:self-auto text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {getProviderName(providerType)}: {providerType === 'google' ? effectiveModel : (externalDisplayName || externalModelId || 'Pilih Model')}
            </span>
          </div>

          {/* Provider Selection Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleProviderChange('google')}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                providerType === 'google'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Google Gemini</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('openrouter')}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                providerType === 'openrouter'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>OpenRouter</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('openai')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                providerType === 'openai'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>OpenAI</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('xai')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                providerType === 'xai'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>xAI / Grok</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('custom_openai')}
              className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                providerType === 'custom_openai'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>Endpoint Kustom</span>
            </button>
          </div>

          {/* Provider Content: Google Gemini Presets */}
          {providerType === 'google' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRESET_MODELS.map((model) => {
                  const isSelected = !isCustomModelActive && selectedModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsCustomModelActive(false);
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30 shadow-lg shadow-amber-500/10'
                          : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-100">{model.name}</span>
                        {model.badge && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              model.isRecommended
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {model.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                        {model.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-500">
                        <span>ID: {model.id}</span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-amber-400 font-sans font-semibold">
                            <Check className="w-3 h-3" /> Terpilih
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Custom Gemini Model Option Card */}
                <div
                  onClick={() => setIsCustomModelActive(true)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isCustomModelActive
                      ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30 shadow-lg shadow-amber-500/10'
                      : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-100">Model Gemini Kustom</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Kustom
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Ketik nama model Google Gemini lain (misal: gemini-3.7-flash, dll).
                  </p>

                  {isCustomModelActive ? (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        placeholder="Contoh: gemini-3.7-flash"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-zinc-900 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-amber-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                      <span>Klik untuk ketik manual</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Provider Content: External OpenAI-Compatible Providers */}
          {providerType !== 'google' && (
            <div className="space-y-4 bg-zinc-950/80 p-4 sm:p-5 rounded-xl border border-zinc-800">
              {providerType === 'custom_openai' && (
                <div className="space-y-2 pb-3 border-b border-zinc-800/80">
                  <span className="text-[11px] font-semibold text-zinc-300 block">Preset Cepat Provider Kustom:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExternalBaseUrl('https://tabitoken.com/v1');
                        setExternalModelId('ops-5');
                        setExternalDisplayName('Tabitoken ops-5');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                        externalBaseUrl.includes('tabitoken.com') && externalModelId === 'ops-5'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Tabitoken (ops-5)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExternalBaseUrl('https://api.groq.com/openai/v1');
                        setExternalModelId('llama-3.3-70b-versatile');
                        setExternalDisplayName('Groq Llama 3.3');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                        externalBaseUrl.includes('groq.com')
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>Groq Cloud</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExternalBaseUrl('https://api.together.xyz/v1');
                        setExternalModelId('deepseek-ai/DeepSeek-R1');
                        setExternalDisplayName('Together DeepSeek R1');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                        externalBaseUrl.includes('together.xyz')
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Cpu className="w-3 h-3 text-purple-400" />
                      <span>Together AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExternalBaseUrl('http://localhost:11434/v1');
                        setExternalModelId('llama3');
                        setExternalDisplayName('Ollama Local');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                        externalBaseUrl.includes('11434') || externalBaseUrl.includes('localhost')
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Server className="w-3 h-3 text-sky-400" />
                      <span>Ollama (Lokal)</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Base URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                    URL Basis (Endpoint API)
                  </label>
                  <input
                    type="text"
                    value={externalBaseUrl}
                    onChange={(e) => setExternalBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <p className="text-[10px] text-zinc-400">
                    {providerType === 'openrouter' && 'Gunakan https://openrouter.ai/api/v1 untuk semua model di OpenRouter.'}
                    {providerType === 'openai' && 'Endpoint resmi standar OpenAI: https://api.openai.com/v1'}
                    {providerType === 'xai' && 'Endpoint resmi standar xAI: https://api.x.ai/v1'}
                    {providerType === 'custom_openai' && 'Endpoint API server kompatibel OpenAI Anda (Together, Groq, Ollama, vLLM, dll).'}
                  </p>
                </div>

                {/* Model ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    ID / Nama Model <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={externalModelId}
                    onChange={(e) => setExternalModelId(e.target.value)}
                    placeholder={
                      providerType === 'openrouter' ? 'cth. qwen/qwen-2.5-72b-instruct:free' :
                      providerType === 'openai' ? 'cth. gpt-4o' :
                      providerType === 'xai' ? 'cth. grok-2-latest' :
                      'cth. deepseek-ai/DeepSeek-R1'
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Nama/ID persis model yang akan dipanggil untuk penalaran naskah.
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    Kunci API (Opsional jika sudah disetel di server)
                  </label>
                  <input
                    type="password"
                    value={externalApiKey}
                    onChange={(e) => setExternalApiKey(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    Kunci diproses aman di sesi backend server dan tidak disimpan permanen di basis data.
                  </p>
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-zinc-400" />
                    Nama Tampilan / Alias (Opsional)
                  </label>
                  <input
                    type="text"
                    value={externalDisplayName}
                    onChange={(e) => setExternalDisplayName(e.target.value)}
                    placeholder="cth. Qwen 72B Free / Grok 2"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Label nama tampilan untuk log orkestrator.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Test Connection Button & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className="py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testStatus === 'testing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Menguji Koneksi LLM...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Uji Koneksi LLM</span>
                </>
              )}
            </button>

            {testStatus === 'success' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}

            {testStatus === 'failed' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 pb-8">
          <button
            id="btn-generate-project"
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-base shadow-xl shadow-amber-500/20 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Menjalankan Pipeline Orkestrasi (Tahap 1-8)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-zinc-950" />
                <span>Buat Cetak Biru Sinematik Proyek</span>
              </>
            )}
          </button>
          <p className="text-center text-xs text-zinc-400 mt-2.5 flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Orkestrator akan mengeksekusi Tahap 1 hingga 8 secara modular dengan alokasi shot presisi dan master frame Nano Banana Pro.
          </p>
        </div>
      </form>
    </div>
  );
};
