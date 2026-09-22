import { runPowerShell } from '../../core/powershell';
import { SecurityEvent } from '../../../shared/types/event.types';
export const eventChannels = ['Security','System','Application','Setup','Microsoft-Windows-Sysmon/Operational'];
export interface EventCursor { record_id: string; timestamp: string; }
export interface EventPage { events: SecurityEvent[]; cursor: EventCursor; warning?: string; more: boolean; }
export async function readEventPage(channel: string, cursor?: EventCursor, limit = 500): Promise<EventPage> {
  if (!eventChannels.includes(channel) || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid event page request');
  if (cursor && !/^\d+$/.test(cursor.record_id)) throw new Error('Invalid event cursor');
  const input = Buffer.from(JSON.stringify({channel, cursor, limit})).toString('base64');
  const script = `
$ErrorActionPreference='Stop'
$inputData = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${input}')) | ConvertFrom-Json
$channel = $inputData.channel
# GetLogInformation distinguishes an empty log from a missing/inaccessible log.
$session = New-Object System.Diagnostics.Eventing.Reader.EventLogSession
$info = $session.GetLogInformation($channel, [System.Diagnostics.Eventing.Reader.PathType]::LogName)
$after = [long]0; $warning = ''; $timestamp = ''; $rows = @()
if ($inputData.cursor) { $after = [long]$inputData.cursor.record_id; $timestamp = [string]$inputData.cursor.timestamp }
if ($after -gt 0) {
  $anchorQuery = New-Object System.Diagnostics.Eventing.Reader.EventLogQuery($channel, [System.Diagnostics.Eventing.Reader.PathType]::LogName, "*[System[EventRecordID=$after]]")
  $anchorReader = New-Object System.Diagnostics.Eventing.Reader.EventLogReader($anchorQuery)
  try {
    $anchor = $anchorReader.ReadEvent()
    if ($null -eq $anchor -or $anchor.TimeCreated.ToUniversalTime().ToString('o') -ne $timestamp) {
      $after=0; $timestamp=''; $warning='Event log reset or retention gap detected; reading available records again.'
    }
    if ($null -ne $anchor) { $anchor.Dispose() }
  } finally { $anchorReader.Dispose() }
}
$query = New-Object System.Diagnostics.Eventing.Reader.EventLogQuery($channel, [System.Diagnostics.Eventing.Reader.PathType]::LogName, "*[System[EventRecordID > $after]]")
$query.ReverseDirection=$false
$reader=New-Object System.Diagnostics.Eventing.Reader.EventLogReader($query)
try {
  for($i=0; $i -lt $inputData.limit; $i++) {
    $e=$reader.ReadEvent()
    if($null -eq $e) { break }
    try {
      $xml=[xml]$e.ToXml(); $fields=@{}
      foreach($field in $xml.Event.EventData.Data) { if($field.Name) { $fields[$field.Name]=$field.'#text' } }
      $timestamp=$e.TimeCreated.ToUniversalTime().ToString('o'); $after=$e.RecordId
      $description=''; try { $description=$e.FormatDescription() } catch { $description=$e.ToXml() }
      $rows += [PSCustomObject]@{recordId=[string]$e.RecordId; eventId=$e.Id; source=$channel; level=$e.Level; timestamp=$timestamp; computer=$e.MachineName; userSid=[string]$e.UserId; message=$description; xmlData=$e.ToXml(); parsedData=$fields}
    } finally { $e.Dispose() }
  }
} finally { $reader.Dispose(); $session.Dispose() }
[PSCustomObject]@{events=@($rows); cursor=[PSCustomObject]@{record_id=[string]$after; timestamp=$timestamp}; warning=$warning; more=($rows.Count -eq $inputData.limit)} | ConvertTo-Json -Compress -Depth 8
`;
  const output = await new Promise<string>((resolve, reject) => runPowerShell(script, (error, stdout, stderr) => error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout)));
  const page = JSON.parse(output);
  if (!Array.isArray(page.events) || !page.cursor || !/^\d+$/.test(page.cursor.record_id)) throw new Error('Invalid event page response');
  const events = page.events.map((row: any, i: number): SecurityEvent => {
    const timestamp = Date.parse(row.timestamp);
    if (!Number.isFinite(timestamp) || !/^\d+$/.test(row.recordId) || row.source !== channel) throw new Error('Invalid event record');
    return { ...row, id: i, timestamp, userName: row.parsedData?.TargetUserName || '', isBookmarked: false };
  });
  return { events, cursor: page.cursor, warning: page.warning || undefined, more: page.more === true };
}
