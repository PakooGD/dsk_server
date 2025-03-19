import { FoxgloveServer } from '@foxglove/ws-protocol';
import  { TopicSchema }  from '../../types'

export const Channels = new Map<string, number>();

export const processSchemas = async (server: FoxgloveServer, topicSchema: TopicSchema) => {

    const channelId = server.addChannel({
      topic: topicSchema.topic,
      encoding: topicSchema.encoding,
      schemaName: topicSchema.schemaName,
      schema: JSON.stringify(topicSchema.schema),
    });

    Channels.set(topicSchema.schemaName, channelId);
};

export const getSchemaNameByChannelId = (chanId: number | string) => {
    return Array.from(Channels.entries()).find(([_, id]) => id === chanId)?.[0]
}

