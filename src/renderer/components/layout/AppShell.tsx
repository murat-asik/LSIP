import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="app-container">
      <div className="main-layout">
        <Sidebar />
        <div className="content-container">
          <TopBar />
          <div className="page-scroll">
            {children}
          </div>
          <StatusBar />
        </div>
      </div>
    </div>
  );
};
export default AppShell;
