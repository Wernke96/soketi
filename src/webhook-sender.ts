import { App, WebhookInterface } from './app';
import axios from 'axios';
import { Utils } from './utils';
import { Server } from './server';

export interface ClientEventData {
    name: string;
    channel: string;
    event?: string,
    data?: {
        [key: string]: any;
    };
    socket_id?: string;
    user_id?: string;
}

export class WebhookSender {
    /**
     * Initialize the Webhook sender.
     */
    constructor(protected server: Server) {
        server.queueManager.processQueue('webhooks', (job, done) => {
            let webhook: WebhookInterface = job.data.webhook;
            let headers: { [key: string]: string; } = job.data.headers;
            let data: { [key: string]: any; } = job.data.data;

            axios.post(webhook.url, data, { headers }).then((res) => {
                done();
            }).catch(err => {
                // TODO: Maybe retry exponentially?
                done();
            });
        });
    }

    /**
     * Send a webhook for the client event.
     */
    public sendClientEvent(app: App, channel: string, event: string, data: any, socketId?: string, userId?: string) {
        let formattedData: ClientEventData = {
            name: App.CLIENT_EVENT_WEBHOOK,
            channel,
            event,
            data,
        };

        if (socketId) {
            formattedData.socket_id = socketId;
        }

        if (userId && Utils.isPresenceChannel(channel)) {
            formattedData.user_id = userId;
        }

        this.send(app, formattedData);
    }

    /**
     * Send a member_added event.
     */
    public sendMemberAdded(app: App, channel: string, userId: string): void {
        this.send(app, {
            name: App.MEMBER_ADDED_WEBHOOK,
            channel,
            user_id: userId,
        });
    }

    /**
     * Send a member_removed event.
     */
    public sendMemberRemoved(app: App, channel: string, userId: string): void {
        this.send(app, {
            name: App.MEMBER_REMOVED_WEBHOOK,
            channel,
            user_id: userId,
        });
    }

    /**
     * Send a channel_vacated event.
     */
    public sendChannelVacated(app: App, channel: string): void {
        this.send(app, {
            name: App.CHANNEL_VACATED_WEBHOOK,
            channel,
        });
    }

    /**
     * Send a channel_occupied event.
     */
    public sendChannelOccupied(app: App, channel: string): void {
        this.send(app, {
            name: App.CHANNEL_OCCUPIED_WEBHOOK,
            channel,
        });
    }

    /**
     * Send a webhook for the app with the given data.
     */
    protected send(app: App, data: ClientEventData): void {
        let dataToSend = {
            ...data,
            ...{ time_ms: (new Date).getTime() },
        };

        let headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': `PwsWebhooksAxiosClient/1.0 (Process: ${this.server.options.instance.process_id})`,
            'X-Pusher-Key': app.key,
            'X-Pusher-Signature': app.createWebhookHmac(JSON.stringify(dataToSend)),
        };

        app.webhooks.forEach((webhook: WebhookInterface) => {
            if (webhook.event_types.includes(data.name)) {
                this.server.queueManager.addToQueue('webhooks', {
                    webhook,
                    headers,
                    data: dataToSend,
                });
            }
        });
    }
}