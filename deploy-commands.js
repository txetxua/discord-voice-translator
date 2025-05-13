// deploy-commands.js
const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder().setName('join').setDescription('Une al VC, usa canal actual para texto e inicia transcripción auto.'),
  new SlashCommandBuilder().setName('start').setDescription('Inicia transcripción si /join no lo hizo o falló el inicio auto.'), // Descripción actualizada
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la transcripción y desconecta del canal de voz.'),
  new SlashCommandBuilder()
    .setName('set-channel')
    .setDescription('Establece manualmente el canal para traducciones (alternativa).') // Descripción actualizada
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal de texto para las traducciones')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
]
  .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const clientId = '1364962379472830734'; // Reemplaza con el ID de tu aplicación de bot
const guildId = '1325277401059426356';   // Reemplaza con el ID de tu servidor de pruebas

(async () => {
  try {
    console.log(`🔄 Registrando ${commands.length} comandos slash para el servidor ${guildId}...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ Comandos registrados con éxito.');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
})();
