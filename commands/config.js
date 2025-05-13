const { SlashCommandBuilder, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("configurar")
    .setDescription("Configura el canal de voz y texto para la traducción.")
    .addChannelOption(option =>
      option.setName("voz").setDescription("Canal de voz").setRequired(true).addChannelTypes(ChannelType.GuildVoice)
    )
    .addChannelOption(option =>
      option.setName("texto").setDescription("Canal de texto").setRequired(true).addChannelTypes(ChannelType.GuildText)
    ),
  async execute(interaction, configData) {
    const guildId = interaction.guild.id;
    const voiceChannel = interaction.options.getChannel("voz");
    const textChannel = interaction.options.getChannel("texto");

    configData[guildId] = {
      voiceChannel: voiceChannel.id,
      textChannel: textChannel.id,
    };

    await interaction.reply(`✅ Configurado correctamente: Voz en **${voiceChannel.name}**, Texto en **${textChannel.name}**`);
  },
};
