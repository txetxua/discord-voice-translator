// deploy-commands.js
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder().setName('join').setDescription('El bot se une al canal de voz.'),
  new SlashCommandBuilder().setName('start').setDescription('Empieza a transcribir y traducir.'),
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la transcripción.'),
  new SlashCommandBuilder()
    .setName('set-channel')
    .setDescription('Establece el canal donde se enviarán las traducciones.')
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal de texto para las traducciones')
        .setRequired(true))
]
  .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const clientId = '1364962379472830734';  // ✅ Tu bot
const guildId = '1286299636759396392';   // ✅ Tu servidor

(async () => {
  try {
    console.log('🔄 Registrando comandos slash...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log('✅ Comandos registrados con éxito.');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
})();
