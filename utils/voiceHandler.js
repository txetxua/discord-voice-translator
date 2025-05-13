// utils/voiceHandler.js
const path = require('path');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, StreamType } = require('@discordjs/voice'); // Asegúrate que StreamType está aquí
const prism = require('prism-media');
const speech = require('@google-cloud/speech');
const { autoTranslate } = require('./translate'); // Importa desde el otro archivo de utils

// Inicializa el cliente de Speech aquí o pásalo como parámetro si prefieres
const speechClient = new speech.SpeechClient({ keyFilename: path.join(__dirname, '..', 'key.json') }); // Ruta desde utils a la raíz

// --- Función para empezar a escuchar ---
async function startListening(guild, voiceChannel, textChannel, config, client) { // Añadido client como parámetro
    if (config.connection && config.recognizeStream) {
        console.log(`[INFO] Ya hay una transcripción activa para ${guild.name}`);
        // textChannel.send('⚠️ Ya estoy escuchando en este canal.'); // Opcional
        return;
    }
    console.log(`[DEBUG] Iniciando escucha en ${guild.name} - Voz: ${voiceChannel.name}, Texto: ${textChannel.name}`);

  try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
      });
      config.connection = connection;

      config.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play }});
      // Asegúrate que 'silence.ogg' existe en la raíz del proyecto (al lado de index.js)
      const silenceResourcePath = path.join(__dirname, '..', 'silence.ogg');
      try {
        const resource = createAudioResource(silenceResourcePath, { inputType: StreamType.OggOpus });
        connection.subscribe(config.player);
        config.player.play(resource);
      } catch(err) {
         console.error("Error creando/reproduciendo recurso silencioso:", err);
         textChannel.send("⚠️ No encontré el archivo `silence.ogg` necesario. La conexión podría ser inestable.");
         // Continuar sin el player silencioso o detenerse aquí? Decidimos continuar.
         config.player = null; // Anular el player si falla
      }


      if (config.player) {
          config.player.on(AudioPlayerStatus.Idle, () => {
              try{
                 if(config.connection && config.player){
                     const newResource = createAudioResource(silenceResourcePath, { inputType: StreamType.OggOpus });
                     config.player.play(newResource);
                 }
              } catch (e) { console.error("Error al reiniciar recurso silencioso:", e); }
          });
           config.player.on('error', error => {
               console.error(`Error en AudioPlayer para ${guild.id}:`, error.message);
               stopListening(guild.id, config); // Llama a la función de limpieza local
           });
      }


      console.log(`[VOICE] Conectado a ${voiceChannel.name}`);
      textChannel.send(`🎤 ¡Hola! Empezaré a escuchar en ${voiceChannel.name} y a traducir aquí.`);

      connection.receiver.speaking.on('start', (userId) => {
        console.log(`[VOICE] Usuario ${userId} empezó a hablar.`);

        if (config.recognizeStream) {
            console.log("[DEBUG] Finalizando stream anterior antes de crear uno nuevo.");
            config.recognizeStream.destroy();
            config.recognizeStream = null;
        }

        const audioStream = connection.receiver.subscribe(userId, {
          end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
        });

        const pcmStream = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });

        const recognizeStream = speechClient
          .streamingRecognize({
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 48000,
              languageCode: 'es-ES',
              alternativeLanguageCodes: ['it-IT'],
              enableAutomaticPunctuation: true,
              model: 'telephony',
            },
            interimResults: false,
          })
          .on('error', (error) => {
              console.error(`[SPEECH ERROR] Guild ${guild.id}:`, error);
               if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
               recognizeStream.destroy();
          })
          .on('data', async (data) => {
            const result = data.results[0];
            if (result && result.alternatives[0]) {
              const text = result.alternatives[0].transcript;
              // Intenta detectar idioma (muy básico)
               const lang = result.languageCode || (text.match(/\b(ciao|grazie|prego|allora)\b/i) ? 'it-IT' : 'es-ES');
              const user = await client.users.fetch(userId).catch(() => null); // Usa el 'client' pasado como parámetro
              const userName = user ? user.username : `Usuario ${userId}`;

              if (text) {
                console.log(`[🎤 ${userName}] (${lang}): ${text}`);
                try {
                  const sourceLang = lang.split('-')[0];
                  const translated = await autoTranslate(text, sourceLang); // Llama a la función importada
                  const targetFlag = sourceLang === 'es' ? '🇮🇹' : '🇪🇸';
                  const targetLangName = sourceLang === 'es' ? 'Italiano' : 'Español';
                  textChannel.send(`**${userName} (${targetFlag} ${targetLangName}):** ${translated}`);
                } catch (translateError) {
                  console.error("Error al traducir:", translateError);
                  textChannel.send(`*Error traduciendo el mensaje de ${userName}*`);
                }
              }
            } else {
               console.log("[SPEECH DEBUG] Recibido dato sin resultado/alternativa:", data);
            }
          })
          .on('end', () => {
              console.log(`[SPEECH END] Stream de reconocimiento para ${userId} terminado.`);
              if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
          });

        config.recognizeStream = recognizeStream;
        audioStream.pipe(pcmStream).pipe(recognizeStream);

        audioStream.on('end', () => {
            console.log(`[VOICE] AudioStream para ${userId} terminado.`);
             try {
                 if (!pcmStream.destroyed) pcmStream.destroy();
                 if (config.recognizeStream === recognizeStream && !recognizeStream.destroyed) { recognizeStream.end(); }
             } catch(e) { console.error("Error limpiando streams de audio:", e)}
        });
         audioStream.on('error', (err) => {
             console.error(`[VOICE ERROR] Error en AudioStream para ${userId}:`, err);
             try {
                 if (!pcmStream.destroyed) pcmStream.destroy();
                 if (config.recognizeStream === recognizeStream && !recognizeStream.destroyed) { recognizeStream.destroy(); }
                 if(config.recognizeStream === recognizeStream){ config.recognizeStream = null; }
             } catch(e) { console.error("Error limpiando streams de audio tras error:", e)}
         });

      }); // Fin de connection.receiver.speaking.on('start', ...)

      connection.on('stateChange', (oldState, newState) => {
        console.log(`[VOICE] Estado de conexión cambiado de ${oldState.status} a ${newState.status} para ${guild.id}`);
        if (newState.status === 'disconnected' || newState.status === 'destroyed') {
          console.log(`[VOICE] Desconectado o destruido en ${voiceChannel.name}. Limpiando recursos.`);
          if(newState.status === 'disconnected') textChannel.send(`🔌 Desconectado del canal de voz ${voiceChannel.name}.`);
          stopListening(guild.id, config); // Llama a la función local
        }
      });
       connection.on('error', error => {
           console.error(`[VOICE ERROR] Error en la conexión de voz para ${guild.id}:`, error);
           textChannel.send(`❌ Error en la conexión de voz. Intentando detener...`);
           stopListening(guild.id, config); // Llama a la función local
       });

  } catch (error) {
      console.error(`[ERROR] Fallo al iniciar escucha para ${guild.name}:`, error);
      textChannel.send('❌ Hubo un problema grave al intentar iniciar la escucha.');
      stopListening(guild.id, config); // Intenta limpiar
  }
}

