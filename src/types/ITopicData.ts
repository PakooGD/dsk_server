export interface TopicData {
    name: string;
    topic: string;
    timestamp: bigint;
    data: Record<string, any>;
}
