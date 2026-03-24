import React, { useState, useEffect } from 'react';
import { Upload, Zap, Download, Sparkles, Settings } from 'lucide-react';

// IMPORTANTE: Reemplaza con tu token de Replicate
const REPLICATE_API_TOKEN = import.meta.env.VITE_REPLICATE_API_TOKEN || '';

const PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 5, price: 7.99 },
  { id: 'popular', name: 'Popular', credits: 15, price: 17.99, badge: 'MÁS POPULAR', savings: '40%' },
  { id: 'pro', name: 'Pro', credits: 50, price: 44.99, badge: 'MEJOR VALOR', savings: '55%' }
];

const STYLE_PROMPTS = {
  grotesque: {
    name: "Ren & Stimpy Grotesco",
    prompt: "in the style of Ren and Stimpy 1990s Nickelodeon cartoon, grotesque exaggerated cartoon style, bulging eyes, extreme facial expressions, huge teeth, detailed gross textures, vibrant colors, absurd proportions, thick black outlines, disgusting details, over-the-top expressions, John Kricfalusi art style"
  },
  classic: {
    name: "Cartoon Clásico 90s",
    prompt: "1990s cartoon style, thick outlines, vibrant colors, exaggerated features, cel shaded, retro animation style, bold colors, simplified shapes"
  },
  extreme: {
    name: "Ultra Grotesco",
    prompt: "extremely grotesque cartoon style like Ren and Stimpy closeups, hyper detailed disgusting textures, massive bulging eyes, giant crooked teeth, drool, wrinkles, veins, extreme exaggeration, gross-out humor, unsettling expressions"
  }
};

