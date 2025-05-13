const { SlashCommandBuilder, ChannelType } = require('discord.js'); // Añadido ChannelType
// Importa desde el nuevo archivo de utilidades
const { startListening } = require('../utils/voiceHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Empieza a transcribir y traducir.'),

  // execute recibe config y client desde index.js
  async execute(interaction, config, client) {
    const guildId = interaction.guild.id;
    const guild = interaction.guild;

    if (!config?.voiceChannel || !config?.textChannel) {
      return interaction.reply({
        content: '❌ Debes configurar los canales con `/join` y `/set-channel` antes de iniciar.',
        ephemeral: true
      });
    }

    if (config.connection || config.recognizeStream) {
         return interaction.reply({
             content: '⚠️ Ya hay una transcripción activa en este servidor.',
             ephemeral: true
         });
    }

    const voiceChannel = guild.channels.cache.get(config.voiceChannel);
    const textChannel = guild.channels.cache.get(config.textChannel);

    if (!voiceChannel) {
      return interaction.reply({ content: `❌ El canal de voz configurado (ID: ${config.voiceChannel}) ya no existe o no lo veo.`, ephemeral: true });
    }
    if (voiceChannel.type !== ChannelType.GuildVoice) { // Verifica tipo
        return interaction.reply({ content: `❌ "${voiceChannel.name}" no es un canal de voz.`, ephemeral: true });
    }
     if (!textChannel) {
        return interaction.reply({ content: `❌ El canal de texto configurado (ID: ${config.textChannel}) ya no existe o no lo veo.`, ephemeral: true });
    }
     if (textChannel.type !== ChannelType.GuildText) { // Verifica tipo
         return interaction.reply({ content: `❌ "${textChannel.name}" no es un canal de texto.`, ephemeral: true });
     }

    // Verifica permisos en los canales
     const botMember = await guild.members.fetch(client.user.id);
     const voicePerms = voiceChannel.permissionsFor(botMember);
     const textPerms = textChannel.permissionsFor(botMember);

     if (!voicePerms.has('Connect') || !voicePerms.has('Speak') || !voicePerms.has('ViewChannel')) {
         return interaction.reply({ content: `❌ No tengo permisos para Conectar, Hablar o Ver el canal de voz "${voiceChannel.name}".`, ephemeral: true });
     }
     if (!textPerms.has('ViewChannel') || !textPerms.has('SendMessages')) {
          return interaction.reply({ content: `❌ No tengo permisos para Ver o Enviar Mensajes en el canal de texto "${textChannel.name}".`, ephemeral: true });
     }


    try {
      await interaction.reply({content: `🎤 Intentando iniciar transcripción en **${voiceChannel.name}** -> **${textChannel.name}**...`, ephemeral: false});

      // Llama a la función importada, pasando client también
      await startListening(guild, voiceChannel, textChannel, config, client);

    } catch (error) {
      console.error("Error al ejecutar startListening desde start.js:", error);
      const errorMessage = '❌ Ocurrió un error al intentar iniciar la transcripción.';
      if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(e => console.error("Error en followUp:", e));
      } else {
           await interaction.reply({ content: errorMessage, ephemeral: true }).catch(e => console.error("Error en reply:", e));
      }
    }
  }
};