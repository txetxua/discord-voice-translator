// commands/join.js
const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { startListening } = require('../utils/voiceHandler.js'); // Asegúrate que la ruta es correcta

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Une al VC, usa canal actual para texto e inicia transcripción auto.'),

  async execute(interaction, config, client) {
    const voiceChannel = interaction.member.voice.channel;
    const textOutputChannel = interaction.channel;
    const guild = interaction.guild;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ Debes estar en un canal de voz para usar este comando.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!textOutputChannel || !textOutputChannel.isTextBased() || textOutputChannel.type === ChannelType.GuildVoice) {
        return interaction.reply({
            content: '❌ Este comando debe usarse en un canal de texto válido para las traducciones.',
            flags: MessageFlags.Ephemeral
        });
    }

    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection) {
        console.log(`[INFO JOIN] Ya existe una conexión de voz para ${guild.id}. Estado: ${existingConnection.state.status}`);
        if (existingConnection.joinConfig.channelId === voiceChannel.id &&
            config.textChannel === textOutputChannel.id &&
            (config.connection || config.recognizeStream)) { // Verifica config.connection o config.recognizeStream
            return interaction.reply({
                content: `✅ Ya estoy en ${voiceChannel.name}, usando ${textOutputChannel.name} y la transcripción está activa.`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            console.log("[INFO JOIN] Conexión existente detectada en diferente estado o canal. Se intentará detener la escucha previa.");
            const { stopListening } = require('../utils/voiceHandler.js');
            stopListening(guild.id, config);
            // Espera un poco para que la desconexión/limpieza se procese
            await new Promise(resolve => setTimeout(resolve, 700)); // Aumentado a 0.7s
            console.log("[INFO JOIN] Escucha previa detenida (si existía). Procediendo a unirse de nuevo.");
        }
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      console.log(`[INFO JOIN] Usuario ${interaction.user.tag} ejecutó /join.`);
      console.log(`[INFO JOIN] Canal de voz detectado: ${voiceChannel.name} (ID: ${voiceChannel.id})`);
      console.log(`[INFO JOIN] Canal de texto para salida (actual): ${textOutputChannel.name} (ID: ${textOutputChannel.id})`);

      // La conexión se establece dentro de startListening si es necesario.
      // Aquí solo configuramos los IDs.
      config.voiceChannel = voiceChannel.id;
      config.textChannel = textOutputChannel.id;
      console.log(`[CONFIG JOIN] Guardado voiceChannel ID: ${config.voiceChannel}`);
      console.log(`[CONFIG JOIN] Guardado textChannel ID: ${config.textChannel}`);

      await interaction.editReply({
          content: `✅ Configurando para ${voiceChannel.name}. Usaré **${textOutputChannel.name}** para las traducciones.\n🚀 Iniciando transcripción automáticamente...`
      });

      try {
          await startListening(guild, voiceChannel, textOutputChannel, config, client);
      } catch (startError) {
          console.error('[ERROR JOIN - AUTOSTART]', startError);
          await interaction.followUp({
              content: `❌ Error al iniciar automáticamente la transcripción. (Error: ${startError.message}). Puedes intentar \`/start\` manualmente.`,
              ephemeral: true
          }).catch(e => console.error("[ERROR JOIN] Fallo en followUp de error de autostart:", e));
      }

    } catch (error) {
      console.error(`[ERROR JOIN] Excepción general en /join:`, error);
      if(config) {
        config.voiceChannel = null;
        config.textChannel = null;
      }
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
            content: `❌ Ocurrió un error crítico procesando \`/join\`. Error: ${error.message}`
        }).catch(async e => {
            console.error("[ERROR JOIN] Fallo al editar respuesta diferida principal:", e);
            await interaction.followUp({ content: `❌ Error crítico en /join.`, ephemeral: true })
                         .catch(fe => console.error("[ERROR JOIN] Fallo en followUp de error crítico:", fe));
        });
      }
    }
  }
};
