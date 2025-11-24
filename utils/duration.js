/**
 * Parse duration strings like "1d", "7d", "30d" into milliseconds
 * @param {string} duration - Duration string (e.g., "1d", "7d", "30d")
 * @returns {number} Duration in milliseconds
 */
function parseDuration(duration) {
    const match = duration.match(/^(\d+)([dhm])$/);
    if (!match) {
        throw new Error('Invalid duration format. Use format like "1d", "7d", "30d"');
    }
    
    const [, amount, unit] = match;
    const value = parseInt(amount, 10);
    
    switch (unit) {
        case 'm': // minutes
            return value * 60 * 1000;
        case 'h': // hours
            return value * 60 * 60 * 1000;
        case 'd': // days
            return value * 24 * 60 * 60 * 1000;
        default:
            throw new Error('Invalid duration unit. Use m (minutes), h (hours), or d (days)');
    }
}

/**
 * Create a Date object representing the expiration time from now + duration
 * @param {string} duration - Duration string (e.g., "1d", "7d", "30d")
 * @returns {Date} Expiration date
 */
function getExpirationDate(duration) {
    const durationMs = parseDuration(duration);
    return new Date(Date.now() + durationMs);
}

/**
 * Check if a date has expired
 * @param {Date} expirationDate - The expiration date to check
 * @returns {boolean} True if expired, false otherwise
 */
function isExpired(expirationDate) {
    return new Date() > expirationDate;
}

module.exports = {
    parseDuration,
    getExpirationDate,
    isExpired
};