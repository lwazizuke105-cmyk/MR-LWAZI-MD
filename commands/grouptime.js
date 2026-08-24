/**
 * 🕐 GROUP TIME COMMAND
 * ZetFlash RST Bot
 *
 * Shows the current time in the group.
 * Admins can set the group timezone.
 *
 * Commands:
 *  .time              – Show current time in group
 *  .time set <tz>     – Set group timezone (admin only)
 *  .time zones        – List common timezones
 */

const fs = require('fs');
const path = require('path');
const { getGroupTimeHeader, buildTimeBanner } = require('../lib/grouptime');

const DATA_FILE = path.join(__dirname, '../data/grouptimezone.json');

function readTimezones() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch { return {}; }
}

function saveTimezones(data) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch {}
}

function getGroupTimezone(chatId) {
    const data = readTimezones();
    return data[chatId] || 'Africa/Johannesburg';
}

const COMMON_TIMEZONES = [
    { name: 'South Africa (SAST)', tz: 'Africa/Johannesburg' },
    { name: 'Nigeria (WAT)', tz: 'Africa/Lagos' },
    { name: 'Kenya (EAT)', tz: 'Africa/Nairobi' },
    { name: 'Egypt (EET)', tz: 'Africa/Cairo' },
    { name: 'Ghana (GMT)', tz: 'Africa/Accra' },
    { name: 'Zimbabwe (CAT)', tz: 'Africa/Harare' },
    { name: 'Botswana (CAT)', tz: 'Africa/Gaborone' },
    { name: 'UK (GMT/BST)', tz: 'Europe/London' },
    { name: 'USA Eastern (EST/EDT)', tz: 'America/New_York' },
    { name: 'USA Pacific (PST/PDT)', tz: 'America/Los_Angeles' },
    { name: 'India (IST)', tz: 'Asia/Kolkata' },
    { name: 'UAE (GST)', tz: 'Asia/Dubai' },
    { name: 'UTC', tz: 'UTC' }
];

async function groupTimeCommand(sock, chatId, message, senderId, isAdmin) {
    const rawText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(/\s+/);
    const sub = (parts[1] || '').toLowerCase();

    const tz = getGroupTimezone(chatId);

    if (!sub || sub === 'show' || sub === 'now') {
        // Show current time
        let groupName = 'Group';
        if (chatId.endsWith('@g.us')) {
            try {
                const meta = await sock.groupMetadata(chatId);
                groupName = meta.subject || 'Group';
            } catch {}
        }
        const timeHeader = getGroupTimeHeader(tz);
        const now = new Date();
        const timeStr = now.toLocaleString('en-ZA', {
            timeZone: tz,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        return sock.sendMessage(chatId, {
            text: `╔══════════════════╗\n║ 🕐 *GROUP TIME*\n╠══════════════════╣\n║ 📅 ${timeStr}\n║ 🌍 Timezone: ${tz}\n║ 📍 ${groupName}\n╚══════════════════╝`
        }, { quoted: message });
    }

    if (sub === 'set') {
        if (!isAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Only admins can set the group timezone.' }, { quoted: message });
        }
        const newTz = parts[2];
        if (!newTz) {
            return sock.sendMessage(chatId, {
                text: `❌ Please provide a timezone.\nExample: *.time set Africa/Johannesburg*\n\nType *.time zones* to see common timezones.`
            }, { quoted: message });
        }
        // Validate timezone
        try {
            new Date().toLocaleString('en', { timeZone: newTz });
        } catch {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid timezone: *${newTz}*\nType *.time zones* to see valid options.`
            }, { quoted: message });
        }
        const data = readTimezones();
        data[chatId] = newTz;
        saveTimezones(data);
        return sock.sendMessage(chatId, {
            text: `✅ Group timezone set to *${newTz}*\n\n${getGroupTimeHeader(newTz)}`
        }, { quoted: message });
    }

    if (sub === 'zones' || sub === 'list') {
        const list = COMMON_TIMEZONES.map((z, i) => `${i + 1}. *${z.name}*\n   \`${z.tz}\``).join('\n');
        return sock.sendMessage(chatId, {
            text: `🌍 *Common Timezones*\n\n${list}\n\n_Use: .time set <timezone>_\n_Example: .time set Africa/Johannesburg_`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, {
        text: `🕐 *Time Commands*\n\n*.time* – Show current group time\n*.time set <timezone>* – Set timezone (admin)\n*.time zones* – List common timezones\n\n_Current timezone: ${tz}_`
    }, { quoted: message });
}

module.exports = { groupTimeCommand, getGroupTimezone };
