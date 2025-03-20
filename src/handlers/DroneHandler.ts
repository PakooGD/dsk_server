import { eventEmitter } from '../events/eventEmmiter';
import { EventTypes, TopicSchema, TopicStatus, Drone, TopicData } from '../types';
import { OperationFailed } from '../utils/errors/errors';
import { drones } from '../services/authorization';
import WebSocket from 'ws'; 
import { FoxgloveServer } from '@foxglove/ws-protocol';

const { WebSocketServer } = require("ws");

export const Schemas = new Map<string, TopicSchema[]>();
const textEncoder = new TextEncoder();
export const SchemasSubsribed = new Map<string, string[]>();

interface DataVisualizer {
    visualizeData(droneId: string, data: any): Promise<void>;
    close?(): void; 
}

const visualizers = new Map<string, DataVisualizer>();

export class DroneHandler {

    public static saveSchemas(drone_id: string, schemas: TopicSchema[]): void {
        if (!schemas) {
            console.error('Schemas are undefined');
        }
        try {
            Schemas.set(drone_id, schemas);
        } catch (err) {
            throw new OperationFailed('Failed to save file');
        }
    }

    public static getSchemas = (drone_id: string): TopicSchema[] => {
        try {
            const result: TopicSchema[] = Schemas.get(drone_id) || [];
            return result;
        } catch (err) {
            throw new OperationFailed('Failed to get schemas');
        }
    };

    public static getDroneActiveTopics = (drone_id: string): number => {
        try {
            const count: number = Schemas.get(drone_id)?.length || 0;
            return count;
        } catch (err) {
            throw new OperationFailed('Failed to get count of active topics');
        }
    };

    public static getDrones = (): Drone[] => {
        try {
            const Drones: Drone[] = [];
            Array.from(drones.keys()).forEach((id) => {
                const schemas = this.getSchemas(id);
                Drones.push({ id, schemas });
            });
            return Drones;
        } catch (err) {
            throw new OperationFailed('Failed to get Ids');
        }
    };

    public static async handleTopics(data: any): Promise<void> {
        try {
            const connection = drones.get(data.drone_id);
            const topicsToProceed: TopicStatus[] = data.topics;

            const toSubsrcibeSchemas: string[] = []

            topicsToProceed.forEach(topic => {
                if (topic.status) {
                    connection.send(JSON.stringify({ type: 'subscribe', topic: topic.schemaName }));
                    toSubsrcibeSchemas.push(topic.schemaName)
                } else {
                    connection.send(JSON.stringify({ type: 'unsubscribe', topic: topic.schemaName }));
                }
            });

            SchemasSubsribed.set(data.drone_id, toSubsrcibeSchemas)

        } catch (err) {
            throw new OperationFailed('Failed');
        }
    }

    public static setVisualizerByPath(data: any): void {
        try {
            // Закрываем текущий визуализатор, если он существует
            const currentVisualizer = visualizers.get(data.droneId);
            if (currentVisualizer && typeof currentVisualizer.close === 'function') {
                currentVisualizer.close();
            }

            // Создаем новый визуализатор
            let visualizer: DataVisualizer;
            switch (data.selectedPath) {
                case 'site':
                    visualizer = new ReactVisualizer();
                    break;
                case 'foxglove':
                    visualizer = new FoxgloveVisualizer();
                    break;
                case 'rerun':
                    visualizer = new RerunVisualizer();
                    break;
                default:
                    throw new Error(`Unknown visualizer path: ${data.selectedPath}`);
            }

            // Сохраняем визуализатор
            visualizers.set(data.droneId, visualizer);
            console.log(`Visualizer for drone ${data.droneId} set to ${data.selectedPath}`);
        } catch (err) {
            throw new OperationFailed(`Failed to set visualizer: ${err}`);
        }
    }

    public static async sendData(droneId: string, data: any): Promise<void> {
        try {
            const visualizer = visualizers.get(droneId);
            if (visualizer) {
                await visualizer.visualizeData(droneId, data);
            } else {
                console.error(`No visualizer configured for drone ${droneId}`);
            }
        } catch (err) {
            throw new OperationFailed('Failed to send data');
        }
    }
}

class ReactVisualizer implements DataVisualizer {
    private server: WebSocket.Server | null = null;
    private clients: Set<WebSocket> = new Set();

    constructor() {}

    private initializeWebSocketServer() {
        if (this.server) return; 
        this.server = new WebSocket.Server({ port: 8083 });

        this.server.on('connection', (socket) => {
            this.clients.add(socket);

            socket.on('close', () => {
                this.clients.delete(socket);
            });
        });
        
    }

    async visualizeData(droneId: string, data: any): Promise<void> {
        this.initializeWebSocketServer();
    
        console.log(`Sending message to ${this.clients.size} clients:`);
    
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    close() {
        console.log('close')
        if (this.server) {
            this.server.close();
            this.server = null;
            this.clients.clear();
            console.log('WebSocket server closed');
        }
    }
}

class FoxgloveVisualizer implements DataVisualizer {   
    private server: FoxgloveServer | null = null;
    private ws: any | null = null;
    private Channels = new Map<string, number | undefined>();
    private clients: Set<FoxgloveServer> = new Set();

    constructor() {}

    private initializeWebSocketServer() {
        if (this.server) return; 

        this.server = new FoxgloveServer({ name: "px4-foxglove-bridge" });
        this.ws = new WebSocketServer({
            port: 8081,
            handleProtocols: (protocols:any) => this.server?.handleProtocols(protocols),
        });

        this.ws.on("connection", (conn:any, req:any) => {
            const name = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
            this.clients.add(conn);

            conn.on('close', () => {
                this.clients.delete(conn);
            });
            this.server?.handleConnection(conn, name);
        });
    }

    async visualizeData(droneId: string, data: TopicData): Promise<void> {
        this.initializeWebSocketServer();

        //костыль
        this.Channels.forEach((id:any, name:any) => {
            this.server?.removeChannel(id)
        })

        data = JSON.parse(data.toString());

        const schemas = Schemas.get(droneId)?.filter(schema => SchemasSubsribed.get(droneId)?.includes(schema.schemaName))

        schemas?.forEach(schema=> {
            const channelId = this.server?.addChannel({
                topic: schema.topic,
                encoding: schema.encoding,
                schemaName: schema.schemaName,
                schema: schema.schema,
            });
            this.Channels.set(schema.schemaName, channelId);
        })
        
        await this.server?.sendMessage(
            this.Channels.get(data.topic)!,
            BigInt(data.timestamp),
            textEncoder.encode(JSON.stringify(data.data, (_, v) => typeof v === 'bigint' ? v.toString() : v)),
        );
    }

    close() {
        if (this.ws && this.server) {
            this.ws.close();
            this.ws = null;
            this.server = null;
            this.clients.clear();
        }
    }
}

class RerunVisualizer implements DataVisualizer {
    async visualizeData(data: any): Promise<void> {
        // Отправка данных в Rerun (например, через WebSocket или API)
        console.log("Visualizing data in Rerun:", data);
    }
}