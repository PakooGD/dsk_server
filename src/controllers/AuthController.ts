import { NextFunction } from 'express';
import { BadRequest } from '../utils/errors/errors';
import { AuthHandler } from '../services/AuthHandler'
import { signMessage, decryptData } from '../utils/helpers/CryptoHelper';

export class AuthController {
    public static AuthDrone(req: any, res: any, next: NextFunction) {
        const { encrypted_data } = req.body
        const decryptedData = decryptData(encrypted_data);
        
        const { drone_id, topics, ip_address } = decryptedData;
        
        if (!drone_id || !topics || !ip_address) {
            res.status(401)
            throw new BadRequest('Missing field');  
        }
        try {  
            const { accessToken, refreshToken } = AuthHandler.Auth(drone_id, topics, ip_address);
            res.status(200).json({ accessToken, refreshToken });
        } catch (err) {
            next(err)
        }
    };

    public static RefreshToken(req: any, res: any, next: NextFunction) {
        const { encrypted_data } = req.body
        const decryptedData = decryptData(encrypted_data);
        const { refreshToken } = decryptedData;
        if (!refreshToken) {
            res.status(401)
            throw new BadRequest('Refresh token is required');  
        }
        try {     
            const accessToken = AuthHandler.Refresh(refreshToken);
            res.status(200).json({accessToken});
        } catch (err) {
            next(err)
        }
    };

    public static FetchDrones(req: any, res: any, next: NextFunction) {
        if (!req.body) {
            throw new BadRequest('Missing data');  
        }
        try {  
            const drones = AuthHandler.FetchDrones()   
            res.status(200).json(drones);
        } catch (err) {
            next(err)
        }
    }
}
