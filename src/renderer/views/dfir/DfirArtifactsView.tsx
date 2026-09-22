import React from 'react';
import { ForensicPanel } from '../../components/common/ForensicPanel';
import { useTranslation } from '../../i18n';
interface DfirArtifactsViewProps {artifactType:'prefetch'|'amcache'|'shimcache'|'jumplists'|'srum'|'usn'|'recycle';title:string;}
export const DfirArtifactsView:React.FC<DfirArtifactsViewProps>=({artifactType,title})=>{const {t}=useTranslation();return <div className="view-container" style={{padding:24,gap:20,overflowY:'auto'}}><h1>{t(`dfirArtifacts.${artifactType}Title`)||title}</h1><ForensicPanel type={artifactType}/></div>};
