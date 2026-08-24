/**
 * 🤖 MANUS AI DOWNLOAD ASSISTANT
 * ZetFlash RST Bot
 *
 * Uses Manus AI (OpenAI-compatible) to intelligently assist with downloads.
 * - Suggests best download sources for any content
 * - Helps find APKs, music, videos, documents
 * - Provides safe download guidance
 *
 * Commands:
 *  .manus <query>           – Ask Manus AI for download help
 *  .manushelp               – Show Manus download capabilities
 *  .manusdownload <query>   – Get AI-powered download assistance
 */

const axios = require('axios');
const { appDownloadCommand } = require('./appdownload');

// ── AI helper ─────────────────────────────────────────────────────────────────

async function askManusAI(prompt) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return null;

        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4.1-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are Manus, an AI download assistant integrated into a WhatsApp bot called ZetFlash RST Bot. 
Your job is to help users find and download content safely. 
When asked about downloading something, provide:
1. The best trusted sources/websites to download from
2. Direct steps on how to download
3. Safety warnings if needed
4. Alternative options if the primary source is unavailable
Keep responses concise and formatted for WhatsApp (use *bold* for emphasis, avoid markdown headers).
Always recommend legal and safe sources.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );

        return res.data?.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error('Manus AI error:', e.message);
        return null;
    }
}

// ── Smart download router ─────────────────────────────────────────────────────

function detectDownloadType(query) {
    const q = query.toLowerCase();
    if (/\.(apk|app)$|android|play store|apkpure/i.test(q)) return 'apk';
    if (/youtube|youtu\.be|yt\.be/i.test(q)) return 'youtube';
    if (/tiktok|tik tok/i.test(q)) return 'tiktok';
    if (/instagram|insta\b/i.test(q)) return 'instagram';
    if (/facebook|fb\.com/i.test(q)) return 'facebook';
    if (/spotify/i.test(q)) return 'spotify';
    if (/mp3|music|song|audio/i.test(q)) return 'music';
    if (/mp4|video|movie|film/i.test(q)) return 'video';
    if (/pdf|document|ebook|book/i.test(q)) return 'document';
    return 'general';
}

function getDownloadSuggestions(type, query) {
    const enc = encodeURIComponent(query);
    const suggestions = {
        apk: `📱 *Download APK: ${query}*\n\n🔗 Google Play: https://play.google.com/store/search?q=${enc}&c=apps\n🔗 APKPure: https://apkpure.com/search?q=${enc}\n🔗 APKMirror: https://www.apkmirror.com/?s=${enc}\n🔗 Uptodown: https://en.uptodown.com/android/search/${enc}\n\n💡 _Or use *.apk ${query}* for direct download_`,
        youtube: `🎬 *YouTube Download*\n\n🔗 y2mate: https://www.y2mate.com/\n🔗 yt1s: https://yt1s.io/\n🔗 savefrom: https://en.savefrom.net/\n\n💡 _Or use *.video ${query}* or *.play ${query}* in this bot_`,
        tiktok: `🎵 *TikTok Download*\n\n🔗 ssstik: https://ssstik.io/\n🔗 snaptik: https://snaptik.app/\n\n💡 _Or use *.tiktok <link>* in this bot_`,
        instagram: `📸 *Instagram Download*\n\n🔗 instadownloader: https://instadownloader.co/\n🔗 snapinsta: https://snapinsta.app/\n\n💡 _Or use *.instagram <link>* in this bot_`,
        facebook: `📘 *Facebook Download*\n\n🔗 fdown: https://fdown.net/\n🔗 fbdown: https://www.fbdown.net/\n\n💡 _Or use *.facebook <link>* in this bot_`,
        spotify: `🎵 *Spotify Download*\n\n🔗 spotifydownloader: https://spotifydownloader.com/\n🔗 spotdl: https://spotdl.com/\n\n💡 _Or use *.spotify <query>* in this bot_`,
        music: `🎵 *Music Download: ${query}*\n\n🔗 MP3Juice: https://www.mp3juice.tw/\n🔗 MP3Skull: https://mp3skull.com/mp3/${enc}.html\n🔗 SoundCloud: https://soundcloud.com/search?q=${enc}\n\n💡 _Or use *.play ${query}* in this bot_`,
        video: `🎬 *Video Download: ${query}*\n\n🔗 YouTube: https://www.youtube.com/results?search_query=${enc}\n🔗 Dailymotion: https://www.dailymotion.com/search/${enc}\n\n💡 _Or use *.video ${query}* in this bot_`,
        document: `📄 *Document Download: ${query}*\n\n🔗 PDF Drive: https://www.pdfdrive.com/search?q=${enc}\n🔗 Z-Library: https://z-lib.id/s/${enc}\n🔗 Internet Archive: https://archive.org/search?query=${enc}`,
        general: `🔍 *Download: ${query}*\n\n🔗 Google: https://www.google.com/search?q=${enc}+download\n🔗 Internet Archive: https://archive.org/search?query=${enc}`
    };
    return suggestions[type] || suggestions.general;
}

// ── Main command handler ──────────────────────────────────────────────────────

async function manusDownloadCommand(sock, chatId, message) {
    const rawText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();

    // ── Help ────────────────────────────────────────────────────────────────
    if (cmd === '.manushelp' || !query) {
        return sock.sendMessage(chatId, {
            text: `🤖 *Manus AI Download Assistant*\n\n_Manus is an intelligent AI that helps you find and download anything safely._\n\n*Commands:*\n• *.manus <what to download>* – AI-powered download help\n• *.manusdownload <query>* – Smart download assistant\n• *.apk <app name>* – Download Android apps\n• *.play <song>* – Download music\n• *.video <name>* – Download videos\n• *.tiktok <link>* – Download TikTok\n• *.instagram <link>* – Download Instagram\n• *.facebook <link>* – Download Facebook\n\n_Examples:_\n• .manus download WhatsApp APK\n• .manus how to download Spotify songs\n• .manus best site to download movies`
        }, { quoted: message });
    }

    // ── If it's an APK request, use the direct download command ──────────────
    const type = detectDownloadType(query);
    if (type === 'apk') {
        // Build a fake message so appDownloadCommand can parse it as .apk <query>
        const apkQuery = query.replace(/\b(download|apk|android|app|application)\b/gi, '').trim() || query;
        const fakeMessage = {
            key: message.key,
            message: { conversation: `.apk ${apkQuery}` }
        };
        return appDownloadCommand(sock, chatId, fakeMessage);
    }

    // ── AI-powered response ─────────────────────────────────────────────────
    await sock.sendMessage(chatId, {
        text: `🤖 *Manus AI is thinking...*\n_Finding the best way to download: ${query}_`
    }, { quoted: message });

    // Detect type for quick suggestions (already computed above)
    const quickSuggestions = getDownloadSuggestions(type, query);

    // Try to get AI response
    const aiPrompt = `User wants to download: "${query}". Provide helpful, concise download guidance with trusted sources.`;
    const aiResponse = await askManusAI(aiPrompt);

    if (aiResponse) {
        return sock.sendMessage(chatId, {
            text: `🤖 *Manus AI Download Assistant*\n\n${aiResponse}\n\n━━━━━━━━━━━━━━━━\n${quickSuggestions}`
        }, { quoted: message });
    }

    // Fallback to smart suggestions
    return sock.sendMessage(chatId, {
        text: `🤖 *Manus AI Download Assistant*\n\n${quickSuggestions}\n\n_💡 Tip: Use the bot commands above for direct downloads!_`
    }, { quoted: message });
}

module.exports = { manusDownloadCommand };
