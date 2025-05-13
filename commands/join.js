// commands/join.js
const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { startListening } = require('../utils/voiceHandler.js'); // Asegúrate que la ruta es correcta

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Se une a tu canal de voz y usa ESTE canal de texto para las traducciones. Inicia automáticamente.'),

  async execute(interaction, config, client) {
    const voiceChannel = interaction.member.voice.channel; // Canal de voz del usuario
    const textOutputChannel = interaction.channel; // Canal de texto donde se ejecutó /join
    const guild = interaction.guild;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ Debes estar en un canal de voz para usar este comando.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!textOutputChannel || !textOutputChannel.isTextBased() || textOutputChannel.type === ChannelType.GuildVoice) {
        return interaction.reply({
            content: '❌ Este comando debe usarse en un canal de texto válido donde pueda enviar las traducciones.',
            flags: MessageFlags.Ephemeral
        });
    }

    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection && existingConnection.joinConfig.channelId === voiceChannel.id) {
      if (config.textChannel === textOutputChannel.id && (config.connection || config.recognizeStream)) {
        return interaction.reply({
          content: `✅ Ya estoy en ${voiceChannel.name}, usando ${textOutputChannel} y la transcripción está activa.`,
          flags: MessageFlags.Ephemeral
        });
      }
    } else if (existingConnection) {
      // Si está en otro canal de voz, lo ideal sería detenerlo antes de unirse a uno nuevo.
      // Opcionalmente, podrías llamar a stopListening aquí si quieres que cambie automáticamente.
      // Por ahora, pedimos que se detenga manualmente.
      return interaction.reply({
        content: `⚠️ Ya estoy en otro canal de voz. Usa \`/stop\` primero si deseas cambiar de canal.`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ ephemeral: true }); // Mensajes de configuración solo para el usuario

    try {
      console.log(`[JOIN] Usuario ${interaction.user.tag} ejecutó /join.`);
      console.log(`[JOIN] Canal de voz detectado: ${voiceChannel.name} (ID: ${voiceChannel.id})`);
      console.log(`[JOIN] Canal de texto para salida (actual): ${textOutputChannel.name} (ID: ${textOutputChannel.id})`);

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      config.voiceChannel = voiceChannel.id;
      config.textChannel = textOutputChannel.id; // Usa el canal actual como canal de texto
      console.log(`[CONFIG] Guardado voiceChannel ID: ${config.voiceChannel}`);
      console.log(`[CONFIG] Guardado textChannel ID: ${config.textChannel}`);

      await interaction.editReply({
          content: `✅ Me uní a ${voiceChannel.name}. Usaré **${textOutputChannel.name}** para las traducciones.\n🚀 Iniciando transcripción automáticamente...`
      });

      // Iniciar automáticamente
      try {
          await startListening(guild, voiceChannel, textOutputChannel, config, client);
          // startListening debería enviar sus propios mensajes de confirmación al textOutputChannel público
      } catch (startError) {
          console.error('[JOIN - AUTOSTART ERROR]', startError);
          await interaction.followUp({ // Mensaje efímero para el usuario que ejecutó /join
              content: `❌ Error al iniciar automáticamente la transcripción. (Error: ${startError.message}). Puedes intentar \`/start\` manualmente si la configuración parece correcta.`,
              ephemeral: true
          }).catch(console.error);
      }

    } catch (error) {
      console.error(`[JOIN ERROR] Excepción general en /join:`, error);
      config.voiceChannel = null;
      config.textChannel = null;
      if (interaction.replied || interaction.deferred) { // 'deferred' es true aquí
        await interaction.editReply({
            content: `❌ Ocurrió un error procesando \`/join\`. Error: ${error.message}`
        }).catch(e => {
            console.error("[JOIN ERROR] Fallo al editar respuesta diferida:", e);
            interaction.followUp({
                content: `❌ Error en \`/join\`. Error: ${error.message}`,
                ephemeral: true
            }).catch(fe => console.error("[JOIN ERROR] Fallo en followUp de error:", fe));
        });
      }
    }
  }
};