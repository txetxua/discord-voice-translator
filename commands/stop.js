const { SlashCommandBuilder } = require('discord.js');
// Importa desde el nuevo archivo de utilidades
const { stopListening } = require('../utils/voiceHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la transcripción y desconecta al bot.'),

  // Recibe config y client
  async execute(interaction, config, client) {
    const guildId = interaction.guild.id;

    if (!config.connection && !config.recognizeStream && !config.player) {
      return interaction.reply({ content: '⚠️ No parece haber una transcripción o conexión activa para detener.', ephemeral: true });
    }

    try {
        // Llama a la función importada
        const stoppedSomething = stopListening(guildId, config);

        if (stoppedSomething) {
            await interaction.reply('🛑 Transcripción detenida y recursos limpiados.');
        } else {
             await interaction.reply({ content: '❓ Intenté detener, pero no encontré nada activo para finalizar.', ephemeral: true });
        }

    } catch (error) {
        console.error(`Error al ejecutar stopListening desde stop.js para Guild ${guildId}:`, error);
         const errorMessage = '❌ Ocurrió un error al intentar detener la transcripción.';
         if (interaction.replied || interaction.deferred) {
           await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(e => console.error("Error en followUp:", e));
         } else {
           await interaction.reply({ content: errorMessage, ephemeral: true }).catch(e => console.error("Error en reply:", e));
         }
    }
  }
};