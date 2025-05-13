const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice'); // Importa getVoiceConnection

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('El bot se une a tu canal de voz actual y lo guarda para /start.'),

  // Recibe la configuración específica del servidor (config)
  async execute(interaction, config) {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Debes estar en un canal de voz para usar este comando.', ephemeral: true });
    }

    // Verifica si el bot ya está en un canal de voz en este servidor
    const existingConnection = getVoiceConnection(interaction.guild.id);
    if (existingConnection) {
        // Si ya está conectado, solo actualiza el ID guardado si es diferente
        if (config.voiceChannel !== voiceChannel.id) {
            console.log(`[JOIN] Actualizando canal de voz guardado a: ${voiceChannel.name}`);
            config.voiceChannel = voiceChannel.id; // Guarda el ID directamente en config
             await interaction.reply({ content: `✅ Ya estaba conectado, pero he actualizado el canal de voz para /start a: **${voiceChannel.name}**`, ephemeral: true });
        } else {
            await interaction.reply({ content: `✅ Ya estoy conectado y configurado para el canal: **${voiceChannel.name}**`, ephemeral: true });
        }
        return; // No intentes unirte de nuevo si ya existe conexión
    }


    // Si no hay conexión existente, intenta unirse
    try {
      console.log(`[JOIN] Intentando unirse a: ${voiceChannel.name}`);
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator, // Usa interaction.guild
        selfDeaf: false, // Importante para poder recibir audio después con /start
      });

      // Guarda el ID del canal de voz directamente en el objeto de configuración del servidor
      config.voiceChannel = voiceChannel.id;
      console.log(`[CONFIG] Guardado voiceChannel ID para ${interaction.guild.id}: ${config.voiceChannel}`);

      await interaction.reply(`✅ Me uní y configuré el canal de voz: **${voiceChannel.name}**.`);

      // Escucha eventos de la conexión (opcional pero útil para debug)
        connection.on('stateChange', (oldState, newState) => {
            console.log(`[VOICE JOIN] Estado conexión cambiado de ${oldState.status} a ${newState.status} para ${interaction.guild.id}`);
             // Si se desconecta inesperadamente aquí (antes de /start), podrías querer limpiar config.voiceChannel
            if (newState.status === 'disconnected' || newState.status === 'destroyed') {
                // No borramos config.connection porque no se guarda en este comando aún
                 if(config.voiceChannel === voiceChannel.id){ // Solo si es el canal que acabamos de guardar
                     // Podrías limpiar config.voiceChannel = null; pero puede ser confuso para el usuario
                     console.log(`[VOICE JOIN] Conexión perdida o destruida después de join para ${interaction.guild.id}`);
                 }
            }
        });
         connection.on('error', error => {
             console.error(`[VOICE JOIN ERROR] Error en conexión para ${interaction.guild.id}:`, error);
             // Limpiar config.voiceChannel si falla la conexión inicial
             config.voiceChannel = null;
         });


    } catch (error) {
      console.error(`[JOIN ERROR] No se pudo unir a ${voiceChannel.name}:`, error);
      await interaction.reply({ content: `❌ No pude unirme al canal de voz "${voiceChannel.name}". Revisa mis permisos.`, ephemeral: true });
    }
  }
};