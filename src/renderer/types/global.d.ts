export {};

declare global {
  interface Window {
    lsip: {
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
      send: (channel: string, ...args: unknown[]) => void;
    };
  }
}
