import { NextFunction } from 'express';
import { eventEmitter } from '../events/eventEmmiter'
import { EventTypes } from '../types' 
import { DroneHandler } from '../handlers/DroneHandler';
import { BadRequest } from '../utils/errors/errors';


export const handleTopics = (req: any, res: any, next: NextFunction) => {
    if (!req.body) {
        throw new BadRequest('Missing data');  
    }
    try {     
        eventEmitter.emit(EventTypes.HANDLE_TOPICS, req.body)
        res.status(200).send({ message: "File uploaded successfully."});
    } catch (err) {
        next(err)
    }
}

export const fetchDrones = (req: any, res: any, next: NextFunction) => {
    
    if (!req.body) {
        throw new BadRequest('Missing data');  
    }
    try {  
        const drones = DroneHandler.getDrones()   
        res.status(200).send(drones);
    } catch (err) {
        next(err)
    }
}

export const redirectLogs = (req: any, res: any, next: NextFunction) => {
    
    if (!req.body) {
        throw new BadRequest('Missing data');  
    }
    try {  
        eventEmitter.emit(EventTypes.REDIRECT, req.body)
        res.status(200).send({ message: "logs redirected successfully."});
    } catch (err) {
        next(err)
    }
}

export const loadLogs = (req: any, res: any, next: NextFunction) => {
    if (!req.query) {
        throw new BadRequest('Missing data');  
    }
    try {  
        DroneHandler.loadLogs(req.query, res)

    } catch (err) {
        next(err)
    }
}
