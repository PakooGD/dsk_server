import { NextFunction } from 'express';
import { eventEmitter } from '../events/eventEmmiter'
import { EventTypes } from '../types' 
import { ErrorHandler, BadRequest, OperationFailed } from '../utils/errors';

export const saveLog = (req: any, res: any, next: NextFunction) => {
    if (!req.file) {
        throw new BadRequest('Missing file');  
    }
    try {     
        eventEmitter.emit(EventTypes.UPLOAD_FILE, req.file)
        res.status(200).send({ message: "File uploaded successfully."});
    } catch (err) {
        next(err)
    }
};

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
