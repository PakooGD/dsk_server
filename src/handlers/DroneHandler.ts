import { EventTypes, TopicSchema, TopicStatus, Drone, TopicData } from '../types';
import { OperationFailed } from '../utils/errors/errors';
import { drones } from '../services/authorization';
import WebSocket from 'ws'; 
import { MessageType, ULog } from "@foxglove/ulog";

import { clients,server } from '../app';

export const Schemas = new Map<string, TopicSchema[]>();
const textEncoder = new TextEncoder();
export const SchemasSubsribed = new Map<string, string[]>();


interface DataVisualizer {
    visualizeData(droneId: string, data: any): Promise<void>;
}

const visualizers = new Map<string, DataVisualizer>();
const Channels = new Map<string, Map<string, number>>();

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

    public static async sendFile( file: any, droneId?: string ): Promise<void> {
        if (!file) {
            console.error('file is undefined');
        }
        try {
            const ulog = new ULog(file);
            await ulog.open(); 
            const messages = await ulog.readMessages()
            const message = {
                source: `ulog ${file}`,
                content: messages,
            }
            // логика отправки файла
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
                    // const id = Channels.get(data.drone_id)!.get(topic.schemaName)!
                    // server?.removeChannel(id);
                    // Channels.get(data.drone_id)!.delete(topic.schemaName);
                    connection.send(JSON.stringify({ type: 'unsubscribe', topic: topic.schemaName }));
                }
            });

            SchemasSubsribed.set(data.drone_id, toSubsrcibeSchemas)

            if(SchemasSubsribed.get(data.drone_id)?.length == 0){    
                Channels.get(data.drone_id)!.forEach(id => {
                    server?.removeChannel(id);
                })
               
            } 

        } catch (err) {
            throw new OperationFailed('Failed');
        }
    }

    public static setVisualizerByPath(data: any): void {
        try {
            let visualizer: DataVisualizer = new ReactVisualizer();;

            switch (data.selectedPath) {
                case 'site':
                    visualizer = new ReactVisualizer();
                    break;
                case 'foxglove':
                    visualizer = new FoxgloveVisualizer();
                    break;
                default:
                    throw new Error(`Unknown visualizer path: ${data.selectedPath}`);
            }

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
                visualizers.set(data.droneId, new ReactVisualizer());
            }
        } catch (err) {
            throw new OperationFailed('Failed to send data');
        }
    }
}

class ReactVisualizer implements DataVisualizer {
    async visualizeData(droneId: string, data: any): Promise<void> {
        const message = JSON.stringify({
            source: droneId,
            content: data
        });
      
        Array.from(clients.values()).forEach((client) => {
            if (client?.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

class FoxgloveVisualizer implements DataVisualizer {
    async visualizeData(droneId: string, data: any): Promise<void> {
        data = JSON.parse(data);


        // Получаем схемы топиков для данного дрона
        const schemasToAddChannel = Schemas.get(droneId)?.filter(schema =>
            SchemasSubsribed.get(droneId)?.includes(schema.schemaName)
        );

        // Инициализируем вложенный словарь для дрона, если его нет
        if (!Channels.has(droneId)) {
            Channels.set(droneId, new Map<string, number>());
        }
        const droneChannels = Channels.get(droneId)!;


        // Удаляем каналы, которые больше не используются для данного дрона
        const channelsToRemove: string[] = [];
        droneChannels.forEach((channelId, schemaName) => {
            // Проверяем, что канал больше не нужен
            const isChannelNeeded = schemasToAddChannel?.some(
                schema => schema.schemaName === schemaName
            );

            // Если schemasToAddChannel пуст или канал больше не нужен, помечаем его для удаления
            if (schemasToAddChannel === undefined || !isChannelNeeded) {
                channelsToRemove.push(schemaName);
            }
        });

        // Удаляем помеченные каналы
        channelsToRemove.forEach(schemaName => {
            const channelId = droneChannels.get(schemaName);
            if (channelId !== undefined) {
                try {
                    server?.removeChannel(channelId);
                    droneChannels.delete(schemaName);
                } catch (err) {
                    console.error(`Failed to remove channel ${schemaName}:`, err);
                }
            }
        });

        // Создаем новые каналы для активных топиков данного дрона
        schemasToAddChannel?.forEach(schema => {
            const schemaName = schema.schemaName;
            if (!droneChannels.has(schemaName)) {
                try {
                    const channelId = server?.addChannel({
                        topic: `${schema.topic} [${droneId}]`,
                        encoding: schema.encoding,
                        schemaName: schemaName,
                        schema: JSON.stringify(schema.schema, (_, v) => typeof v === 'bigint' ? v.toString() : v),
                    });
                    if (channelId !== undefined) {
                        droneChannels.set(schemaName, channelId);
                    } else {
                        console.error(`Failed to create channel ${schemaName}`);
                    }
                } catch (err) {
                    console.error(`Error creating channel ${schemaName}:`, err);
                }
            }
        });

        // Отправляем данные через соответствующий канал
        const schemaName = data.topic;
        const channelId = droneChannels.get(schemaName);
        if (channelId !== undefined) {
            try {
                await server?.sendMessage(
                    channelId,
                    BigInt(data.timestamp),
                    textEncoder.encode(JSON.stringify(data.data, (_, v) => typeof v === 'bigint' ? v.toString() : v)),
                );
            } catch (err) {
                console.error(`Failed to send data through channel ${schemaName}:`, err);
            }
        } else {
            console.error(`Channel ${schemaName} not found for drone ${droneId}`);
        }
    }
}

