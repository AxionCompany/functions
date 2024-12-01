export interface IsolateAddress {
    type: 'http' | 'nats' | 'worker';
    port?: number;          // for HTTP
    subject?: string;       // for NATS
    workerId?: string;      // for Worker
    url?: string;          // generic URL for any transport
}

export interface IsolateTransport {
    send(address: IsolateAddress, data: any): Promise<Response>;
    healthCheck(address: IsolateAddress): Promise<boolean>;
    waitForReady(address: IsolateAddress, timeout?: number): Promise<void>;
    createAddress(config: any): IsolateAddress;
}

export interface IsolateTransportConfig {
    debug?: boolean;
    timeout?: number;
    retries?: number;
} 