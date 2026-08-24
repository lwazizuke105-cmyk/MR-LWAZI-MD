/**
 * 🕐 GROUP TIME DISPLAY
 * ZetFlash RST Bot
 *
 * Shows the current time at the top of group messages.
 * Supports multiple timezones.
 */

/**
 * Get a formatted time header for group messages.
 * @param {string} timezone - e.g. 'Africa/Johannesburg', 'UTC', 'America/New_York'
 * @returns {string} Formatted time string
 */
function getGroupTimeHeader(timezone = 'Africa/Johannesburg') {
    try {
        const now = new Date();
        const options = {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        const formatted = now.toLocaleString('en-ZA', options);
        // Get day period
        const hour = parseInt(now.toLocaleString('en-ZA', { timeZone: timezone, hour: '2-digit', hour12: false }));
        let period = '🌙';
        if (hour >= 5 && hour < 12) period = '🌅';
        else if (hour >= 12 && hour < 17) period = '☀️';
        else if (hour >= 17 && hour < 20) period = '🌆';
        return `${period} *${formatted}*`;
    } catch {
        return `🕐 *${new Date().toUTCString()}*`;
    }
}

/**
 * Get a short time string (HH:MM) for a given timezone.
 */
function getShortTime(timezone = 'Africa/Johannesburg') {
    try {
        return new Date().toLocaleTimeString('en-ZA', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch {
        return new Date().toLocaleTimeString();
    }
}

/**
 * Build a full time banner for group messages.
 * @param {string} groupName - The group name
 * @param {string} timezone - Timezone string
 */
function buildTimeBanner(groupName, timezone = 'Africa/Johannesburg') {
    const header = getGroupTimeHeader(timezone);
    return `╔══════════════════╗\n║ ${header}\n║ 📍 ${groupName || 'Group'}\n╚══════════════════╝`;
}

module.exports = { getGroupTimeHeader, getShortTime, buildTimeBanner };
