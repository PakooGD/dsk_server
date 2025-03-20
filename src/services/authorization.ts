import { OperationFailed } from '../utils/errors/errors';

export const drones = new Map<string, any>();

const jwt = require('jsonwebtoken');
require('dotenv').config()

export const authorization = (drone_id: string): any => {
    try {
        if (drones.has(drone_id)) {        
            throw new OperationFailed('current Id exists');  
        }
        const accessToken = jwt.sign({ drone_id }, process.env.SECRET_KEY, { expiresIn: '1m' });
        const refreshToken = jwt.sign({ drone_id }, process.env.REFRESH_SECRET_KEY, { expiresIn: '1d' });
        drones.set(drone_id, {});
        return { accessToken, refreshToken };
    } catch (err) {
        throw new OperationFailed('Failed to save file');  
    }
};

export const refreshToken = (refreshToken: any): any => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
        const accessToken = jwt.sign({ drone_id: decoded.drone_id }, process.env.SECRET_KEY, { expiresIn: '15m' });
        return accessToken;
    } catch (err) {
        throw new OperationFailed('Failed to save file');  
    }
};