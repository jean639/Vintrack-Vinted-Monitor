/**
 * Validates if a string is a valid Discord webhook URL.
 * Format: https://discord.com/api/webhooks/ID/TOKEN
 */
export function isValidDiscordWebhook(url: string): boolean {
  const discordWebhookRegex =
    /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[A-Za-z0-9_-]+$/;
  return discordWebhookRegex.test(url);
}
