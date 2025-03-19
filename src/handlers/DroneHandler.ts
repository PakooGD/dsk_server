import { eventEmitter } from '../events/eventEmmiter'
import { EventTypes, TopicSchema,TopicStatus } from '../types' 
import { OperationFailed } from '../utils/errors/errors';
import { drones } from '../services/authorization';

export const Schemas = new Map<string, any>();

export class DroneHandler {

    public static async saveSchema(drone_id: string, schema: TopicSchema): Promise<void> {
        try {
            Schemas.set(drone_id, schema);
        } catch (err) {
            throw new OperationFailed('Failed to save file');  
        }
    }

    public static getSchemas = (drone_id: string): TopicSchema[] => {
        try {
            const result: TopicSchema[] = [];       
            Schemas.forEach((schema: TopicSchema, key: string) => {
                if (key === drone_id) { 
                    result.push(schema);
                }
            });
            return result;
        } catch (err) {
            throw new OperationFailed('Failed to get schemas');
        }
    };

    public static getDroneActiveTopics = (drone_id: string): number => {
        try {
            const count: number = Schemas.get(drone_id)?.length;
            return count;
        } catch (err) {
            throw new OperationFailed('Failed to get count of active topics');
        }
    };

    public static getDroneIds = (): string[] => {
        try {
            const ids: string[] = Array.from(drones.keys())
            return ids;
        } catch (err) {
            throw new OperationFailed('Failed to get Ids');
        }
    };

    public static async handleTopics(drone_id: string, topics: TopicStatus[], ): Promise<void> {
        try {
            const connection = drones.get(drone_id)

            topics.forEach(topic => {
                if (topic.status) {
                    connection.send(JSON.stringify({ type: 'subscribe', topic: topic.schemaName }))
                } else {
                    connection.send(JSON.stringify({ type: 'unsubscribe', topic: topic.schemaName }))
                }        
            });
        } catch (err) {
            throw new OperationFailed('Failed');  
        }
    }
}