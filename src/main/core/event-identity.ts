import crypto from 'crypto';
export function eventIdentity(computer: string, channel: string, recordId: string | undefined, timestamp: number, eventId: number, message: string): string {
  return crypto.createHash('sha256').update(JSON.stringify([computer.toLowerCase(), channel.toLowerCase(), recordId || null, timestamp, eventId, recordId ? null : message])).digest('hex');
}
