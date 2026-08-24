/**
 * 📱 APP DOWNLOAD COMMAND
 * ZetFlash RST Bot
 *
 * Downloads Android APK apps using APKCombo scraping.
 * Sends the actual APK file directly into WhatsApp — no links!
 *
 * Commands:
 *  .apk <app name>          – Search and download an APK
 *  .app <app name>          – Alias for .apk
 *  .appinfo <app name>      – Get app information
 *  .appsearch <query>       – Search for apps
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── APKCombo scraper ──────────────────────────────────────────────────────────
/**
 * Step 1: Search APKCombo and return the first matching app entry.
 * Returns { appPath, packageName, appName } or null.
 */
async function searchApkCombo(query) {
    try {
        const res = await axios.get(`https://apkcombo.com/search/${encodeURIComponent(query)}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 20000
        });
        const html = res.data;
        // Extract first result: href="/app-name/com.package.name/" title="App Name APK"
        const match = html.match(/href="(\/[^"]+\/com\.[^"]+\/)"[^>]*title="([^"]+)"/);
        if (!match) return null;
        const appPath = match[1]; // e.g. /whatsapp-messenger/com.whatsapp/
        const appName = match[2].replace(/ APK$/, '').trim();
        const packageName = appPath.split('/').filter(Boolean).pop();
        return { appPath, packageName, appName };
    } catch (e) {
        console.error('APKCombo search error:', e.message);
        return null;
    }
}

/**
 * Step 2: Get the app page and extract the latest download page URL.
 * Returns { downloadPagePath, version } or null.
 */
async function getDownloadPageUrl(appPath) {
    try {
        const res = await axios.get(`https://apkcombo.com${appPath}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 20000
        });
        const html = res.data;
        // Extract latest version download page: href="/app-name/com.package/download/phone-X.X.X-apk"
        const match = html.match(/href="(\/[^"]+\/download\/phone-([^"]+)-apk)"/);
        if (!match) return null;
        return { downloadPagePath: match[1], version: match[2] };
    } catch (e) {
        console.error('APKCombo app page error:', e.message);
        return null;
    }
}

/**
 * Step 3: Get the checkin fingerprint token from APKCombo.
 * Returns fp string or null.
 */
async function getCheckinFp(packageName) {
    try {
        const res = await axios.post('https://apkcombo.com/checkin',
            `package=${packageName}&arches=arm64-v8a,armeabi-v7a,x86,x86_64&sdkInt=30&type=apk`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://apkcombo.com',
                    'Referer': 'https://apkcombo.com/'
                },
                timeout: 15000
            }
        );
        const fpMatch = String(res.data).match(/fp=([a-f0-9]+)/);
        return fpMatch ? fpMatch[1] : null;
    } catch (e) {
        console.error('APKCombo checkin error:', e.message);
        return null;
    }
}

/**
 * Step 4: Get the download page with the fp token and extract the direct APK URL.
 * APKCombo uses a JavaScript redirect — we look for the apkflash.com CDN URL
 * or any direct download URL embedded in the page.
 * Returns direct download URL string or null.
 */
