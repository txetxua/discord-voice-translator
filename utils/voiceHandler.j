// utils/voiceHandler.js
const fs = require('fs');
const path = require('path');
const {
    joinVoiceChannel,
    getVoiceConnection,
    EndBehaviorType,
    StreamType
} = require('@discordjs/voice');
const prism = require('prism-media');
const speech = require('@google-cloud/speech');
const { autoTranslate } = require('./translate');

const speechClient = new speech.SpeechClient({ keyFilename: path.join(__dirname, '..', 'key.json') });

// Mantén estas frases si crees que son útiles, si no, puedes eliminarlas o comentar 'speechContexts' abajo.
const commonPhrasesEs = ["Fortnite", "Valorant", "Minecraft", "objetivo A", "objetivo B", "buena partida"];
const commonPhrasesIt = ["Fortnite", "Valorant", "Minecraft", "obiettivo A", "obiettivo B", "bella partita"];

async function startListening(guild, voiceChannel, textChannel, config, client) {
    if (config.connection && config.recognizeStream) {
        console.log(`[INFO VOICE_HANDLER] Ya hay una transcripción activa para ${guild.name}`);
        return;
    }
    console.log(`[DEBUG VOICE_HANDLER] Iniciando escucha en ${guild.name} - Voz: ${voiceChannel.name}, Texto: ${textChannel.name}`);

  try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
      });
      config.connection = connection;

      console.log(`[INFO VOICE_HANDLER] AudioPlayer con silence.ogg está deshabilitado.`);
      console.log(`[INFO VOICE_HANDLER] Conectado a ${voiceChannel.name}`);
      if (textChannel && typeof textChannel.send === 'function') {
        textChannel.send(`🎤 ¡Hola! Empezaré a escuchar en **${voiceChannel.name}** y a traducir aquí.`);
      }

      connection.receiver.speaking.on('start', (userId) => {
        console.log(`[INFO VOICE_HANDLER] Usuario ${userId} empezó a hablar en ${guild.name}.`);

        if (config.recognizeStream) {
            console.log("[DEBUG VOICE_HANDLER] Finalizando stream de reconocimiento anterior.");
            try { config.recognizeStream.destroy(); } catch (e) { console.error("[ERROR VOICE_HANDLER] Destruyendo stream anterior:", e); }
            config.recognizeStream = null;
        }

        const audioStream = connection.receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000, // <--- PRUEBA 1: Volver a 1000ms (1 segundo)
          },
        });
        const pcmStream = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });

        const recognizeStream = speechClient
          .streamingRecognize({
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 48000,
              languageCode: 'es-ES',
              alternativeLanguageCodes: ['it-IT', 'en-US'],

              // --- CONFIGURACIÓN DE PRUEBA ---
              // model: 'telephony', // PRUEBA 2: Intenta con 'telephony' o comenta la línea 'model' para usar el default. 'latest_long' puede ser muy pesado.
              model: 'latest_long', // Mantenlo si 'telephony' no mejora o empeora.
              enableAutomaticPunctuation: true,
              profanityFilter: false,
              useEnhanced: false, // <--- PRUEBA 3: Desactivar 'useEnhanced' primero. Es un gran sospechoso.

              // speechContexts: [{ // PRUEBA 4: Mantén esto comentado a menos que estés seguro de que ayuda.
              //   phrases: [...commonPhrasesEs, ...commonPhrasesIt],
              //   boost: 5 // Reduce el boost si lo usas
              // }],
              // --- FIN CONFIGURACIÓN DE PRUEBA ---
            },
            interimResults: false,
          })
          .on('error', (error) => { /* ... manejo de error ... */
              console.error(`[ERROR SPEECH_CLIENT] Error en recognizeStream para ${guild.id}, usuario ${userId}:`, error.message);
               if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
               try { recognizeStream.destroy(); } catch(e) {console.error("Error destruyendo recognizeStream tras error:", e)}
          })
          .on('data', async (data) => { /* ... manejo de datos ... */
            const result = data.results[0];
            if (result && result.alternatives[0] && result.alternatives[0].transcript) {
              const text = result.alternatives[0].transcript;
              let detectedLang = result.languageCode || 'es-ES';
              if (text.match(/\b(ciao|grazie|prego|allora|cosa|bene|male|quando|perché)\b/i) && !text.match(/\b(hola|gracias|por favor|entonces|qué|bien|mal|cuándo|por qué)\b/i)) {
                  detectedLang = 'it-IT';
              } else if (text.match(/\b(hello|thank you|please|so|what|good|bad|when|why)\b/i) && !text.match(/\b(hola|gracias|por favor|entonces|qué|bien|mal|cuándo|por qué)\b/i)) {
                  detectedLang = 'en-US';
              }
              const langForTranslate = detectedLang.split('-')[0];

              const user = await client.users.fetch(userId).catch(() => null);
              const userName = user ? user.username : `Usuario ${userId.substring(0,5)}...`;
              if (text) {
                console.log(`[TRANSCRIPCIÓN] ${userName} (Detectado: ${detectedLang}, Usado para traducir: ${langForTranslate}): ${text}`);
                try {
                  const translated = await autoTranslate(text, langForTranslate);
                  const targetFlag = langForTranslate === 'es' ? '🇮🇹' : (langForTranslate === 'it' ? '🇪🇸' : '❓');
                  const targetLangName = langForTranslate === 'es' ? 'Italiano' : (langForTranslate === 'it' ? 'Español' : 'Desconocido');
                  if (textChannel && typeof textChannel.send === 'function') {
                    textChannel.send(`**${userName} (${targetFlag} ${targetLangName}):** ${translated}`);
                  }
                } catch (translateError) {
                  console.error("[ERROR TRADUCCIÓN]:", translateError);
                  if (textChannel && typeof textChannel.send === 'function') {
                    textChannel.send(`*Error traduciendo el mensaje de ${userName}*`);
                  }
                }
              }
            } else if (data.results[0] && data.results[0].isFinal && !data.results[0].alternatives[0]?.transcript) {
                console.log(`[DEBUG SPEECH_CLIENT] Resultado final sin transcripción para ${userId}.`);
            }
          })
          .on('end', () => { /* ... manejo de fin de stream ... */
              console.log(`[INFO SPEECH_CLIENT] Stream de reconocimiento para ${userId} en ${guild.name} ha terminado.`);
              if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
          });

        config.recognizeStream = recognizeStream;
        audioStream.pipe(pcmStream).pipe(recognizeStream);
        // ... (manejo de eventos de audioStream igual)
        audioStream.on('end', () => {
            console.log(`[DEBUG VOICE_HANDLER] AudioStream para ${userId} en ${guild.name} terminado.`);
             try {
                 if (pcmStream && !pcmStream.destroyed) pcmStream.destroy();
                 if (recognizeStream && config.recognizeStream === recognizeStream && !recognizeStream.destroyed) {
                     recognizeStream.end();
                 }
             } catch(e) { console.error("[ERROR VOICE_HANDLER] Error limpiando streams de audio en audioStream end:", e)}
        });
         audioStream.on('error', (err) => {
             console.error(`[ERROR VOICE_HANDLER] Error en AudioStream para ${userId} en ${guild.name}:`, err);
             try {
                 if (pcmStream && !pcmStream.destroyed) pcmStream.destroy();
                 if (recognizeStream && config.recognizeStream === recognizeStream && !recognizeStream.destroyed) {
                     recognizeStream.destroy();
                 }
                 if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
             } catch(e) { console.error("[ERROR VOICE_HANDLER] Error limpiando streams de audio tras error en audioStream:", e)}
         });
      });
    // ... (resto del código de startListening, manejo de stateChange y error de connection)
      connection.on('stateChange', (oldState, newState) => {
        console.log(`[INFO VOICE_HANDLER] Estado de conexión de voz para ${guild.id} cambiado de ${oldState.status} a ${newState.status}`);
        if (newState.status === 'disconnected' || newState.status === 'destroyed') {
          console.log(`[INFO VOICE_HANDLER] Desconectado o destruido en ${voiceChannel.name}. Limpiando recursos.`);
          if(newState.status === 'disconnected' && textChannel && typeof textChannel.send === 'function') {
            textChannel.send(`🔌 Desconectado del canal de voz ${voiceChannel.name}.`);
          }
          stopListening(guild.id, config);
        }
      });
       connection.on('error', error => {
           console.error(`[ERROR VOICE_HANDLER] Error en la conexión de voz para ${guild.id}:`, error);
           if (textChannel && typeof textChannel.send === 'function') {
            textChannel.send(`❌ Error en la conexión de voz. Intentando detener...`);
           }
           stopListening(guild.id, config);
       });

  } catch (error) {
      console.error(`[FATAL VOICE_HANDLER] Fallo al iniciar escucha para ${guild.name}:`, error);
      if (textChannel && typeof textChannel.send === 'function') {
        textChannel.send('❌ Hubo un problema grave al intentar iniciar la escucha.');
      }
      stopListening(guild.id, config);
  }
}

// ... (función stopListening igual que antes, sin el player)
function stopListening(guildId, config) {
     console.log(`[INFO VOICE_HANDLER] Intentando detener escucha para Guild ${guildId}`);
     let stopped = false;

    if (config.recognizeStream) {
        try {
            config.recognizeStream.end();
            setTimeout(() => {
                if (config.recognizeStream && !config.recognizeStream.destroyed) {
                    config.recognizeStream.destroy();
                    console.log(`[INFO SPEECH_CLIENT] RecognizeStream destruido para ${guildId}`);
                }
            }, 100);
            stopped = true;
        } catch (e) { console.error(`[ERROR VOICE_HANDLER] Error deteniendo recognizeStream para ${guildId}:`, e); }
        config.recognizeStream = null;
    }

    if (config.connection) {
        try {
            if (config.connection.state.status !== 'destroyed') {
                 config.connection.destroy();
                 console.log(`[INFO VOICE_HANDLER] Conexión de voz destruida para ${guildId}`);
                 stopped = true;
            }
        } catch (e) { console.error(`[ERROR VOICE_HANDLER] Error destruyendo conexión de voz para ${guildId}:`, e); }
        config.connection = null;
    }
    return stopped;
}


module.exports = {
  startListening,
  stopListening,
};
