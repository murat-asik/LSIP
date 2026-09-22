import { t as translateText } from "../i18n";
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { SecurityEvent } from '../../shared/types/event.types';
import {
  Search,
  RefreshCw,
  FileText,
  BookmarkCheck,
  Terminal,
  Bookmark,
} from 'lucide-react';

export const EventExplorer: React.FC = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterLevel, setFilterLevel] = useState<number | ''>('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const filters: Record<string, unknown> = { limit: 150 };
      if (searchQuery.trim()) filters.searchQuery = searchQuery;
      if (filterSource) filters.source = filterSource;
      if (filterLevel !== '') filters.level = Number(filterLevel);
      if (onlyBookmarked) filters.isBookmarked = true;

      const list = await window.lsip.invoke('events:query', filters);
      setEvents(list?.data || []);
    } catch (e) {
      console.error('Failed to query events', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filterSource, filterLevel, onlyBookmarked]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  const handleBookmarkToggle = async (event: SecurityEvent) => {
    try {
      const newStatus = !event.isBookmarked;
      const success = await window.lsip.invoke('events:bookmark', {
        id: event.id,
        bookmarked: newStatus,
      });

      if (success?.data) {
        // Update local state
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, isBookmarked: newStatus } : e))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const getEventLevelBadge = (level: number) => {
    switch (level) {
      case 1: // Critical
      case 2: // Error
        return <span className="status-pill danger">{translateText("interfaceText.message047")}</span>;
      case 3: // Warning
        return <span className="status-pill warning">{translateText("interfaceText.message048")}</span>;
      default: // Information / Verbose
        return <span className="status-pill info">{translateText("interfaceText.message049")}</span>;
    }
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleString();
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: selectedEventId ? '1.5fr 1fr' : '1fr',
        gap: '16px',
        height: 'calc(100vh - var(--topbar-height) - var(--statusbar-height) - 40px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
      }}
    >
      {/* Left Panel: Events List */}
      <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} /> {t('eventExplorerView.eventExplorer')} ({events.length})
            </h2>
            <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder={t('eventExplorerView.searchMessages')}
                className="fluent-input"
                style={{ width: '100%', paddingLeft: '32px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-secondary)' }} />
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Filter Log Source */}
            <select
              className="fluent-input"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={{ padding: '6px 12px' }}
            >
              <option value="">{t('eventExplorerView.allLogs')}</option>
              <option value="Security">{translateText("interfaceText.message050")}</option>
              <option value="System">{translateText("interfaceText.message051")}</option>
              <option value="Application">{translateText("interfaceText.message052")}</option>
              <option value="Setup">{translateText("interfaceText.message053")}</option>
              <option value="Microsoft-Windows-Sysmon/Operational">Sysmon</option>
            </select>

            {/* Filter Severity */}
            <select
              className="fluent-input"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ padding: '6px 12px' }}
            >
              <option value="">{t('eventExplorerView.allSeverities')}</option>
              <option value={2}>{t('eventExplorerView.errorCritical')}</option>
              <option value={3}>{t('eventExplorerView.warning')}</option>
              <option value={4}>{t('eventExplorerView.information')}</option>
            </select>

            {/* Filter Bookmarked */}
            <button
              onClick={() => setOnlyBookmarked(!onlyBookmarked)}
              className="fluent-button"
              style={{
                borderColor: onlyBookmarked ? 'var(--accent-primary-hover)' : undefined,
                color: onlyBookmarked ? 'var(--text-primary)' : undefined,
              }}
            >
              {onlyBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {t('eventExplorerView.bookmarks')}
            </button>

            <button className="fluent-button" onClick={fetchEvents} disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Events Table */}
        <div className="fluent-table-container">
          <table className="fluent-table">
            <thead>
              <tr>
                <th>{t('eventExplorerView.id')}</th>
                <th>{t('eventExplorerView.timeCreated')}</th>
                <th>{t('eventExplorerView.source')}</th>
                <th>{t('eventExplorerView.eventId')}</th>
                <th>{t('eventExplorerView.severity')}</th>
                <th>{t('eventExplorerView.user')}</th>
                <th>{t('eventExplorerView.descriptionSummary')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const isSelected = selectedEventId === e.id;
                
                // Truncate message for grid
                const summary = e.message.split('\n')[0] || '';

                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEventId(e.id)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.12)' : undefined,
                      borderLeft: isSelected ? '3px solid var(--accent-primary)' : undefined,
                    }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{e.id}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatDate(e.timestamp)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {e.source.includes('Sysmon') ? 'Sysmon' : e.source}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{e.eventId}</td>
                    <td>{getEventLevelBadge(e.level)}</td>
                    <td>{e.userName}</td>
                    <td style={{ maxWidth: '300px', textOverflow: 'ellipsis', overflow: 'hidden' }}>{summary}</td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="fluent-empty-state" style={{ minHeight: '150px' }}>
                      <FileText size={32} />
                      <p>{t('eventExplorerView.noEventsFound')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel: Selected Event Details */}
      {selectedEventId && selectedEvent && (
        <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{translateText("interfaceText.message054")} {selectedEvent.eventId}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message055")} {selectedEvent.source}</span>
            </div>
            <button
              onClick={() => handleBookmarkToggle(selectedEvent)}
              className="fluent-button"
              style={{ padding: '6px 12px' }}
            >
              {selectedEvent.isBookmarked ? (
                <BookmarkCheck size={14} style={{ color: 'var(--accent-success)' }} />
              ) : (
                <Bookmark size={14} />
              )}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
            {/* Meta details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('eventExplorerView.computer')}</span>
                <span style={{ fontWeight: 500 }}>{selectedEvent.computer}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('eventExplorerView.userContext')}</span>
                <span style={{ fontWeight: 500 }}>{selectedEvent.userName}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('eventExplorerView.timeCreated')}</span>
                <span style={{ fontWeight: 500 }}>{formatDate(selectedEvent.timestamp)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('eventExplorerView.severity')}</span>
                <span>{getEventLevelBadge(selectedEvent.level)}</span>
              </div>
            </div>

            {/* Parsed key value parameters */}
            {selectedEvent.parsedData && Object.keys(selectedEvent.parsedData).length > 0 && (
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('eventExplorerView.eventParameters')}</span>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    padding: '8px',
                    backgroundColor: 'var(--bg-primary)',
                  }}
                >
                  {Object.entries(selectedEvent.parsedData).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingBottom: '3px', borderBottom: '1px dashed rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{key}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', textAlign: 'right' }}>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw XML */}
            {selectedEvent.xmlData && (
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('eventExplorerView.rawXmlStructure')}</span>
                <div
                  style={{
                    backgroundColor: '#05070c',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    padding: '10px',
                    color: '#34d399',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '3px', marginBottom: '4px' }}>
                    <Terminal size={12} /> {t('eventExplorerView.xmlViewer')}
                  </div>
                  {selectedEvent.xmlData}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setSelectedEventId(null)}
            className="fluent-button"
            style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
          >
            {t('eventExplorerView.closeDetails')}
          </button>
        </div>
      )}
    </div>
  );
};
