import React from 'react';
import { ForensicPanel } from '../../components/common/ForensicPanel';
import { useTranslation } from '../../i18n';
export const DfirRegistryView:React.FC=()=>{const {t}=useTranslation();return <div className="view-container" style={{padding:24,gap:20,overflowY:'auto'}}><h1>{t('workspaces.registryExplorer')}</h1><ForensicPanel type="registry"/></div>};
