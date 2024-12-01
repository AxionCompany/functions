import { IsolateTransport, IsolateTransportConfig, IsolateAddress } from '../types.ts';

export function createWorkerTransport(config: IsolateTransportConfig = {}): IsolateTransport {
    const workers = new Map<string, Worker>();

    return {
        createAddress: (config: { workerId: string, worker: Worker }): IsolateAddress => {
            workers.set(config.workerId, config.worker);
            return {
                type: 'worker',
                workerId: config.workerId,
                url: `worker://${config.workerId}`
            };
        },

        send: async (address: IsolateAddress, data: any) => {
            if (address.type !== 'worker') {
                throw new Error(`Invalid transport type: ${address.type}`);
            }

            const worker = workers.get(address.workerId!);
            if (!worker) {
                throw new Error(`No worker found for ID ${address.workerId}`);
            }

            return new Promise((resolve, reject) => {
                const messageHandler = (event: MessageEvent) => {
                    worker.removeEventListener('message', messageHandler);
                    resolve(new Response(event.data.body, {
                        status: event.data.status,
                        headers: event.data.headers,
                        statusText: event.data.statusText,
                    }));
                };

                const errorHandler = (error: ErrorEvent) => {
                    worker.removeEventListener('error', errorHandler);
                    reject(error);
                };

                worker.addEventListener('message', messageHandler);
                worker.addEventListener('error', errorHandler);
                worker.postMessage({
                    ...data,
                    __worker__: true
                });
            });
        },

        healthCheck: async (address: IsolateAddress) => {
            try {
                const response = await this.send(address, { pathname: '/__healthcheck__' });
                return response.ok;
            } catch {
                return false;
            }
        },

        waitForReady: async (address: IsolateAddress, timeout = 60000) => {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                if (await this.healthCheck(address)) {
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error(`Timed out waiting for worker ${address.workerId}`);
        }
    };
} 