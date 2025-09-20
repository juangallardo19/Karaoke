import React, { useState, useRef, useEffect } from "react";

const MicrofonoKaraoke = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState("");
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

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
      setError("");
      setShowPermissionHelp(false);
      setIsConnected(false);

      // Crear contexto de audio
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Reanudar contexto si está suspendido (necesario en algunos móviles)
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Solicitar acceso al micrófono con configuración ANTI-FEEDBACK
      const constraints = {
        audio: {
          echoCancellation: true, // ✅ CANCELA EL ECO/FEEDBACK
          noiseSuppression: true, // ✅ FILTRA RUIDOS DE FONDO
          autoGainControl: true, // ✅ CONTROLA VOLUMEN AUTOMÁTICO
          latency: 0,
          sampleRate: 44100,
          channelCount: 1, // ✅ MONO = MEJOR PARA VOZ
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Crear nodos de audio con FILTROS ANTI-FEEDBACK
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gainNode = audioContextRef.current.createGain();

      // 🎛️ FILTRO PASO ALTO - Elimina bass y frecuencias bajas
      const highpassFilter = audioContextRef.current.createBiquadFilter();
      highpassFilter.type = "highpass";
      highpassFilter.frequency.value = 80; // Corta frecuencias por debajo de 80Hz

      // 🎛️ FILTRO PASO BAJO - Elimina frecuencias muy altas
      const lowpassFilter = audioContextRef.current.createBiquadFilter();
      lowpassFilter.type = "lowpass";
      lowpassFilter.frequency.value = 8000; // Corta frecuencias por encima de 8kHz

      // 🎛️ COMPRESOR - Evita picos de volumen
      const compressor = audioContextRef.current.createDynamicsCompressor();
      compressor.threshold.value = -24; // Umbral de compresión
      compressor.knee.value = 30; // Suavidad
      compressor.ratio.value = 12; // Ratio de compresión
      compressor.attack.value = 0.003; // Ataque rápido
      compressor.release.value = 0.25; // Liberación suave

      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;

      // Configurar ganancia (volumen)
      gainNode.gain.value = volume * 0.7; // Reducir volumen inicial para evitar feedback

      // 🔗 CADENA DE AUDIO: micrófono -> filtros -> compresor -> ganancia -> altavoces
      source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

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
      const safeVolume = newVolume * 0.7; // Máximo seguro: 140% en lugar de 200%
      gainNodeRef.current.gain.value = safeVolume;
    }
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
                  Conectado
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

        {/* Indicador visual */}
        <div style={styles.micIndicator}>
          <div style={styles.micCircle}>
            <span style={{ fontSize: "48px" }}>
              {isRecording ? "🎙️" : "🔇"}
            </span>
          </div>
        </div>

        {/* Estado */}
        <div>
          <p style={styles.statusText}>
            {isRecording ? "🔴 TRANSMITIENDO" : "⚪ LISTO PARA INICIAR"}
          </p>
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

        {/* Control de volumen MEJORADO */}
        {isRecording && (
          <div style={styles.volumeContainer}>
            <label style={styles.volumeLabel}>
              🔊 Volumen: {Math.round(volume * 100)}%
              <span
                style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
              >
                (Máx. seguro: 140%)
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

        {/* Consejos anti-feedback */}
        <div
          style={{
            ...styles.instructionsBox,
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        >
          <h3
            style={{ ...styles.instructionsTitle, color: "rgb(74, 222, 128)" }}
          >
            🛡️ Evitar eco/feedback:
          </h3>
          <ol style={styles.instructionsList}>
            <li style={styles.instructionsItem}>
              • Mantén distancia entre celular y altavoz
            </li>
            <li style={styles.instructionsItem}>
              • Empieza con volumen bajo y ve subiendo
            </li>
            <li style={styles.instructionsItem}>
              • Apunta el celular LEJOS del altavoz
            </li>
            <li style={styles.instructionsItem}>
              • Si suena eco, baja el volumen
            </li>
          </ol>
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
