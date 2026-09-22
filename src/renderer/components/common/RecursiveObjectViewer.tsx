import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface RecursiveObjectViewerProps {
  data: any;
  name?: string;
  depth?: number;
  maxDepth?: number;
}

export const RecursiveObjectViewer: React.FC<RecursiveObjectViewerProps> = ({
  data,
  name,
  depth = 0,
  maxDepth = 6,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(depth > 1);

  if (data === null || data === undefined) {
    return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>;
  }

  const dataType = typeof data;

  if (dataType === 'boolean') {
    return <span style={{ color: data ? '#4ade80' : '#f87171', fontWeight: 600 }}>{data.toString()}</span>;
  }

  if (dataType === 'number') {
    return <span style={{ color: '#38bdf8', fontWeight: 500 }}>{data}</span>;
  }

  if (dataType === 'string') {
    return <span style={{ color: '#facc15', wordBreak: 'break-all' }}>"{data}"</span>;
  }

  if (dataType !== 'object') {
    return <span style={{ color: 'var(--text-secondary)' }}>{String(data)}</span>;
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);

  if (keys.length === 0) {
    return <span style={{ color: '#9ca3af' }}>{isArray ? '[]' : '{}'}</span>;
  }

  if (depth >= maxDepth) {
    return <span style={{ color: '#9ca3af' }}>{JSON.stringify(data).substring(0, 50)}...</span>;
  }

  return (
    <div style={{ marginLeft: depth === 0 ? '0' : '14px', marginTop: '2px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          color: 'var(--text-primary)',
        }}
      >
        {collapsed ? <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />}
        {name && <span style={{ color: '#c084fc', fontWeight: 600 }}>{name}: </span>}
        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
          {isArray ? `Array(${keys.length}) [` : `Object {`}
        </span>
      </div>

      {!collapsed && (
        <div style={{ borderLeft: '1px dashed rgba(255,255,255,0.1)', paddingLeft: '8px', marginTop: '2px' }}>
          {keys.map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '2px 0' }}>
              <span style={{ color: '#38bdf8' }}>{key}:</span>
              <RecursiveObjectViewer data={data[key]} depth={depth + 1} maxDepth={maxDepth} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
