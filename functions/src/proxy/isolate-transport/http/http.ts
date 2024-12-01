import { IsolateTransport, IsolateTransportConfig, IsolateAddress } from '../types.ts';

export function createHttpTransport(config: IsolateTransportConfig = {}): IsolateTransport {
    return {
        createAddress: (config: { port: number }): IsolateAddress => ({
            type: 'http',
            port: config.port,
            url: `http://localhost:${config.port}`
        }),

        send: async (address: IsolateAddress, data: any) => {
            if (address.type !== 'http') {
                throw new Error(`Invalid transport type: ${address.type}`);
            }

            const response = await fetch(`${address.url}${data.pathname || ''}${data.search || ''}`, {
                method: data.method || 'GET',
                headers: data.headers,
                body: data.body,
                redirect: "manual",
            });
            return response;
        },

        healthCheck: async (address: IsolateAddress) => {
            if (address.type !== 'http') {
                throw new Error(`Invalid transport type: ${address.type}`);
            }

            try {
                const response = await fetch(`${address.url}/__healthcheck__`);
                return response.ok;
            } catch {
                return false;
            }
        },

        waitForReady: async (address: IsolateAddress, timeout = 60000) => {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                try {
                    if (await this.healthCheck(address)) {
                        return;
                    }
                } catch {
                    // Ignore errors and continue polling
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error(`Timed out waiting for isolate at ${address.url}`);
        }
    };
} 