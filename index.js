const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, REST } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496488130549911652"; // 🔴 CHANGE THIS

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

let data = { boards: {} };

if (fs.existsSync('data.json')) {
    data = JSON.parse(fs.readFileSync('data.json'));
}

function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// SORT (keeps order on ties)
function getSorted(board) {
    return Object.entries(board.leaderboard)
        .sort((a, b) => {
            if (b[1] === a[1]) return 0;
            return b[1] - a[1];
        })
        .slice(0, 10);
}

function createEmbed(boardName) {
    const board = data.boards[boardName] || { leaderboard: {} };
    const sorted = getSorted(board);

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
        .setTitle("🏆 TOURNAMENT LEADERBOARD 🏆")
        .setDescription(desc)
        .setFooter({ text: "Rocket League Tournament" });
}

// 🔥 ROLE SYSTEM (YOUR NAMES)
async function updateRoles(guild, board) {
    const roles = {
        first: guild.roles.cache.find(r => r.name === "🥇 First Place"),
        second: guild.roles.cache.find(r => r.name === "🥈 Second Place"),
        third: guild.roles.cache.find(r => r.name === "🥉 Third Place"),
        top10: guild.roles.cache.find(r => r.name === "🎖️ Top Ten Contender"),
    };

    if (!roles.first || !roles.second || !roles.third || !roles.top10) return;

    const sorted = getSorted(board);

    // remove all roles first
    for (const member of guild.members.cache.values()) {
        await member.roles.remove([roles.first, roles.second, roles.third, roles.top10]).catch(()=>{});
    }

    // assign roles
    for (let i = 0; i < sorted.length; i++) {
        const userId = sorted[i][0];
        const member = await guild.members.fetch(userId).catch(()=>null);
        if (!member) continue;

        if (i === 0) await member.roles.add(roles.first).catch(()=>{});
        else if (i === 1) await member.roles.add(roles.second).catch(()=>{});
        else if (i === 2) await member.roles.add(roles.third).catch(()=>{});
        else if (i < 10) await member.roles.add(roles.top10).catch(()=>{});
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('createboard')
        .setDescription('Create leaderboard')
        .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)),

    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add/remove wins')
        .addStringOption(o => o.setName('board').setRequired(true))
        .addUserOption(o => o.setName('player').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setRequired(true)),

    new SlashCommandBuilder()
        .setName('deleteboard')
        .setDescription('Delete board')
        .addStringOption(o => o.setName('name').setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'createboard') {
        const name = interaction.options.getString('name');

        data.boards[name] = { leaderboard: {}, messageId: null };
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

        if (board.leaderboard[player.id] <= 0) {
            delete board.leaderboard[player.id];
        }

        saveData();

        await interaction.reply({
            content: `✅ Updated ${player.username} (${amount >= 0 ? "+" : ""}${amount})`,
            ephemeral: true
        });

        if (board.messageId) {
            const msg = await interaction.channel.messages.fetch(board.messageId);
            msg.edit({ embeds: [createEmbed(boardName)] });
        }

        // 🔥 UPDATE ROLES HERE
        await updateRoles(interaction.guild, board);
    }

    if (interaction.commandName === 'deleteboard') {
        const name = interaction.options.getString('name');

        if (!data.boards[name]) {
            return interaction.reply({ content: "❌ Board not found", ephemeral: true });
        }

        delete data.boards[name];
        saveData();

        await interaction.reply({ content: "🗑️ Leaderboard deleted", ephemeral: true });
    }
});

client.login(TOKEN);
