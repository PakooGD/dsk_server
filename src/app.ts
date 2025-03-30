import express from 'express';
import droneRoutes, {eventEmitter} from './routes/DroneRoutes';
import { verifyAuthTokens, decryptData } from './utils/helpers/CryptoHelper';
import { EventTypes } from './types/ITypes';
import { handleErrors } from './middleware/handleErrors';
import WebSocket, { WebSocketServer } from 'ws';
import { FoxgloveServer } from '@foxglove/ws-protocol';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { formatDate } from './utils/helpers/FormatHelper';

require('dotenv').config();

const dronePort: any = process.env.DRONE || 8082;
const foxglovePort: any = process.env.FOXGLOVE_PORT || 8081;
const httpPort: any = process.env.SERVER_PORT || 5000;
const reactPort: any = process.env.REACT_PORT || 8083;
const mavPort: any = process.env.MAV_PORT || 8086;

const foxgloveServer = new WebSocketServer({ port: foxglovePort, handleProtocols: (protocols: any) => server?.handleProtocols(protocols)!});
const reactServer = new WebSocketServer({ port: reactPort });
const droneServer = new WebSocketServer({ port: dronePort });
const mavServer = new WebSocketServer({ port: mavPort });

export const server = new FoxgloveServer({ name: "px4-foxglove-bridge" });
export const reactClients = new Map<string, WebSocket | null>();
export const droneClients = new Map<string, WebSocket | null>();

eventEmitter.emit(EventTypes.SET_OFFLINE_STATUS);

const app = express();
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/api', droneRoutes);
app.use(handleErrors);


reactServer.on('connection', (ws) => {
    console.log('New client connected');
    ws.on('message', (message: string) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'register' && data.id) {
                reactClients.set(data.id, ws);
                console.log(`Client registered for drone ${data.id}`);
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        for (const id in reactClients) {
            reactClients.delete(id);
            console.log(`Client unregistered for drone ${id}`);
        }
    });
});


foxgloveServer.on("connection", (conn: any, req: any) => {
    const name = `${req.socket.remoteAddress}:${req.socket.remotePort}`;

    server.on("subscribe", (chanId) => {});
    server.on("unsubscribe", (chanId) => {});
    server.on("error", (err) => {
        console.error("server error: %o", err);
    });

    server?.handleConnection(conn, name);
});


droneServer.on('connection', (ws, req) => {
    try {
        const decoded = verifyAuthTokens(req)

        eventEmitter.emit(EventTypes.SIGNIN, decoded.drone_id);

        droneClients.set(decoded.drone_id, ws);

        ws.on('message', (message: string) => {
            try {
                const decryptedData = decryptData(message);
                if (decryptedData.type === 'data') eventEmitter.emit(EventTypes.RECEIVED_DATA, decoded.drone_id, decryptedData, ws); 
                if (decryptedData.type === 'info') eventEmitter.emit(EventTypes.UPDATE_DATA, decoded.drone_id, decryptedData, ws); 
                ws.send(JSON.stringify({ type: 'ack' }));
            } catch (err) {
                console.error('Error processing message:', err);
                ws.send(JSON.stringify({ type: 'error', message: err }));
            }
        });

        ws.on('close', () => {
            droneClients.delete(decoded.drone_id);
            eventEmitter.emit(EventTypes.LOGOUT, decoded.drone_id);
        });
        
    } catch(error) {
        ws.send(JSON.stringify({ type: 'refresh_token' }));
        console.error(error);
    }
});





mavServer.on('connection', (ws) => {
    console.log('New client connected');
    
    const LOG_DIR = path.join(__dirname, '../temp/ulog');
    const filename = path.join(LOG_DIR, `${formatDate(Date.now(), "DD_MM_YYYY-HH_mm")}.ulg`);
    
    const fileStream = fs.createWriteStream(filename);
    
    console.log(`Creating log file: ${filename}`);

    ws.binaryType = 'arraybuffer';
    ws.on('message', (message: any) => {
        try {
            const buffer = Buffer.from(message);
            fileStream.write(buffer);
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });
    
    ws.on('close', () => {
        console.log(`Client disconnected, closing file: ${filename}`);
        fileStream.end();
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        fileStream.end();
    });
});

const httpServer = app.listen(httpPort, () => {
    console.log(`HTTP server running on http://localhost:${httpPort}`);
    console.log(`MAVLink WebSocket server running on ws://localhost:${mavPort}`);
    console.log(`Foxglove server running on ws://localhost:${foxglovePort}`);
    console.log(`React client server running on ws://localhost:${reactPort}`);
    console.log(`Drone server running on ws://localhost:${dronePort}`);
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
    console.log('Shutting down servers...');
    eventEmitter.emit(EventTypes.SET_OFFLINE_STATUS);
    httpServer.close();
    process.exit(0);
});

