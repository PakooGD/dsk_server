import { TopicSchema } from "./ITopicSchema";

export interface Drone{
    id:string;
    schemas:TopicSchema[];
}