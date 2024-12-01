import { connect } from "https://deno.land/x/nats@v1.16.0/src/mod.ts";
import { IsolateTransport, IsolateTransportConfig, IsolateAddress } from '../types.ts';

export function createNatsTransport(servers = "nats://localhost:4222", config: IsolateTransportConfig = {}): IsolateTransport {
    const nc = await connect({ servers });

    return {
        createAddress: (config: { isolateId: string }): IsolateAddress => ({
            type: 'nats',
            subject: `isolate.${config.isolateId}`,
            url: `nats://${servers}/${config.isolateId}`
        }),

        send: async (address: IsolateAddress, data: any) => {
            if (address.type !== 'nats') {
                throw new Error(`Invalid transport type: ${address.type}`);
            }

            const response = await nc.request(address.subject!, JSON.stringify({
                ...data,
                __nats__: true
            }));
            
            const responseData = JSON.parse(new TextDecoder().decode(response.data));
            return new Response(responseData.body, {
                status: responseData.status,
                headers: responseData.headers,
                statusText: responseData.statusText,
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
            throw new Error(`Timed out waiting for isolate at ${address.url}`);
        }
    };
} 