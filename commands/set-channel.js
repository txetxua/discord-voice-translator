const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-channel')
    .setDescription('Establece el canal de texto donde se enviarán las traducciones.')
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('El canal de texto para las traducciones')
        .addChannelTypes(ChannelType.GuildText) // Asegura que solo se elijan canales de texto
        .setRequired(true)
    ),

  // Recibe la configuración específica del servidor (config)
  async execute(interaction, config) {
    const textChannel = interaction.options.getChannel('canal');
    const guildId = interaction.guild.id; // Aunque no lo usemos para guardar, es útil para logs

    // Verifica si el canal es realmente de texto (aunque addChannelTypes debería prevenirlo)
    if (!textChannel || textChannel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Debes seleccionar un canal de texto válido.', ephemeral: true });
    }

    // Guarda el ID del canal de texto directamente en el objeto de configuración del servidor
    config.textChannel = textChannel.id;
    console.log(`[CONFIG] Guardado textChannel ID para ${guildId}: ${config.textChannel}`);

    await interaction.reply(`✅ Canal de texto para traducciones configurado en: ${textChannel}`); // ${textChannel} menciona el canal
  }
};