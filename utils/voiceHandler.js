// utils/voiceHandler.js
const fs = require('fs'); // Aunque ya no usamos silence.ogg, podría ser útil para otros logs si es necesario.
const path = require('path');
const {
    joinVoiceChannel,
    getVoiceConnection,
    EndBehaviorType,
    // Las siguientes ya no son necesarias si no usamos el AudioPlayer para silence.ogg
    // createAudioPlayer,
    // createAudioResource,
    // NoSubscriberBehavior,
    // AudioPlayerStatus,
    // StreamType
} = require('@discordjs/voice');
const prism = require('prism-media');
const speech = require('@google-cloud/speech');
const { autoTranslate } = require('./translate'); // Asegúrate que la ruta a translate.js es correcta

const speechClient = new speech.SpeechClient({ keyFilename: path.join(__dirname, '..', 'key.json') });

async function startListening(guild, voiceChannel, textChannel, config, client) {
    if (config.connection && config.recognizeStream) {
        console.log(`[INFO VOICE_HANDLER] Ya hay una transcripción activa para ${guild.name}. Evitando nuevo inicio.`);
        // Considera enviar un mensaje efímero al usuario que intentó iniciar si ya está activo
        // Ejemplo: interaction.followUp({ content: 'Ya estoy escuchando.', ephemeral: true }); (si tienes 'interaction')
        return; // Importante para no crear múltiples listeners
    }
    console.log(`[DEBUG VOICE_HANDLER] Iniciando escucha en Guild: ${guild.name} (ID: ${guild.id}) - Voz: ${voiceChannel.name} (ID: ${voiceChannel.id}), Texto: ${textChannel.name} (ID: ${textChannel.id})`);

  try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false, // El bot necesita escuchar para transcribir
        selfMute: true   // El bot no necesita hablar (a menos que tenga otra función)
      });
      config.connection = connection;

      // --- Sección del AudioPlayer y silence.ogg completamente eliminada ---
      console.log(`[INFO VOICE_HANDLER] El AudioPlayer con silence.ogg está deshabilitado en esta versión.`);
      // --- Fin Sección Eliminada ---

      console.log(`[INFO VOICE_HANDLER] Conectado a ${voiceChannel.name}`);
      if (textChannel && typeof textChannel.send === 'function') {
        // Mensaje público al canal de texto
        textChannel.send(`🎤 ¡Hola! Empezaré a escuchar en **${voiceChannel.name}** y a traducir aquí.`).catch(e => console.error("[ERROR VOICE_HANDLER] No se pudo enviar mensaje de inicio a textChannel:", e));
      }


      connection.receiver.speaking.on('start', (userId) => {
        console.log(`[INFO VOICE_HANDLER] Usuario ${userId} empezó a hablar en ${guild.name}.`);

        // Si ya hay un stream de reconocimiento para este guild (quizás de un usuario anterior o un error), ciérralo.
        if (config.recognizeStream) {
            console.log("[DEBUG VOICE_HANDLER] Finalizando stream de reconocimiento anterior antes de crear uno nuevo.");
            try {
                config.recognizeStream.destroy();
            } catch (e) {
                console.error("[ERROR VOICE_HANDLER] Error al destruir stream de reconocimiento anterior:", e);
            }
            config.recognizeStream = null;
        }

        const audioStream = connection.receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1200, // Un poco más de 1 segundo, puedes ajustar entre 1000-1500
          },
        });

        const pcmStream = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });

        const recognizeStreamConfig = {
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 48000,
              languageCode: 'es-ES',
              alternativeLanguageCodes: ['it-IT'],
              enableAutomaticPunctuation: true,
              // model: 'telephony', // Comentado: Usar default de Google. Puedes probar 'telephony' o 'latest_long' después.
              // useEnhanced: false, // Comentado: Default es false.
            },
            interimResults: false,
        };
        console.log("[DEBUG VOICE_HANDLER] Configuración de recognizeStream:", JSON.stringify(recognizeStreamConfig.config)); // ESTE ES EL LOG QUE ENVIASTE

        const recognizeStream = speechClient.streamingRecognize(recognizeStreamConfig)
          .on('error', (error) => {
              console.error(`[ERROR SPEECH_CLIENT] Error en recognizeStream para ${guild.id}, usuario ${userId}:`, error); // Log completo del error
               if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
               try { if (!recognizeStream.destroyed) recognizeStream.destroy(); } catch(e) {console.error("Error destruyendo recognizeStream tras error:", e)}
          })
          .on('data', async (data) => {
            console.log(`[DATA SPEECH_CLIENT] Recibido dato de Google para ${userId}:`, JSON.stringify(data)); // LOG IMPORTANTE para ver qué devuelve Google
            const result = data.results[0];
            if (result && result.alternatives[0] && result.alternatives[0].transcript) {
              const text = result.alternatives[0].transcript;
              let detectedLang = result.languageCode || 'es-ES';
              if (!result.languageCode) {
                if (text.match(/\b(ciao|grazie|prego|allora|cosa|bene|male|quando|perché)\b/i) && !text.match(/\b(hola|gracias|por favor|entonces|qué|bien|mal|cuándo|por qué)\b/i)) {
                    detectedLang = 'it-IT';
                }
              }
              const langForTranslate = detectedLang.split('-')[0];

              const user = await client.users.fetch(userId).catch(() => null);
              const userName = user ? user.username : `Usuario ${userId.substring(0,5)}...`;

              if (text) {
                console.log(`[TRANSCRIPCIÓN] ${userName} (Detectado: ${detectedLang}, Usado: ${langForTranslate}): ${text}`);
                try {
                  const translated = await autoTranslate(text, langForTranslate);
                  const targetFlag = langForTranslate === 'es' ? '🇮🇹' : (langForTranslate === 'it' ? '🇪🇸' : '❓');
                  const targetLangName = langForTranslate === 'es' ? 'Italiano' : (langForTranslate === 'it' ? 'Español' : 'Trad.');

                  if (textChannel && typeof textChannel.send === 'function') {
                    textChannel.send(`**${userName} (${targetFlag} ${targetLangName}):** ${translated}`).catch(e => console.error("[ERROR VOICE_HANDLER] No se pudo enviar traducción a textChannel:", e));
                  }
                } catch (translateError) {
                  console.error("[ERROR TRADUCCIÓN]:", translateError);
                  if (textChannel && typeof textChannel.send === 'function') {
                    textChannel.send(`*Error traduciendo el mensaje de ${userName}*`).catch(e => console.error("[ERROR VOICE_HANDLER] No se pudo enviar mensaje de error de traducción:", e));
                  }
                }
              }
            } else if (data.results[0] && data.results[0].isFinal && !data.results[0].alternatives[0]?.transcript) {
                console.log(`[DEBUG SPEECH_CLIENT] Resultado final de Google sin transcripción para ${userId}. Audio podría ser muy corto o ininteligible.`);
            } else if (!data.results || data.results.length === 0) {
                console.log(`[DEBUG SPEECH_CLIENT] Recibido dato de Google sin 'results' para ${userId}.`);
            }
          })
          .on('end', () => {
              console.log(`[INFO SPEECH_CLIENT] Stream de reconocimiento para ${userId} en ${guild.name} ha terminado.`);
              if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
          });

        config.recognizeStream = recognizeStream;
        console.log(`[DEBUG VOICE_HANDLER] Estableciendo tubería (pipe): audioStream -> pcmStream -> recognizeStream para ${userId}`);
        audioStream.pipe(pcmStream).pipe(recognizeStream)
            .on('error', (err) => console.error('[ERROR VOICE_HANDLER] Error en la tubería final (recognizeStream):', err));
        
        pcmStream.on('error', (err) => console.error('[ERROR VOICE_HANDLER] Error en PCM Stream:', err));
        audioStream.on('error', (err) => { // Este listener de error en audioStream es importante
             console.error(`[ERROR VOICE_HANDLER] Error en AudioStream (entrada de Discord) para ${userId} en ${guild.name}:`, err);
             try {
                 if (pcmStream && !pcmStream.destroyed) pcmStream.destroy();
                 if (recognizeStream && config.recognizeStream === recognizeStream && !recognizeStream.destroyed) {
                     recognizeStream.destroy();
                 }
                 if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
             } catch(e) { console.error("[ERROR VOICE_HANDLER] Error limpiando streams tras error en audioStream:", e)}
        });


        audioStream.on('end', () => {
            console.log(`[DEBUG VOICE_HANDLER] AudioStream (entrada de Discord) para ${userId} en ${guild.name} terminado (evento 'end').`);
             try {
                 if (pcmStream && !pcmStream.destroyed) {
                    console.log(`[DEBUG VOICE_HANDLER] Destruyendo pcmStream para ${userId} porque audioStream terminó.`);
                    pcmStream.destroy();
                 }
                 // No cerramos recognizeStream.end() aquí directamente para darle tiempo a Google.
                 // Se espera que Google envíe su propio evento 'end' cuando el pcmStream (su entrada) termine.
             } catch(e) { console.error("[ERROR VOICE_HANDLER] Error limpiando pcmStream en audioStream end:", e)}
        });

      });

      connection.on('stateChange', (oldState, newState) => {
        console.log(`[INFO VOICE_HANDLER] Estado de conexión de voz para ${guild.id} cambiado de ${oldState.status} a ${newState.status}`);
        if (newState.status === 'disconnected' || newState.status === 'destroyed') {
          console.log(`[INFO VOICE_HANDLER] Desconectado o destruido en ${voiceChannel.name}. Limpiando todos los recursos.`);
          if(newState.status === 'disconnected' && textChannel && typeof textChannel.send === 'function') {
            textChannel.send(`🔌 Desconectado del canal de voz ${voiceChannel.name}.`).catch(e => console.error("[ERROR VOICE_HANDLER] No se pudo enviar mensaje de desconexión:", e));
          }
          stopListening(guild.id, config);
        }
      });
       connection.on('error', error => {
           console.error(`[ERROR VOICE_HANDLER] Error en la conexión de voz para ${guild.id}:`, error);
           if (textChannel && typeof textChannel.send === 'function') {
            textChannel.send(`❌ Error en la conexión de voz. Intentando detener...`).catch(e => console.error("[ERROR VOICE_HANDLER] No se pudo enviar mensaje de error de conexión:", e));
           }
           stopListening(guild.id, config);
       });

  } catch (error) {
      console.error(`[FATAL VOICE_HANDLER] Fallo al iniciar escucha para ${guild.name}:`, error);
      if (textChannel && typeof textChannel.send === 'function') {
        textChannel.send('❌ Hubo un problema grave al intentar iniciar la escucha.').catch(e => console.error("[ERROR VOICE_HANDLER] No se pudo enviar mensaje de error fatal:", e));
      }
      stopListening(guild.id, config);
  }
}