function App() {
  const [credits, setCredits] = useState(() => {
    return parseInt(localStorage.getItem('credits') || '2');
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [convertedImage, setConvertedImage] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [styleStrength, setStyleStrength] = useState(0.75);
  const [promptStyle, setPromptStyle] = useState<keyof typeof STYLE_PROMPTS>('grotesque');

  useEffect(() => {
    localStorage.setItem('credits', credits.toString());
  }, [credits]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('La imagen debe ser menor a 10MB');
        return;
      }
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setConvertedImage(null);
      setError('');
    }
  };

  const uploadToReplicate = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const pollPrediction = async (predictionUrl: string): Promise<string> => {
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      const response = await fetch(predictionUrl, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        }
      });
      
      const prediction = await response.json();
      
      if (prediction.status === 'succeeded') {
        return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      } else if (prediction.status === 'failed') {
        throw new Error('La conversión falló');
      }
      
      setProgress(`Procesando... ${Math.min(attempts * 5, 95)}%`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Tiempo de espera agotado');
  };

  const convertImage = async () => {
    if (!selectedImage) {
      setError('Por favor selecciona una imagen primero');
      return;
    }

    if (credits < 1) {
      setShowPricing(true);
      setError('No tienes créditos suficientes. ¡Compra un paquete!');
      return;
    }

    setIsConverting(true);
    setError('');
    setProgress('Preparando imagen...');

    try {
      const imageDataUrl = await uploadToReplicate(selectedImage);
      setProgress('Iniciando conversión...');
      
      const selectedStylePrompt = STYLE_PROMPTS[promptStyle];
      
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
          input: {
            image: imageDataUrl,
            prompt: selectedStylePrompt.prompt,
            negative_prompt: "realistic, photo, photography, photorealistic, blurry, low quality, pixelated, watermark",
            prompt_strength: styleStrength,
            num_inference_steps: 30,
            guidance_scale: 7.5,
            scheduler: "DPMSolverMultistep"
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear la predicción');
      }

      const prediction = await response.json();
      setProgress('Aplicando estilo cartoon...');
      const output = await pollPrediction(prediction.urls.get);
      
      setConvertedImage(output);
      setCredits(credits - 1);
      setProgress('');
      
    } catch (err) {
      console.error('Error:', err);
      setError('Error al convertir: ' + (err as Error).message);
    } finally {
      setIsConverting(false);
    }
  };

  const handlePurchase = (pkg: typeof PACKAGES[0]) => {
    alert(`Redirigiendo a Stripe para comprar ${pkg.name} (${pkg.credits} créditos por $${pkg.price})`);
    setTimeout(() => {
      setCredits(credits + pkg.credits);
      setShowPricing(false);
      alert('¡Compra exitosa! Se han agregado ' + pkg.credits + ' créditos a tu cuenta.');
    }, 1000);
  };

  const downloadImage = () => {
    if (!convertedImage) return;
    const link = document.createElement('a');
    link.href = convertedImage;
    link.download = 'cartoon-converted.png';
    link.target = '_blank';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700">
      <header className="bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="text-yellow-400" size={32} />
            <h1 className="text-2xl font-bold text-white">Cartoon Converter</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="bg-white/10 backdrop-blur p-2 rounded-full border border-white/20 hover:bg-white/20 transition-colors"
            >
              <Settings className="text-white" size={20} />
            </button>
            <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20">
              <span className="text-white font-semibold">⚡ {credits} créditos</span>
            </div>
            <button
              onClick={() => setShowPricing(!showPricing)}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform"
            >
              Comprar Créditos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-white px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {showSettings && (
          <div className="mb-8 bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">⚙️ Configuración de Estilo</h3>
            <div className="space-y-6">
              <div>
                <label className="text-white font-semibold mb-2 block">Estilo de Cartoon</label>
                <div className="grid md:grid-cols-3 gap-4">
                  {(Object.entries(STYLE_PROMPTS) as [keyof typeof STYLE_PROMPTS, typeof STYLE_PROMPTS[keyof typeof STYLE_PROMPTS]][]).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => setPromptStyle(key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        promptStyle === key
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-white/20 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-white font-semibold mb-1">{style.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-white font-semibold mb-2 block">
                  Intensidad del Estilo: {Math.round(styleStrength * 100)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={styleStrength}
                  onChange={(e) => setStyleStrength(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-white/50 text-sm mt-1">
                  <span>Sutil</span>
                  <span>Extremo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPricing && (
          <div className="mb-8 bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <h2 className="text-3xl font-bold text-white mb-2 text-center">Elige tu Paquete</h2>
            <p className="text-white/70 text-center mb-8">Sin expiración • Sin suscripciones • Paga solo por lo que usas</p>
            <div className="grid md:grid-cols-3 gap-6">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative bg-white/10 backdrop-blur rounded-xl p-6 border-2 ${
                    pkg.badge ? 'border-yellow-400 scale-105' : 'border-white/20'
                  } hover:scale-110 transition-transform`}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-4 py-1 rounded-full">
                      {pkg.badge}
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
                    <div className="text-5xl font-bold text-white mb-2">${pkg.price}</div>
                    <div className="text-white/70 mb-4">{pkg.credits} conversiones</div>
                    {pkg.savings && (
                      <div className="bg-green-500/20 text-green-300 text-sm font-bold py-1 px-3 rounded-full inline-block mb-4">
                        AHORRA {pkg.savings}
                      </div>
                    )}
                    <div className="text-white/50 text-sm mb-6">
                      ${(pkg.price / pkg.credits).toFixed(2)} por conversión
                    </div>
                    <button
                      onClick={() => handlePurchase(pkg)}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-lg hover:scale-105 transition-transform"
                    >
                      Comprar Ahora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="text-purple-400" />
              Imagen Original
            </h2>
            {!previewUrl ? (
              <label className="block cursor-pointer">
                <div className="border-4 border-dashed border-white/30 rounded-xl p-12 text-center hover:border-purple-400 transition-colors">
                  <Upload className="mx-auto text-white/50 mb-4" size={64} />
                  <p className="text-white text-lg mb-2">Arrastra tu imagen aquí</p>
                  <p className="text-white/50 text-sm">o haz clic para seleccionar</p>
                  <p className="text-white/30 text-xs mt-2">Máximo 10MB • JPG, PNG</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div>
                <img src={previewUrl} alt="Preview" className="w-full rounded-xl mb-4" />
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedImage(null);
                    setConvertedImage(null);
                  }}
                  className="w-full bg-white/10 text-white py-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cambiar Imagen
                </button>
              </div>
            )}
          </div>

          <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="text-yellow-400" />
              Versión Cartoon
            </h2>
            {!convertedImage ? (
              <div className="border-4 border-dashed border-white/30 rounded-xl p-12 text-center">
                <svg className="mx-auto text-white/50 mb-4" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="text-white/50 text-lg mb-2">Tu imagen convertida aparecerá aquí</p>
                {isConverting && progress && (
                  <p className="text-yellow-400 text-sm mb-4">{progress}</p>
                )}
                <button
                  onClick={convertImage}
                  disabled={!selectedImage || isConverting || credits < 1}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {isConverting ? (
                    <>
                      <Zap className="animate-spin" />
                      Convirtiendo...
                    </>
                  ) : (
                    <>
                      <Zap />
                      Convertir (1 crédito)
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <img src={convertedImage} alt="Converted" className="w-full rounded-xl mb-4" />
                <div className="flex gap-4">
                  <button
                    onClick={downloadImage}
                    className="flex-1 bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold py-3 rounded-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    <Download />
                    Descargar
                  </button>
                  <button
                    onClick={() => {
                      setConvertedImage(null);
                      setPreviewUrl(null);
                      setSelectedImage(null);
                    }}
                    className="flex-1 bg-white/10 text-white py-3 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Nueva Conversión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-r from-purple-600/30 to-pink-600/30 backdrop-blur rounded-xl p-6 border border-white/20">
          <p className="text-white text-center">
            🎨 Tienes <strong>{credits} créditos gratis</strong> para probar • 
            Conversiones ilimitadas con paquetes • Sin expiración • Sin marca de agua
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
