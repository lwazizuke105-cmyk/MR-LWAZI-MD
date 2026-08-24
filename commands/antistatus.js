/**
 * 💀 ANTISTATUS COMMAND
 * ZetFlash RST Bot
 *
 * Monitors and takes action against members who post WhatsApp statuses.
 * Style and logic aligned with Antilink.
 *
 * Commands:
 *  .antistatus on           – Enable antistatus
 *  .antistatus off          – Disable antistatus
 *  .antistatus set kick     – Set action to kick
 *  .antistatus set delete   – Set action to delete message (notify)
 *  .antistatus set warn     – Set action to warn (kick after 3 warnings)
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_PATH = path.join(__dirname, '../data/antistatus.json');
const WARN_PATH = path.join(__dirname, '../data/antistatus_warnings.json');
const WARN_COUNT = config.WARN_COUNT || 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadSettings() {
    if (!fs.existsSync(DATA_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch { return {}; }
}
function saveSettings(settings) {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(settings, null, 2));
}
function loadWarnings() {
    if (!fs.existsSync(WARN_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(WARN_PATH, 'utf8')); } catch { return {}; }
}
function saveWarnings(warnings) {
    const dir = path.dirname(WARN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WARN_PATH, JSON.stringify(warnings, null, 2));
}

// ── Settings command handler ──────────────────────────────────────────────────
async function antistatusCommand(sock, chatId, message, senderId) {
    const rawText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(/\s+/);
    const sub = (parts[1] || '').toLowerCase();
    const action = (parts[2] || '').toLowerCase();

    // Check if sender is admin
    let isAdmin = false;
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        isAdmin = !!groupMetadata.participants.find(p => p.id === senderId)?.admin;
    } catch {}

    if (!isAdmin) {
        return sock.sendMessage(chatId, { text: '❌ This command is for admins only.' }, { quoted: message });
    }

    let settings = loadSettings();
    if (!settings[chatId]) settings[chatId] = { enabled: false, action: 'warn' };

    if (sub === 'on') {
        settings[chatId].enabled = true;
        saveSettings(settings);
        return sock.sendMessage(chatId, {
            text: '✅ *Antistatus enabled!* Members posting statuses will be handled.'
        }, { quoted: message });
    }
    if (sub === 'off') {
        settings[chatId].enabled = false;
        saveSettings(settings);
        return sock.sendMessage(chatId, { text: '✅ *Antistatus disabled!*' }, { quoted: message });
    }
    if (sub === 'set') {
        if (['kick', 'delete', 'warn'].includes(action)) {
            settings[chatId].action = action;
            saveSettings(settings);
            return sock.sendMessage(chatId, {
                text: `✅ *Antistatus action set to: ${action.toUpperCase()}*`
            }, { quoted: message });
        }
        return sock.sendMessage(chatId, {
            text: '❌ Invalid action. Use: `.antistatus set kick/delete/warn`'
        }, { quoted: message });
    }

    // Default help/status message
    return sock.sendMessage(chatId, {
        text: `💀 *Antistatus Settings*
━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${settings[chatId].enabled ? '✅ ON' : '❌ OFF'}
Action: *${settings[chatId].action.toUpperCase()}*

*Commands:*
• .antistatus on
• .antistatus off
• .antistatus set kick
• .antistatus set delete
• .antistatus set warn
━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: message });
}

// ── Enforcement handler (called from index.js on messages.upsert status@broadcast) ──
/**
 * Called whenever a group member posts a WhatsApp status.
 * Checks if antistatus is enabled for the group, then applies
 * the configured action: delete (notify), kick, or warn.
 *
 * @param {object} sock     - Baileys socket
 * @param {string} groupId  - Group JID
 * @param {string} sender   - Sender JID (the one who posted the status)
 */
async function handleAntiStatus(sock, groupId, sender) {
    try {
        const settings = loadSettings();
        const groupSettings = settings[groupId];
        if (!groupSettings || !groupSettings.enabled) return;

        const action = groupSettings.action || 'warn';

        // Fetch group metadata to verify sender is still a member
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(groupId);
        } catch {
            return;
        }

        const participants = groupMetadata.participants || [];
        const senderInGroup = participants.find(p => p.id === sender);
        if (!senderInGroup) return; // Not in this group

        // Skip admins
        const senderIsAdmin = senderInGroup.admin === 'admin' || senderInGroup.admin === 'superadmin';
        if (senderIsAdmin) return;

        const shortNumber = sender.split('@')[0];

        switch (action) {
            case 'delete':
                // WhatsApp statuses live on status@broadcast and cannot be deleted by bots.
                // We notify the group as the enforcement action.
                await sock.sendMessage(groupId, {
                    text: `⚠️ @${shortNumber} posted a WhatsApp status. Status posts are *not allowed* in this group!`,
                    mentions: [sender]
                });
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(groupId, [sender], 'remove');
                    await sock.sendMessage(groupId, {
                        text: `🚫 @${shortNumber} has been *kicked* for posting a WhatsApp status.`,
                        mentions: [sender]
                    });
                } catch (kickErr) {
                    console.error('Antistatus kick error:', kickErr.message);
                    await sock.sendMessage(groupId, {
                        text: `⚠️ @${shortNumber} posted a status but I couldn't kick them. Make sure I'm an admin!`,
                        mentions: [sender]
                    });
                }
                break;

            case 'warn':
            default: {
                const warnings = loadWarnings();
                if (!warnings[groupId]) warnings[groupId] = {};
                if (!warnings[groupId][sender]) warnings[groupId][sender] = 0;
                warnings[groupId][sender]++;
                const count = warnings[groupId][sender];
                saveWarnings(warnings);

                if (count >= WARN_COUNT) {
                    try {
                        await sock.groupParticipantsUpdate(groupId, [sender], 'remove');
                        warnings[groupId][sender] = 0;
                        saveWarnings(warnings);
                        await sock.sendMessage(groupId, {
                            text: `🚫 @${shortNumber} has been *kicked* after ${WARN_COUNT} warnings for posting statuses.`,
                            mentions: [sender]
                        });
                    } catch (kickErr) {
                        console.error('Antistatus warn-kick error:', kickErr.message);
                        await sock.sendMessage(groupId, {
                            text: `⚠️ @${shortNumber} reached ${WARN_COUNT} warnings for posting statuses but I couldn't kick them. Make sure I'm an admin!`,
                            mentions: [sender]
                        });
                    }
                } else {
                    await sock.sendMessage(groupId, {
                        text: `⚠️ @${shortNumber} *Warning ${count}/${WARN_COUNT}* — Status posts are not allowed in this group!`,
                        mentions: [sender]
                    });
                }
                break;
            }
        }
    } catch (error) {
        console.error('handleAntiStatus error:', error.message);
    }
}

module.exports = { antistatusCommand, handleAntiStatus };
