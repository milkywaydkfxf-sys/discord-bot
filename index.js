const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, REST } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496488130549911652";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let data = { leaderboard: {}, messageId: null };

if (fs.existsSync('data.json')) {
  data = JSON.parse(fs.readFileSync('data.json'));
}

function saveData() {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

function createEmbed() {
  const sorted = Object.entries(data.leaderboard)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let desc = "";

  sorted.forEach((user, i) => {
    desc += `🏅 **${i + 1}. <@${user[0]}>**\n➤ **${user[1]} wins**\n\n`;
  });

  if (!desc) desc = "No players yet.";

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("🏆 TOURNAMENT LEADERBOARD")
    .setDescription(desc)
    .setFooter({ text: "Rocket League Tournament" });
}

const commands = [
  new SlashCommandBuilder()
    .setName('leaderboardcreate')
    .setDescription('Create leaderboard')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Leaderboard name')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add wins')
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('Player to add wins to') // ✅ FIXED
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('How many wins') // ✅ FIXED
        .setRequired(true)
    )
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("Commands registered");
  } catch (err) {
    console.error(err);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'leaderboardcreate') {
    const embed = createEmbed();
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    data.messageId = msg.id;
    saveData();
  }

  if (interaction.commandName === 'add') {
    const user = interaction.options.getUser('player');
    const amount = interaction.options.getInteger('amount');

    if (!data.leaderboard[user.id]) data.leaderboard[user.id] = 0;
    data.leaderboard[user.id] += amount;

    saveData();

    try {
      const channel = interaction.channel;
      const msg = await channel.messages.fetch(data.messageId);
      await msg.edit({ embeds: [createEmbed()] });
    } catch {}

    await interaction.reply({ content: "Updated!", ephemeral: true });
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);