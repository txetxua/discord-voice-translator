// commands/start.js
const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js'); // Añadido MessageFlags y ChannelType
const { startListening } = require('../utils/voiceHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Empieza a transcribir y traducir.'),

  async execute(interaction, config, client) {
    const guild = interaction.guild;

    if (!config?.voiceChannel || !config?.textChannel) {
      return interaction.reply({
        content: '❌ Debes unirte a un canal de voz con `/join` (que intentará encontrar el chat de texto asociado) o usar `/set-channel` si no se encontró automáticamente.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (config.connection || config.recognizeStream) {
         return interaction.reply({
             content: '⚠️ Ya hay una transcripción activa en este servidor.',
             flags: MessageFlags.Ephemeral
         });
    }

    const voiceChannel = guild.channels.cache.get(config.voiceChannel);
    const textChannel = guild.channels.cache.get(config.textChannel);

    if (!voiceChannel) {
      return interaction.reply({ content: `❌ El canal de voz configurado (ID: ${config.voiceChannel}) ya no existe o no lo veo. Usa \`/join\` de nuevo.`, flags: MessageFlags.Ephemeral });
    }
    if (voiceChannel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ content: `❌ El canal "${voiceChannel.name}" no es un canal de voz válido. Usa \`/join\` en un canal de voz.`, flags: MessageFlags.Ephemeral });
    }
     if (!textChannel) {
        return interaction.reply({ content: `❌ El canal de texto configurado (ID: ${config.textChannel}) ya no existe o no lo veo. Usa \`/set-channel\` o \`/join\` de nuevo.`, flags: MessageFlags.Ephemeral });
    }
     // Permitir tanto canales de texto normales como hilos públicos/privados de voz (que son un tipo de canal de texto)
     if (textChannel.type !== ChannelType.GuildText &&
         textChannel.type !== ChannelType.PublicThread &&
         textChannel.type !== ChannelType.PrivateThread &&
         textChannel.type !== ChannelType.GuildAnnouncement && // Los canales de anuncios también son textuales
         textChannel.type !== ChannelType.AnnouncementThread 
         ) {
         console.warn(`[START WARN] El canal de texto ${textChannel.name} (ID: ${textChannel.id}) es de tipo ${textChannel.type}. Se intentará usar igualmente.`);
         // No devolvemos error aquí, pero es una advertencia. La clave es que sea 'TextBased'.
         if (!textChannel.isTextBased()) {
             return interaction.reply({ content: `❌ El canal "${textChannel.name}" no es un canal donde pueda enviar mensajes de texto.`, flags: MessageFlags.Ephemeral });
         }
     }

     const botMember = await guild.members.fetch(client.user.id);
     const voicePerms = voiceChannel.permissionsFor(botMember);
     const textPerms = textChannel.permissionsFor(botMember);

     if (!voicePerms.has('Connect') || !voicePerms.has('ViewChannel')) {
         return interaction.reply({ content: `❌ No tengo permisos para Conectar o Ver el canal de voz "${voiceChannel.name}".`, flags: MessageFlags.Ephemeral });
     }
     if (!textPerms.has('ViewChannel') || !textPerms.has('SendMessages')) {
          return interaction.reply({ content: `❌ No tengo permisos para Ver o Enviar Mensajes en el canal de texto "${textChannel.name}".`, flags: MessageFlags.Ephemeral });
     }
     // El permiso 'Speak' no es necesario para que el bot escuche, solo para que hable.
     // El permiso 'UseVAD' (Usar actividad de voz) podría ser relevante pero usualmente está por defecto.

    try {
      // Es mejor responder o diferir la respuesta antes de una operación larga como startListening
      await interaction.reply({
          content: `🎤 Configurando para escuchar en **${voiceChannel.name}** y enviar traducciones a **${textChannel.name}**...`,
          ephemeral: false // Que se vea el mensaje
        });

      // startListening podría tomar tiempo y manejar sus propios mensajes de confirmación o error al canal de texto
      await startListening(guild, voiceChannel, textChannel, config, client);

      // No edites aquí la respuesta de la interacción si startListening envía sus propios mensajes.
      // Si startListening NO envía mensajes de confirmación, podrías hacer:
      // await interaction.editReply(`✅ ¡Listo! Escuchando en ${voiceChannel.name} y traduciendo en ${textChannel.name}.`);

    } catch (error) {
      console.error("[START ERROR] Error al ejecutar startListening desde start.js:", error);
      const errorMessage = '❌ Ocurrió un error crítico al intentar iniciar la transcripción.';
      // Si la interacción ya fue respondida (con el mensaje "Configurando...")
      if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(e => console.error("[START ERROR] Error en followUp:", e));
      } else {
           await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(e => console.error("[START ERROR] Error en reply:", e));
      }
    }
  }
};