function stopListening(guildId, config) {
     console.log(`[INFO VOICE_HANDLER] Intentando detener escucha y limpiar recursos para Guild ${guildId}`);
     let stopped = false;

    if (config.recognizeStream) {
        console.log(`[DEBUG VOICE_HANDLER] Deteniendo recognizeStream para ${guildId}.`);
        try {
            if (!config.recognizeStream.destroyed) {
                config.recognizeStream.end();
                setTimeout(() => {
                    if (config.recognizeStream && !config.recognizeStream.destroyed) {
                        config.recognizeStream.destroy();
                        console.log(`[INFO SPEECH_CLIENT] RecognizeStream destruido (después de end) para ${guildId}`);
                    }
                }, 250);
            }
            stopped = true;
        } catch (e) { console.error(`[ERROR VOICE_HANDLER] Error deteniendo recognizeStream para ${guildId}:`, e); }
        config.recognizeStream = null;
    }

    if (config.connection) {
        console.log(`[DEBUG VOICE_HANDLER] Destruyendo conexión de voz para ${guildId}.`);
        try {
            if (config.connection.state.status !== 'destroyed') {
                 config.connection.destroy();
                 console.log(`[INFO VOICE_HANDLER] Conexión de voz destruida para ${guildId}`);
                 stopped = true;
            }
        } catch (e) { console.error(`[ERROR VOICE_HANDLER] Error destruyendo conexión de voz para ${guildId}:`, e); }
        config.connection = null;
    }
    console.log(`[INFO VOICE_HANDLER] Proceso de detener para ${guildId} completado. Algo detenido: ${stopped}`);
    return stopped;
}

module.exports = {
  startListening,
  stopListening,
};
