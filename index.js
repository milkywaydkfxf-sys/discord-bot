const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, REST } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "PASTE_CLIENT_ID_HERE"; // 🔴 CHANGE THIS

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let data = { boards: {} };

if (fs.existsSync('data.json')) {
    data = JSON.parse(fs.readFileSync('data.json'));
}

function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

function createEmbed(boardName) {
    const board = data.boards[boardName] || { leaderboard: {} };

    const sorted = Object.entries(board.leaderboard)
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
        .setTitle(boardName) // ✅ USE EXACT NAME YOU TYPE
        .setDescription('\n' + desc)
        .setFooter({ text: "Rocket League Tournament" });
}

const commands = [
    new SlashCommandBuilder()
        .setName('createboard')
        .setDescription('Create leaderboard')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Write EXACT title you want')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add wins')
        .addStringOption(option =>
            option.setName('board')
                .setDescription('Paste same name you used')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Wins')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('deleteboard')
        .setDescription('Delete leaderboard')
        .addStringOption(option =>
            option.setName('board')
                .setDescription('Board name')
                .setRequired(true)
        )
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands loaded");
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'createboard') {
        const name = interaction.options.getString('name');

        if (data.boards[name]) {
            return interaction.reply({ content: "Board already exists", ephemeral: true });
        }

        data.boards[name] = { leaderboard: {}, messageId: null };

        const msg = await interaction.reply({
            embeds: [createEmbed(name)],
            fetchReply: true
        });

        data.boards[name].messageId = msg.id;
        saveData();
    }

    if (interaction.commandName === 'add') {
        const boardName = interaction.options.getString('board');
        const user = interaction.options.getUser('player');
        const amount = interaction.options.getInteger('amount');

        const board = data.boards[boardName];
        if (!board) {
            return interaction.reply({ content: "Board not found (copy name EXACTLY)", ephemeral: true });
        }

        if (!board.leaderboard[user.id]) board.leaderboard[user.id] = 0;
        board.leaderboard[user.id] += amount;

        saveData();

        try {
            const msg = await interaction.channel.messages.fetch(board.messageId);
            await msg.edit({ embeds: [createEmbed(boardName)] });
        } catch {}

        await interaction.reply({ content: "Updated!", ephemeral: true });
    }

    if (interaction.commandName === 'deleteboard') {
        const boardName = interaction.options.getString('board');

        if (!data.boards[boardName]) {
            return interaction.reply({ content: "Board not found", ephemeral: true });
        }

        delete data.boards[boardName];
        saveData();

        await interaction.reply({ content: `Deleted ${boardName}`, ephemeral: true });
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);