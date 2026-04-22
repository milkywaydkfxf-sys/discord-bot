const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, REST } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "PASTE_CLIENT_ID_HERE"; // 🔴 CHANGE THIS

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
        let medal = "🏅";
        if (i === 0) medal = "🥇";
        if (i === 1) medal = "🥈";
        if (i === 2) medal = "🥉";

        desc += `${medal} **${i + 1}. <@${user[0]}>**\n➤ ${user[1]} wins\n\n`;
    });

    if (!desc) desc = "No players yet.";

    return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 TOURNAMENT LEADERBOARD 🏆')
        .setDescription(
            '──────────────\n' +
            '**TOURNAMENT LEADERBOARD**\n' +
            '──────────────\n\n' +
            desc
        )
        .setFooter({ text: "Rocket League Tournament" });
}

const commands = [
    new SlashCommandBuilder()
        .setName('leaderboardcreate')
        .setDescription('Create leaderboard'),

    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add wins')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Wins to add')
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
    } catch (error) {
        console.error(error);
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
