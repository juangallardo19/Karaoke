import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

const MicrofonoKaraoke = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState('');
  
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      
      // Crear contexto de audio
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Solicitar acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Crear nodos de audio
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gainNode = audioContextRef.current.createGain();
      
      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;
      
      // Configurar ganancia (volumen)
      gainNode.gain.value = volume;
      
      // Conectar: micrófono -> ganancia -> altavoces
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      
    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      setError('No se pudo acceder al micrófono. Asegúrate de dar permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    setIsRecording(false);
  };

  const toggleMute = () => {
    if (gainNodeRef.current) {
      if (isMuted) {
        gainNodeRef.current.gain.value = volume;
      } else {
        gainNodeRef.current.gain.value = 0;
      }
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (gainNodeRef.current && !isMuted) {
      gainNodeRef.current.gain.value = newVolume;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20">
        
        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🎤 Karaoke Mic</h1>
          <p className="text-white/70">Micrófono en tiempo real</p>
        </div>

        {/* Indicador visual */}
        <div className="flex justify-center mb-8">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording 
              ? 'bg-red-500/20 border-4 border-red-500 animate-pulse' 
              : 'bg-gray-500/20 border-4 border-gray-500'
          }`}>
            {isRecording ? (
              <Mic className="w-16 h-16 text-red-400" />
            ) : (
              <MicOff className="w-16 h-16 text-gray-400" />
            )}
          </div>
        </div>

        {/* Estado */}
        <div className="text-center mb-6">
          <p className="text-white text-lg font-medium">
            {isRecording ? '🔴 TRANSMITIENDO' : '⚪ DESCONECTADO'}
          </p>
        </div>

        {/* Controles principales */}
        <div className="space-y-4 mb-6">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isRecording ? 'DETENER' : 'INICIAR MICRÓFONO'}
          </button>

          {isRecording && (
            <button
              onClick={toggleMute}
              className={`w-full py-3 rounded-2xl font-medium transition-all duration-300 ${
                isMuted
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="inline w-5 h-5 mr-2" />
                  ACTIVAR SONIDO
                </>
              ) : (
                <>
                  <Volume2 className="inline w-5 h-5 mr-2" />
                  SILENCIAR
                </>
              )}
            </button>
          )}
        </div>

        {/* Control de volumen */}
        {isRecording && (
          <div className="mb-6">
            <label className="block text-white text-sm font-medium mb-2">
              Volumen: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 50}%, rgba(255,255,255,0.2) ${volume * 50}%, rgba(255,255,255,0.2) 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>0%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="bg-white/5 rounded-2xl p-4 mb-4">
          <h3 className="text-white font-medium mb-2">📋 Instrucciones:</h3>
          <ol className="text-white/80 text-sm space-y-1">
            <li>1. Conecta tu celular al altavoz Bluetooth</li>
            <li>2. Presiona "INICIAR MICRÓFONO"</li>
            <li>3. Permite el acceso al micrófono</li>
            <li>4. ¡Canta y disfruta! 🎵</li>
          </ol>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-2xl p-4 mb-4">
            <p className="text-red-200 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Consejo */}
        <div className="bg-blue-500/20 border border-blue-500 rounded-2xl p-4">
          <p className="text-blue-200 text-sm">
            💡 <strong>Consejo:</strong> Ajusta el volumen para evitar retroalimentación (feedback).
          </p>
        </div>

      </div>
    </div>
  );
};

export default MicrofonoKaraoke;