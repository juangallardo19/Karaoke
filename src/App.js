import React, { useState, useRef, useEffect } from "react";

const MicrofonoKaraoke = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState("");
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.1); // 🎯 SENSIBILIDAD DE PROXIMIDAD
  const [voiceLevel, setVoiceLevel] = useState(0); // 📊 NIVEL DE VOZ EN TIEMPO REAL
  const [isVoiceDetected, setIsVoiceDetected] = useState(false); // 🎤 DETECCIÓN DE VOZ
  const [ultraLowLatency, setUltraLowLatency] = useState(true); // ⚡ MODO ULTRA-RÁPIDO

  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserRef = useRef(null); // 📊 ANALIZADOR DE AUDIO
  const noiseGateRef = useRef(null); // 🚪 PUERTA DE RUIDO

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // 📊 MONITOREO DE AUDIO OPTIMIZADO PARA BAJA LATENCIA
  const startVoiceMonitoring = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const monitorAudio = () => {
      if (!analyserRef.current || !isRecording) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // 🎯 CÁLCULO ULTRA-RÁPIDO (menos precisión pero MÁS VELOCIDAD)
      let sum = 0;
      const step = 4; // ⚡ SALTAR MUESTRAS = MENOS CÁLCULO

      for (let i = 20; i < 100; i += step) {
        // Rango optimizado para voz
        sum += dataArray[i];
      }

      const average = sum / ((100 - 20) / step);
      const normalizedLevel = average / 255; // Normalizar 0-1

      setVoiceLevel(normalizedLevel);

      // 🎤 DETECCIÓN INSTANTÁNEA DE VOZ
      const isVoiceActive = normalizedLevel > sensitivity;
      setIsVoiceDetected(isVoiceActive);

      // 🚪 APLICAR NOISE GATE INMEDIATO (sin interpolación = más rápido)
      if (noiseGateRef.current) {
        noiseGateRef.current.gain.value = isVoiceActive ? 1 : 0;
      }

      // ⚡ CONTINUAR CON ALTA FRECUENCIA
      setTimeout(monitorAudio, 16); // ~60 FPS para respuesta rápida
    };

    monitorAudio();
  };

  const startRecording = async () => {
    try {
      setError("");
      setShowPermissionHelp(false);
      setIsConnected(false);

      // Crear contexto de audio con LATENCIA MÍNIMA
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext({
        latencyHint: "interactive", // ⚡ PRIORIDAD: INTERACTIVIDAD
        sampleRate: 44100,
      });

      // Reanudar contexto si está suspendido (necesario en algunos móviles)
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Solicitar acceso al micrófono con CONFIGURACIÓN DE LATENCIA MÍNIMA
      const constraints = {
        audio: {
          echoCancellation: true, // ✅ CANCELA EL ECO/FEEDBACK
          noiseSuppression: false, // ❌ DESACTIVADO = MENOS LATENCIA
          autoGainControl: false, // ❌ DESACTIVADO = MENOS LATENCIA
          latency: 0, // ⚡ LATENCIA MÍNIMA
          sampleRate: 44100,
          channelCount: 1, // ✅ MONO = MEJOR PARA VOZ
          bufferSize: 256, // ⚡ BUFFER PEQUEÑO = MENOS DELAY
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Crear nodos de audio OPTIMIZADOS PARA LATENCIA MÍNIMA
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gainNode = audioContextRef.current.createGain();

      // 📊 ANALIZADOR OPTIMIZADO - Configuración de baja latencia
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 512; // ⚡ MÁS PEQUEÑO = MENOS DELAY
      analyser.smoothingTimeConstant = 0.1; // ⚡ RESPUESTA MÁS RÁPIDA

      // 🚪 NOISE GATE SIMPLE - Sin demora
      const noiseGate = audioContextRef.current.createGain();
      noiseGate.gain.value = 0; // Empieza cerrado

      // 🎛️ SOLO UN FILTRO ESENCIAL - Para mantener latencia baja
      const voiceFilter = audioContextRef.current.createBiquadFilter();
      voiceFilter.type = "bandpass"; // ⚡ UN SOLO FILTRO EN LUGAR DE DOS
      voiceFilter.frequency.value = 1000; // Centro de frecuencia de voz
      voiceFilter.Q.value = 0.5; // Q bajo = menos procesamiento

      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;
      analyserRef.current = analyser;
      noiseGateRef.current = noiseGate;

      // Configurar ganancia (volumen)
      gainNode.gain.value = volume * 0.8; // Volumen seguro

      // CONFIGURACIÓN DINÁMICA SEGÚN MODO DE LATENCIA
      if (ultraLowLatency) {
        // ⚡ MODO ULTRA-RÁPIDO: MÍNIMO PROCESAMIENTO
        source.connect(noiseGate);
        noiseGate.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        // Analizador en paralelo (no afecta latencia)
        source.connect(analyser);
      } else {
        // 🎛️ MODO CALIDAD: CON FILTROS
        source.connect(analyser);
        analyser.connect(voiceFilter);
        voiceFilter.connect(noiseGate);
        noiseGate.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
      }

      // 🎯 INICIAR MONITOREO DE VOZ
      startVoiceMonitoring();

      setIsRecording(true);
      setIsConnected(true);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);

      let errorMessage = "";
      if (err.name === "NotAllowedError") {
        errorMessage =
          "Permisos de micrófono denegados. Ve a Configuración para activarlos.";
        setShowPermissionHelp(true);
      } else if (err.name === "NotFoundError") {
        errorMessage = "No se encontró micrófono en tu dispositivo.";
      } else if (err.name === "NotSupportedError") {
        errorMessage = "Tu navegador no soporta esta función.";
      } else {
        errorMessage = "Error al acceder al micrófono. Revisa los permisos.";
        setShowPermissionHelp(true);
      }

      setError(errorMessage);
      setIsConnected(false);
    }
  };

  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    setIsRecording(false);
    setIsConnected(false);
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
      // Aplicar volumen con factor de seguridad para evitar feedback
      const safeVolume = newVolume * 0.8; // Máximo seguro: 160% en lugar de 200%
      gainNodeRef.current.gain.value = safeVolume;
    }
  };

  // 🎯 CONTROL DE SENSIBILIDAD - Qué tan cerca debe estar tu voz
  const handleSensitivityChange = (newSensitivity) => {
    setSensitivity(newSensitivity);
  };

  // Detectar navegador y sistema
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  // Estilos CSS inline
  const styles = {
    container: {
      minHeight: "100vh",
      background:
        "linear-gradient(135deg, #581c87 0%, #1e3a8a 50%, #312e81 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    },
    card: {
      background: "rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(16px)",
      borderRadius: "24px",
      padding: "24px",
      maxWidth: "448px",
      width: "100%",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
    },
    title: {
      textAlign: "center",
      marginBottom: "24px",
    },
    h1: {
      fontSize: "1.875rem",
      fontWeight: "bold",
      color: "white",
      marginBottom: "8px",
      margin: "0",
    },
    subtitle: {
      color: "rgba(255, 255, 255, 0.7)",
      margin: "0",
    },
    statusBadge: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginTop: "8px",
    },
    deviceInfo: {
      background: "rgba(255, 255, 255, 0.05)",
      borderRadius: "12px",
      padding: "12px",
      marginBottom: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(255, 255, 255, 0.8)",
      fontSize: "14px",
    },
    micIndicator: {
      display: "flex",
      justifyContent: "center",
      marginBottom: "24px",
      position: "relative",
    },
    micCircle: {
      width: "112px",
      height: "112px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.3s ease",
      background: isRecording
        ? "rgba(239, 68, 68, 0.2)"
        : "rgba(107, 114, 128, 0.2)",
      border: isRecording
        ? "4px solid rgb(239, 68, 68)"
        : "4px solid rgb(107, 114, 128)",
      animation: isRecording
        ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
        : "none",
    },
    statusText: {
      textAlign: "center",
      marginBottom: "16px",
      color: "white",
      fontSize: "18px",
      fontWeight: "500",
      margin: "0 0 16px 0",
    },
    buttonContainer: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      marginBottom: "16px",
    },
    button: {
      width: "100%",
      padding: "16px",
      borderRadius: "16px",
      fontWeight: "bold",
      fontSize: "18px",
      transition: "all 0.3s ease",
      border: "none",
      cursor: "pointer",
      touchAction: "manipulation",
    },
    primaryButton: {
      background: isRecording ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)",
      color: "white",
    },
    secondaryButton: {
      background: isMuted ? "rgb(234, 179, 8)" : "rgb(59, 130, 246)",
      color: "white",
      padding: "12px",
      fontSize: "16px",
      fontWeight: "500",
    },
    volumeContainer: {
      marginBottom: "16px",
    },
    volumeLabel: {
      display: "block",
      color: "white",
      fontSize: "14px",
      fontWeight: "500",
      marginBottom: "8px",
    },
    volumeSlider: {
      width: "100%",
      height: "12px",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: "6px",
      appearance: "none",
      outline: "none",
      cursor: "pointer",
    },
    volumeLabels: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "12px",
      color: "rgba(255, 255, 255, 0.6)",
      marginTop: "4px",
    },
    errorBox: {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      border: "1px solid rgb(239, 68, 68)",
      borderRadius: "16px",
      padding: "16px",
      marginBottom: "16px",
      display: "flex",
      alignItems: "flex-start",
    },
    helpBox: {
      backgroundColor: "rgba(245, 158, 11, 0.2)",
      border: "1px solid rgb(245, 158, 11)",
      borderRadius: "16px",
      padding: "16px",
      marginBottom: "16px",
    },
    helpTitle: {
      color: "rgb(253, 224, 71)",
      fontWeight: "bold",
      marginBottom: "8px",
      display: "flex",
      alignItems: "center",
      margin: "0 0 8px 0",
    },
    helpText: {
      color: "rgb(254, 243, 199)",
      fontSize: "14px",
      margin: "0 0 4px 0",
    },
    helpButton: {
      marginTop: "12px",
      backgroundColor: "rgb(245, 158, 11)",
      color: "white",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      fontSize: "14px",
      cursor: "pointer",
    },
    instructionsBox: {
      background: "rgba(255, 255, 255, 0.05)",
      borderRadius: "16px",
      padding: "16px",
      marginBottom: "16px",
    },
    instructionsTitle: {
      color: "white",
      fontWeight: "500",
      marginBottom: "8px",
      margin: "0 0 8px 0",
    },
    instructionsList: {
      color: "rgba(255, 255, 255, 0.8)",
      fontSize: "14px",
      margin: "0",
      paddingLeft: "0",
      listStyle: "none",
    },
    instructionsItem: {
      marginBottom: "4px",
    },
    helpToggleButton: {
      width: "100%",
      background: "rgba(255, 255, 255, 0.1)",
      color: "white",
      padding: "8px",
      borderRadius: "12px",
      fontSize: "14px",
      transition: "all 0.3s ease",
      border: "none",
      cursor: "pointer",
    },
    footer: {
      textAlign: "center",
      marginTop: "16px",
      color: "rgba(255, 255, 255, 0.5)",
      fontSize: "12px",
    },
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <div style={styles.card}>
        {/* Título */}
        <div style={styles.title}>
          <h1 style={styles.h1}>🎤 Karaoke Mic</h1>
          <p style={styles.subtitle}>Micrófono en tiempo real</p>
          <div style={styles.statusBadge}>
            {isConnected ? (
              <>
                <span style={{ fontSize: "20px", marginRight: "4px" }}>📶</span>
                <span style={{ color: "rgb(74, 222, 128)", fontSize: "14px" }}>
                  Conectado {ultraLowLatency ? "⚡ Ultra-rápido" : "🎛️ Calidad"}
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: "20px", marginRight: "4px" }}>📵</span>
                <span style={{ color: "rgb(156, 163, 175)", fontSize: "14px" }}>
                  Desconectado
                </span>
              </>
            )}
            {isRecording && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                Latencia estimada: {ultraLowLatency ? "~50ms" : "~150ms"}
              </div>
            )}
          </div>
        </div>

        {/* Indicador de navegador */}
        <div style={styles.deviceInfo}>
          <span style={{ fontSize: "16px", marginRight: "8px" }}>📱</span>
          {isIOS && "iPhone/iPad detectado"}
          {isAndroid && "Android detectado"}
          {!isIOS && !isAndroid && "Escritorio detectado"}
        </div>

        {/* Ayuda de permisos */}
        {showPermissionHelp && (
          <div style={styles.helpBox}>
            <h3 style={styles.helpTitle}>
              <span style={{ marginRight: "8px" }}>⚙️</span>
              CÓMO DAR PERMISOS:
            </h3>

            {isIOS && (
              <div>
                <p style={styles.helpText}>
                  <strong>En iPhone/iPad:</strong>
                </p>
                <p style={styles.helpText}>1. Ve a Configuración → Safari</p>
                <p style={styles.helpText}>2. Busca "Micrófono"</p>
                <p style={styles.helpText}>3. Activa "Permitir sitios web"</p>
                <p style={styles.helpText}>4. Regresa y recarga la página</p>
              </div>
            )}

            {isAndroid && (
              <div>
                <p style={styles.helpText}>
                  <strong>En Android:</strong>
                </p>
                <p style={styles.helpText}>
                  1. Toca el ícono 🔒 en la barra de dirección
                </p>
                <p style={styles.helpText}>2. Toca "Permisos"</p>
                <p style={styles.helpText}>3. Activa "Micrófono"</p>
                <p style={styles.helpText}>4. Recarga la página</p>
              </div>
            )}

            <button
              onClick={() => setShowPermissionHelp(false)}
              style={styles.helpButton}
            >
              Entendido
            </button>
          </div>
        )}

        {/* Indicador visual CON MEDIDOR DE VOZ */}
        <div style={styles.micIndicator}>
          <div
            style={{
              ...styles.micCircle,
              background: isVoiceDetected
                ? "rgba(34, 197, 94, 0.3)"
                : isRecording
                ? "rgba(239, 68, 68, 0.2)"
                : "rgba(107, 114, 128, 0.2)",
              border: isVoiceDetected
                ? "4px solid rgb(34, 197, 94)"
                : isRecording
                ? "4px solid rgb(239, 68, 68)"
                : "4px solid rgb(107, 114, 128)",
              animation: isVoiceDetected
                ? "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                : isRecording
                ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                : "none",
            }}
          >
            <span style={{ fontSize: "48px" }}>
              {isVoiceDetected ? "🎙️" : isRecording ? "👂" : "🔇"}
            </span>
          </div>

          {/* MEDIDOR DE NIVEL DE VOZ EN TIEMPO REAL */}
          {isRecording && (
            <div
              style={{
                position: "absolute",
                bottom: "-10px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: "4px",
                    height: "12px",
                    backgroundColor:
                      i < voiceLevel * 10
                        ? isVoiceDetected
                          ? "rgb(34, 197, 94)"
                          : "rgb(239, 68, 68)"
                        : "rgba(255, 255, 255, 0.2)",
                    borderRadius: "2px",
                    transition: "background-color 0.1s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Estado CON DETECCIÓN DE VOZ */}
        <div>
          <p style={styles.statusText}>
            {!isRecording
              ? "⚪ LISTO PARA INICIAR"
              : isVoiceDetected
              ? "🟢 DETECTANDO TU VOZ"
              : "🟡 ESPERANDO VOZ CERCANA"}
          </p>
          {isRecording && (
            <p
              style={{
                ...styles.statusText,
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.7)",
                marginTop: "-8px",
              }}
            >
              {isVoiceDetected
                ? "¡Perfecto! Solo tu voz se escucha"
                : "Acércate más o habla más fuerte"}
            </p>
          )}
        </div>

        {/* Controles principales */}
        <div style={styles.buttonContainer}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{ ...styles.button, ...styles.primaryButton }}
          >
            {isRecording ? "⏹️ DETENER" : "▶️ ACTIVAR MICRÓFONO"}
          </button>

          {isRecording && (
            <button
              onClick={toggleMute}
              style={{ ...styles.button, ...styles.secondaryButton }}
            >
              {isMuted ? (
                <>
                  <span style={{ marginRight: "8px" }}>🔊</span>
                  ACTIVAR SONIDO
                </>
              ) : (
                <>
                  <span style={{ marginRight: "8px" }}>🔇</span>
                  SILENCIAR
                </>
              )}
            </button>
          )}
        </div>

        {/* Control de SENSIBILIDAD DE PROXIMIDAD */}
        {isRecording && (
          <div style={styles.volumeContainer}>
            <label style={styles.volumeLabel}>
              🎯 Sensibilidad: {Math.round(sensitivity * 100)}%
              <span
                style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
              >
                (Qué tan cerca detecta tu voz)
              </span>
            </label>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={sensitivity}
              onChange={(e) =>
                handleSensitivityChange(parseFloat(e.target.value))
              }
              style={styles.volumeSlider}
            />
            <div style={styles.volumeLabels}>
              <span style={{ color: "rgb(239, 68, 68)" }}>Muy cerca</span>
              <span style={{ color: "rgb(74, 222, 128)" }}>Óptimo</span>
              <span style={{ color: "rgb(239, 68, 68)" }}>Muy lejos</span>
            </div>
          </div>
        )}

        {/* Control de volumen MEJORADO */}
        {isRecording && (
          <div style={styles.volumeContainer}>
            <label style={styles.volumeLabel}>
              🔊 Volumen: {Math.round(volume * 100)}%
              <span
                style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
              >
                (Máx. seguro: 160%)
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              style={styles.volumeSlider}
            />
            <div style={styles.volumeLabels}>
              <span>Silencio</span>
              <span style={{ color: "rgb(74, 222, 128)" }}>Óptimo</span>
              <span style={{ color: "rgb(239, 68, 68)" }}>¡Cuidado!</span>
            </div>

            {/* Botón de emergencia */}
            <button
              onClick={toggleMute}
              style={{
                width: "100%",
                marginTop: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.8)",
                color: "white",
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🚨 BOTÓN DE EMERGENCIA (Si hay eco)
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <span
              style={{
                fontSize: "20px",
                marginRight: "8px",
                marginTop: "2px",
              }}
            >
              ⚠️
            </span>
            <div>
              <p
                style={{
                  color: "rgb(252, 165, 165)",
                  fontSize: "14px",
                  fontWeight: "500",
                  margin: "0 0 4px 0",
                }}
              >
                Error:
              </p>
              <p
                style={{
                  color: "rgb(252, 165, 165)",
                  fontSize: "14px",
                  margin: "0",
                }}
              >
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Instrucciones anti-feedback */}
        <div style={styles.instructionsBox}>
          <h3 style={styles.instructionsTitle}>🚀 Pasos rápidos:</h3>
          <ol style={styles.instructionsList}>
            <li style={styles.instructionsItem}>
              1. Conecta Bluetooth al altavoz
            </li>
            <li style={styles.instructionsItem}>
              2. Presiona "ACTIVAR MICRÓFONO"
            </li>
            <li style={styles.instructionsItem}>
              3. Permite permisos cuando aparezca
            </li>
            <li style={styles.instructionsItem}>4. ¡Canta! 🎵</li>
          </ol>
        </div>

        {/* MODO DE LATENCIA */}
        <div
          style={{
            ...styles.instructionsBox,
            backgroundColor: ultraLowLatency
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(59, 130, 246, 0.1)",
            border: ultraLowLatency
              ? "1px solid rgba(34, 197, 94, 0.3)"
              : "1px solid rgba(59, 130, 246, 0.3)",
          }}
        >
          <h3
            style={{
              ...styles.instructionsTitle,
              color: ultraLowLatency
                ? "rgb(74, 222, 128)"
                : "rgb(96, 165, 250)",
            }}
          >
            ⚡ Modo actual: {ultraLowLatency ? "ULTRA RÁPIDO" : "CALIDAD ALTA"}
          </h3>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "14px",
              margin: "0 0 12px 0",
            }}
          >
            {ultraLowLatency
              ? "Latencia mínima (~50ms) • Menos filtros"
              : "Latencia normal (~200ms) • Mejor calidad"}
          </p>
          <button
            onClick={() => {
              setUltraLowLatency(!ultraLowLatency);
              if (isRecording) {
                alert("🔄 Reinicia el micrófono para aplicar el cambio");
              }
            }}
            style={{
              backgroundColor: ultraLowLatency
                ? "rgb(59, 130, 246)"
                : "rgb(34, 197, 94)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
            }}
          >
            {ultraLowLatency
              ? "🎛️ CAMBIAR A MODO CALIDAD"
              : "⚡ CAMBIAR A MODO RÁPIDO"}
          </button>
        </div>

        {/* Botón de ayuda */}
        <button
          onClick={() => setShowPermissionHelp(true)}
          style={styles.helpToggleButton}
        >
          ❓ ¿Problemas con permisos?
        </button>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={{ margin: "0" }}>
            🎤 Karaoke Mic v1.0 - ¡Canta sin límites!
          </p>
        </div>
      </div>
    </div>
  );
};

export default MicrofonoKaraoke;
