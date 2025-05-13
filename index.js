// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const serverConfig = {};

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if (command.data && typeof command.data.name === 'string' && typeof command.execute === 'function') { // Verificación más robusta
      client.commands.set(command.data.name, command);
      console.log(`[COMANDO] Cargado: ${command.data.name}`);
    } else {
      console.warn(`[ADVERTENCIA] El comando en ${filePath} está incompleto o malformado (falta 'data.name' o 'execute').`);
    }
  } catch (error) {
    console.error(`[ERROR CARGANDO COMANDO] No se pudo cargar ${filePath}:`, error);
  }
}

client.once('ready', () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
      console.error(`[INTERACCIÓN ERROR] Comando no encontrado: ${interaction.commandName}`);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Comando no encontrado.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.followUp({ content: 'Comando no encontrado.', flags: MessageFlags.Ephemeral });
        }
      } catch(e) { console.error("[INTERACCIÓN ERROR] No se pudo responder a comando no encontrado:", e); }
      return;
  }

  if (!serverConfig[interaction.guildId]) {
      serverConfig[interaction.guildId] = {};
  }

  try {
    console.log(`[INTERACCIÓN] Usuario ${interaction.user.tag} ejecutó /${interaction.commandName} en Guild ${interaction.guildId}`);
    await command.execute(interaction, serverConfig[interaction.guildId], client);
  } catch (error) {
    console.error(`❌ Error ejecutando el comando /${interaction.commandName} para ${interaction.user.tag} en Guild ${interaction.guildId}:`, error);
    
    const errorMessage = 'Hubo un error interno al procesar tu comando. Intenta de nuevo más tarde.';
    try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
    } catch (replyError) {
        console.error("[INTERACCIÓN ERROR] No se pudo enviar mensaje de error al usuario:", replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
