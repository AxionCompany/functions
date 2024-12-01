import { IsolateTransport, IsolateTransportConfig } from './types.ts';
import { createHttpTransport } from './http/http.ts';

let transportInstance: IsolateTransport | null = null;

export const initializeTransport = (customTransport?: IsolateTransport): IsolateTransport => {
    if (customTransport) {
        transportInstance = customTransport;
    } else if (!transportInstance) {
        transportInstance = createHttpTransport();
    }
    return transportInstance;
};

export const getTransport = (): IsolateTransport => {
    if (!transportInstance) {
        return initializeTransport();
    }
    return transportInstance;
};

// Re-export transport creators
export { createHttpTransport } from './http/http.ts';
export { createNatsTransport } from './nats/nats.ts';
export { createWorkerTransport } from './worker/worker.ts'; 