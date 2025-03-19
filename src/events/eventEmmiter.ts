// src/events/eventEmitter.ts
import { EventEmitter } from 'events';
import { EventTypes } from '../types' 
import { FileHandler } from '../handlers/FileHandler';
import { DroneHandler } from '../handlers/DroneHandler';

const rateLimit = require('rate-limit');

export const eventEmitter = new EventEmitter();
const limitedEventEmitter = rateLimit(eventEmitter, 1000);


eventEmitter.on(EventTypes.UPLOAD_FILE, FileHandler.saveFile);
eventEmitter.on(EventTypes.SCHEMAS_RECEIVED, DroneHandler.saveSchema);
eventEmitter.on(EventTypes.HANDLE_TOPICS, DroneHandler.handleTopics);



