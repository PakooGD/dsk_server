import { eventEmitter } from '../events/eventEmmiter'
import { EventTypes } from '../types' 
import {saveFile} from '../services'
import { OperationFailed } from '../utils/errors/errors';

export class FileHandler {
    public static async saveFile(file: any): Promise<void> {
        try {
            await saveFile(file);
            eventEmitter.emit(EventTypes.SEND_FILE, file)
        } catch (err) {
            throw new OperationFailed('Failed to save file');  
        }
    }
}