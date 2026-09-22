export interface IpcRequest<T = any> {
  id: string;
  module: string;
  action: string;
  payload: T;
  timestamp: number;
}

export interface IpcResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  duration: number;
}

export interface IpcStreamEvent<T = any> {
  channel: string;
  type: 'data' | 'error' | 'end';
  payload: T;
  timestamp: number;
}
