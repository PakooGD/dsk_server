import { OperationFailed } from '../utils/errors/errors';
import { readDronesFile,writeDronesFile } from '../utils/helpers/TokenHelper';

require('dotenv').config();

const jwt = require('jsonwebtoken');

export class AuthHandler {
    public static Auth(drone_id: string, topics: any, ip_address: string): any {
        try {
            const accessToken = jwt.sign({ drone_id }, process.env.SECRET_KEY, { expiresIn: '15m' });
            const refreshToken = jwt.sign({ drone_id }, process.env.REFRESH_SECRET_KEY, { expiresIn: '10d' });

            const decoded = jwt.decode(refreshToken);
            const expiresAt = new Date(decoded.exp * 1000);
    
            const drones = readDronesFile();

            const existingIndex = drones.findIndex((drone:any) => drone.drone_id === drone_id);
            if (existingIndex !== -1) {
                drones[existingIndex].refreshToken = refreshToken;
                drones[existingIndex].expiresAt = expiresAt;
                drones[existingIndex].ip_address = ip_address;
                drones[existingIndex].status = 'online';
                drones[existingIndex].topics = topics; 
            } else {
                drones.push({
                    drone_id,
                    ip_address,
                    topics,
                    refreshToken,
                    expiresAt,
                    status: 'online',
                });
            }
            
            writeDronesFile(drones);

            return { accessToken, refreshToken };
        } catch (err) {
            throw new OperationFailed('Failed to save file');  
        }
    };
    
    public static Refresh(refreshToken: any): any {
        try {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
            const drone_id = decoded.drone_id;
    
            const drones = readDronesFile();
            const tokenRecord = drones.find((token:any) => token.drone_id === drone_id);
    
            if (!tokenRecord || tokenRecord.refreshToken !== refreshToken) {
                throw new OperationFailed('Invalid refresh token');
            }

            if (new Date(tokenRecord.expiresAt) < new Date()) {
                throw new OperationFailed('Refresh token expired');
            }

            tokenRecord.status = 'online';
            writeDronesFile(drones);

            return jwt.sign({ drone_id }, process.env.SECRET_KEY, { expiresIn: '15m' });
        } catch (err) {
            throw new OperationFailed('Failed to save file');  
        }
    };
    
    public static HandleLogout(drone_id: string): void {
        try {
            const drones = readDronesFile();
            const existingIndex = drones.findIndex((drone:any) => drone.drone_id === drone_id);
            if (existingIndex !== -1) {
                drones[existingIndex].status = 'offline';
                writeDronesFile(drones);
            }
        } catch (err) {
            throw new OperationFailed('Failed to logout');
        }
    };

    public static SetOnlineStatus(drone_id: string): void {
        try {
            const drones = readDronesFile();
            const existingIndex = drones.findIndex((drone:any) => drone.drone_id === drone_id);
            if (existingIndex !== -1) {
                drones[existingIndex].status = 'online';
                writeDronesFile(drones);
            }
        } catch (err) {
            throw new OperationFailed('Failed to signin');
        }
    };

    public static FetchDrones = (): any => {
        try {
            const drones = readDronesFile();
            const now = new Date();
            const updatedDrones = drones.map((drone: any) => {
                if (new Date(drone.expiresAt) < now && drone.status === 'online') {
                    return {
                        ...drone,
                        status: 'offline'
                    };
                }
                return drone;
            });

            if (JSON.stringify(drones) !== JSON.stringify(updatedDrones)) {
                writeDronesFile(updatedDrones);
            }

            return updatedDrones.map((drone: any) => ({
                id: drone.drone_id,
                topics: drone.topics,
                status: drone.status,
                ip_address: drone.ip_address,
            }));
        } catch (err) {
            throw new OperationFailed('Failed to get Ids');
        }
    };

    public static SetAllDronesOffline(): void {
        try {
            const drones = readDronesFile();
            const updatedDrones = drones.map((drone: any) => ({
                ...drone,
                status: 'offline'
            }));
            writeDronesFile(updatedDrones);
        } catch (err) {
            console.error('Failed to set all drones offline:', err);
        }
    }

    public static UpdateData(drone_id: string, data:any): void {
        try {
            const drones = readDronesFile();
            const existingIndex = drones.findIndex((drone:any) => drone.drone_id === drone_id);
            if (existingIndex !== -1) {
                drones[existingIndex].topics = data.topics;
                drones[existingIndex].ip_address = data.ip_address || drones[existingIndex].ip_address;
                writeDronesFile(drones);
            }
        } catch (err) {
            throw new OperationFailed('Failed to signin');
        }
    };
    
}