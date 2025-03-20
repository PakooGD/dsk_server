// src/events/eventEmitter.ts
import { EventEmitter } from 'events';
import { EventTypes } from '../types' 
import { FileHandler } from '../handlers/FileHandler';
import { DroneHandler } from '../handlers/DroneHandler';

// const rateLimit = require('rate-limit');
// const limitedEventEmitter = rateLimit(eventEmitter, 1000);


export const eventEmitter = new EventEmitter();

eventEmitter.on(EventTypes.UPLOAD_FILE, FileHandler.saveFile);
eventEmitter.on(EventTypes.SCHEMAS_RECEIVED, DroneHandler.saveSchemas);
eventEmitter.on(EventTypes.HANDLE_TOPICS, DroneHandler.handleTopics);
eventEmitter.on(EventTypes.SEND_DATA, DroneHandler.sendData);
eventEmitter.on(EventTypes.REDIRECT, DroneHandler.setVisualizerByPath);