async function getDirectApkUrl(downloadPagePath, fp) {
    try {
        const url = `https://apkcombo.com${downloadPagePath}?fp=${fp}`;
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://apkcombo.com/'
            },
            timeout: 25000
        });
        const html = res.data;

        // Look for direct CDN download URLs (apkflash.com or similar CDNs)
        // Pattern 1: CDN URL in script or data attributes
        const cdnPatterns = [
            /https?:\/\/[a-z0-9.-]+apkflash\.com\/files\/[^"<>\s]+\.apk/gi,
            /https?:\/\/[a-z0-9.-]+\.apkflash\.com\/[^"<>\s]+\.apk/gi,
            /https?:\/\/[a-z0-9.-]+\/files\/[^"<>\s]+\.apk/gi,
            /"(https?:\/\/[^"]+\.apk[^"]*)"/gi,
        ];

        for (const pattern of cdnPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                // Filter out the installer APK (apkcombo-installer.apk)
                const filtered = matches.filter(u => !u.includes('apkcombo-installer') && !u.includes('apkcombo.app'));
                if (filtered.length > 0) {
                    // Clean up quotes if present
                    return filtered[0].replace(/^"|"$/g, '');
                }
            }
        }

        // Pattern 2: Look for download redirect URL in meta refresh or window.location
        const redirectMatch = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+\.apk[^"']*)["']/i);
        if (redirectMatch) return redirectMatch[1];

        const metaMatch = html.match(/<meta[^>]+http-equiv="refresh"[^>]+content="[^"]*url=([^"]+\.apk[^"]*)"[^>]*>/i);
        if (metaMatch) return metaMatch[1];

        return null;
    } catch (e) {
        console.error('APKCombo download page error:', e.message);
        return null;
    }
}

/**
 * Full APKCombo download flow.
 * Returns { appName, version, downloadUrl } or null.
 */
async function getApkFromApkCombo(query) {
    // Step 1: Search
    const searchResult = await searchApkCombo(query);
    if (!searchResult) return null;

    const { appPath, packageName, appName } = searchResult;

    // Step 2: Get download page URL
    const pageResult = await getDownloadPageUrl(appPath);
    if (!pageResult) return null;

    const { downloadPagePath, version } = pageResult;

    // Step 3: Get checkin fp token
    const fp = await getCheckinFp(packageName);
    if (!fp) return null;

    // Step 4: Get direct APK URL
    const downloadUrl = await getDirectApkUrl(downloadPagePath, fp);
    if (!downloadUrl) return null;

    return { appName, version, downloadUrl, packageName };
}

// ── Fallback: try old third-party APIs ───────────────────────────────────────
async function getApkFromApi(query) {
    const apis = [
        `https://apis-keith.vercel.app/download/apk?query=${encodeURIComponent(query)}`,
        `https://api.xteam.xyz/apk?q=${encodeURIComponent(query)}`,
        `https://api.ryzendesu.vip/api/downloader/apk?query=${encodeURIComponent(query)}`
    ];
    for (const apiUrl of apis) {
        try {
            const res = await axios.get(apiUrl, { timeout: 12000 });
            const data = res.data;
            if (data && (data.result || data.data || data.url || data.download)) {
                return data.result || data.data || data;
            }
        } catch {
            continue;
        }
    }
    return null;
}

// ── Play Store search ─────────────────────────────────────────────────────────
async function searchPlayStore(query) {
    try {
        const res = await axios.get(
            `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 10000
            }
        );
        const html = res.data;
        const titleMatch = html.match(/<span jsname="[^"]*"[^>]*>([^<]{3,50})<\/span>/g);
        const appNames = titleMatch
            ? titleMatch.slice(0, 5).map(m => m.replace(/<[^>]+>/g, '').trim()).filter(n => n.length > 2)
            : [];
        return appNames;
    } catch {
        return [];
    }
}

// ── Main command handler ──────────────────────────────────────────────────────
async function appDownloadCommand(sock, chatId, message) {
    const rawText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, {
            text: `📱 *App Download Commands*\n\n*.apk <app name>* – Download an APK\n*.app <app name>* – Same as .apk\n*.appinfo <app name>* – Get app info\n*.appsearch <query>* – Search apps\n\n_Example: .apk WhatsApp_\n_Example: .apk Spotify_\n\n💡 Powered by ZetFlash Bot 🤖`
        }, { quoted: message });
    }

    // ── App search ──────────────────────────────────────────────────────────
    if (cmd === '.appsearch') {
        await sock.sendMessage(chatId, { text: `🔍 Searching for *${query}*...` }, { quoted: message });
        try {
            const results = await searchPlayStore(query);
            if (results.length === 0) {
                return sock.sendMessage(chatId, { text: `❌ No apps found for *${query}*.` }, { quoted: message });
            }
            const list = results.slice(0, 8).map((n, i) => `${i + 1}. ${n}`).join('\n');
            return sock.sendMessage(chatId, {
                text: `📱 *Search Results for "${query}"*\n\n${list}\n\n_Use .apk <name> to download_`
            }, { quoted: message });
        } catch (e) {
            return sock.sendMessage(chatId, { text: '❌ Search failed. Please try again.' }, { quoted: message });
        }
    }

    // ── App info ────────────────────────────────────────────────────────────
    if (cmd === '.appinfo') {
        await sock.sendMessage(chatId, { text: `🔍 Getting info for *${query}*...` }, { quoted: message });
        try {
            const searchResult = await searchApkCombo(query);
            if (searchResult) {
                const pageResult = await getDownloadPageUrl(searchResult.appPath);
                const version = pageResult ? pageResult.version : 'Unknown';
                return sock.sendMessage(chatId, {
                    text: `📱 *App Info: ${searchResult.appName}*\n\n📦 Package: ${searchResult.packageName}\n🔢 Version: ${version}\n\n_Use .apk ${query} to download_`
                }, { quoted: message });
            }
            return sock.sendMessage(chatId, {
                text: `📱 *${query}*\n\n🔗 Search on Google Play:\nhttps://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps`
            }, { quoted: message });
        } catch (e) {
            return sock.sendMessage(chatId, { text: '❌ Failed to get app info.' }, { quoted: message });
        }
    }

    // ── APK Download ────────────────────────────────────────────────────────
    await sock.sendMessage(chatId, {
        text: `⏳ Searching and downloading *${query}*...\n💡 _This may take up to 30 seconds_`
    }, { quoted: message });

    // --- Try APKCombo scraper first (sends actual file) ---
    try {
        const result = await getApkFromApkCombo(query);
        if (result && result.downloadUrl) {
            const { appName, version, downloadUrl } = result;
            const fileName = `${appName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${version}.apk`;

            // Download the APK to a temp file then send it
            const tmpPath = path.join('/tmp', fileName);
            try {
                await sock.sendMessage(chatId, {
                    text: `📱 *${appName}* v${version}\n⬇️ Downloading APK file...`
                }, { quoted: message });

                const dlRes = await axios({
                    method: 'GET',
                    url: downloadUrl,
                    responseType: 'stream',
                    timeout: 120000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://apkcombo.com/'
                    },
                    maxRedirects: 10
                });

                const writer = fs.createWriteStream(tmpPath);
                dlRes.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    setTimeout(() => reject(new Error('Download timeout')), 110000);
                });

                const stats = fs.statSync(tmpPath);
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

                // Send the actual APK file
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(tmpPath),
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: fileName,
                    caption: `📱 *${appName}*\n🔢 Version: ${version}\n📏 Size: ${sizeMB} MB\n\n_Downloaded by ZetFlash Bot 🤖_`
                }, { quoted: message });

                // Cleanup temp file
                try { fs.unlinkSync(tmpPath); } catch {}
                return;

            } catch (dlErr) {
                // Cleanup on error
                try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
                console.error('APK file download error:', dlErr.message);

                // Try sending via URL directly (Baileys will stream it)
                try {
                    await sock.sendMessage(chatId, {
                        document: { url: downloadUrl },
                        mimetype: 'application/vnd.android.package-archive',
                        fileName: fileName,
                        caption: `📱 *${appName}*\n🔢 Version: ${version}\n\n_Downloaded by ZetFlash Bot 🤖_`
                    }, { quoted: message });
                    return;
                } catch (urlErr) {
                    console.error('APK URL send error:', urlErr.message);
                    // Fall through to fallback
                }
            }
        }
    } catch (comboErr) {
        console.error('APKCombo flow error:', comboErr.message);
    }

    // --- Fallback: try old third-party APIs ---
    try {
        const result = await getApkFromApi(query);
        if (result && (result.downloadUrl || result.url || result.link || result.download)) {
            const downloadUrl = result.downloadUrl || result.url || result.link || result.download;
            const appName = result.name || result.title || query;
            const version = result.version || result.versionName || '';
            const size = result.size || result.fileSize || '';
            const fileName = `${appName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}${version ? '_' + version : ''}.apk`;

            try {
                await sock.sendMessage(chatId, {
                    document: { url: downloadUrl },
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: fileName,
                    caption: `📱 *${appName}*${version ? `\n🔢 Version: ${version}` : ''}${size ? `\n📏 Size: ${size}` : ''}\n\n_Downloaded by ZetFlash Bot 🤖_`
                }, { quoted: message });
                return;
            } catch (dlErr) {
                console.error('Fallback API send error:', dlErr.message);
            }
        }
    } catch (apiErr) {
        console.error('Fallback API error:', apiErr.message);
    }

    // --- Last resort: inform user ---
    return sock.sendMessage(chatId, {
        text: `❌ *Could not download "${query}"*\n\n_The APK could not be fetched automatically. Please try again or search manually:_\n\n🔗 *APKCombo:*\nhttps://apkcombo.com/search/${encodeURIComponent(query)}/\n\n🔗 *APKPure:*\nhttps://apkpure.com/search?q=${encodeURIComponent(query)}\n\n🔗 *Google Play:*\nhttps://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps`
    }, { quoted: message });
}

module.exports = { appDownloadCommand };
