require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, ChannelType } = require('discord.js');
// Ya no necesitas importar @discordjs/voice, prism, speech, autoTranslate aquí si no los usas directamente en index.js
// PERO SÍ NECESITAS GatewayIntentBits.GuildVoiceStates

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates, // Asegúrate de que este intent está presente
  ],
});

// Objeto para guardar configuraciones y estados por servidor
const serverConfig = {};

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Cargar comandos
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[COMANDO] Cargado: ${command.data.name}`);
  } else {
    console.warn(`[ADVERTENCIA] El comando en ${filePath} le falta 'data' o 'execute'.`);
  }
}

client.once('ready', () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
      console.error(`Comando no encontrado: ${interaction.commandName}`);
      return;
  }

  // Asegúrate que existe una entrada para este servidor en serverConfig
  if (!serverConfig[interaction.guildId]) {
      serverConfig[interaction.guildId] = {};
  }

  try {
    // Pasamos la config específica del server y el client por si algún comando lo necesita
    await command.execute(interaction, serverConfig[interaction.guildId], client);
  } catch (error) {
    console.error(`❌ Error ejecutando ${interaction.commandName}:`, error);

    // Manejo de error mejorado
    const errorMessage = 'Hubo un error al ejecutar este comando.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(e => console.error("Error en followUp:", e));
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true }).catch(e => console.error("Error en reply:", e));
    }
  }
});

// Las funciones startListening y stopListening han sido MOVIDAS a utils/voiceHandler.js

client.login(process.env.DISCORD_TOKEN);

// Ya no necesitas exportar nada desde aquí (a menos que otros módulos lo necesiten)
// module.exports = { ... };