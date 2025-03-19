import { NextFunction } from 'express';
import { eventEmitter } from '../events/eventEmmiter'
import { EventTypes } from '../types' 
import { ErrorHandler, BadRequest, OperationFailed } from '../utils/errors/errors';
import { authorization } from '../services'

export const authorize = (req: any, res: any, next: NextFunction) => {
    const { drone_id } = req.body;
    if (!drone_id.file) {
        res.status(401)
        throw new BadRequest('Missing field');  
    }
    try {     
        const [ accessToken, refreshToken ] = authorization(drone_id);
        res.status(200).json({ accessToken, refreshToken });
    } catch (err) {
        next(err)
    }
};

export const refreshToken = (req: any, res: any, next: NextFunction) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(401)
        throw new BadRequest('Refresh token is required');  
    }
    try {     
        const accessToken = refreshToken(refreshToken);
        res.status(200).json(accessToken);
    } catch (err) {
        next(err)
    }
};

