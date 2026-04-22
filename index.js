const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, REST } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496488130549911652"; // 🔴 CHANGE THIS

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
        let medal = "🎖️";
        if (i === 0) medal = "🥇";
        if (i === 1) medal = "🥈";
        if (i === 2) medal = "🥉";

        desc += `${medal} **${i + 1}. <@${user[0]}>**\n➤ ${user[1]} wins\n\n`;
    });

    if (!desc) desc = "No players yet.";

    return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(boardName)
        .setDescription(desc)
        .setFooter({ text: "Rocket League Tournament" });
}

const commands = [
    new SlashCommandBuilder()
        .setName('createboard')
        .setDescription('Create leaderboard')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Leaderboard name')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add or remove wins')
        .addStringOption(option =>
            option.setName('board')
                .setDescription('Board name')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Wins (+ or -)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('deleteboard')
        .setDescription('Delete leaderboard')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Board name')
                .setRequired(true)
        )
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
    } catch (error) {
        console.error(error);
    }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'createboard') {
        const name = interaction.options.getString('name');

        if (data.boards[name]) {
            return interaction.reply({ content: "❌ Board already exists", ephemeral: true });
        }

        data.boards[name] = {
            leaderboard: {},
            messageId: null
        };

        saveData();

        const msg = await interaction.channel.send({
            embeds: [createEmbed(name)]
        });

        data.boards[name].messageId = msg.id;
        saveData();

        await interaction.reply({ content: "✅ Leaderboard created", ephemeral: true });
    }

    if (interaction.commandName === 'add') {
        const boardName = interaction.options.getString('board');
        const player = interaction.options.getUser('player');
        const amount = interaction.options.getInteger('amount');

        if (!data.boards[boardName]) {
            return interaction.reply({ content: "❌ Board not found", ephemeral: true });
        }

        const board = data.boards[boardName];

        if (!board.leaderboard[player.id]) {
            board.leaderboard[player.id] = 0;
        }

        board.leaderboard[player.id] += amount;

        // 🔥 REMOVE PLAYER IF 0 OR LESS
        if (board.leaderboard[player.id] <= 0) {
            delete board.leaderboard[player.id];
        }

        saveData();

        await interaction.reply({
            content: `✅ Updated ${player.username} (${amount >= 0 ? "+" : ""}${amount})`,
            ephemeral: true
        });

        if (board.messageId) {
            const channel = interaction.channel;
            const msg = await channel.messages.fetch(board.messageId);
            msg.edit({ embeds: [createEmbed(boardName)] });
        }
    }

    if (interaction.commandName === 'deleteboard') {
        const name = interaction.options.getString('name');

        if (!data.boards[name]) {
            return interaction.reply({ content: "❌ Board not found", ephemeral: true });
        }

        const board = data.boards[name];

        try {
            const msg = await interaction.channel.messages.fetch(board.messageId);
            await msg.delete();
        } catch {}

        delete data.boards[name];
        saveData();

        await interaction.reply({ content: "🗑️ Leaderboard deleted", ephemeral: true });
    }
});

client.login(TOKEN);
