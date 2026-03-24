import React, { useState, useEffect } from 'react';
import { Upload, Zap, Download, Sparkles, Settings } from 'lucide-react';

// IMPORTANTE: Reemplaza con tu token de Replicate
const REPLICATE_API_TOKEN = 'TU_TOKEN_DE_REPLICATE_AQUI';

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