// --- Función para detener la escucha y limpiar ---
function stopListening(guildId, config) {
     console.log(`[INFO] Intentando detener escucha para Guild ${guildId}`);
     let stopped = false;

    if (config.recognizeStream) {
        try {
            config.recognizeStream.destroy(); // Usar destroy para asegurar cierre
            console.log(`[SPEECH] RecognizeStream detenido para ${guildId}`);
            stopped = true;
        } catch (e) { console.error(`Error deteniendo recognizeStream para ${guildId}:`, e); }
        config.recognizeStream = null;
    }

     if (config.player) {
         try {
             config.player.stop(true);
             console.log(`[VOICE] AudioPlayer detenido para ${guildId}`);
             stopped = true;
         } catch(e) { console.error(`Error deteniendo AudioPlayer para ${guildId}:`, e); }
        config.player = null;
     }

    if (config.connection) {
        try {
            if (config.connection.state.status !== 'destroyed') {
                 config.connection.destroy();
                 console.log(`[VOICE] Conexión de voz destruida para ${guildId}`);
                 stopped = true;
            }
        } catch (e) { console.error(`Error destruyendo conexión de voz para ${guildId}:`, e); }
        config.connection = null;
    }
    return stopped;
}

// Exporta las funciones para que otros archivos las usen
module.exports = {
  startListening,
  stopListening,
};