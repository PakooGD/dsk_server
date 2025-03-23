// src/events/eventEmitter.ts
import { EventEmitter } from 'events';
import { EventTypes } from '../types' 

import { DroneHandler } from '../handlers/DroneHandler';
import { logout } from '../services'

// const rateLimit = require('rate-limit');
// const limitedEventEmitter = rateLimit(eventEmitter, 1000);


export const eventEmitter = new EventEmitter();

eventEmitter.on(EventTypes.SCHEMAS_RECEIVED, DroneHandler.saveSchemas);
eventEmitter.on(EventTypes.HANDLE_TOPICS, DroneHandler.handleTopics);
eventEmitter.on(EventTypes.SEND_DATA, DroneHandler.sendData);
eventEmitter.on(EventTypes.REDIRECT, DroneHandler.setVisualizerByPath);
eventEmitter.on(EventTypes.LOGOUT, logout);
eventEmitter.on(EventTypes.LOAD_LOGS, DroneHandler.loadLogs);
