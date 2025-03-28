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


// ULog configuration
const LOG_DIR = path.join(__dirname, '../temp/ulog');
let currentLogFile: string | null = null;
let writeStream: fs.WriteStream | null = null;

function initLogging() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (writeStream) writeStream.close();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    currentLogFile = path.join(LOG_DIR, `px4_log_${timestamp}.ulg`);
    writeStream = fs.createWriteStream(currentLogFile);
    
    console.log(`New log file created: ${currentLogFile}`);
}

function processULogData(data: Buffer) {
    if (data.length >= 16 && data.slice(0, 4).toString() === 'ULog') {
        console.log('ULog header detected in current stream');
    }
}

mavServer.on('connection', (ws) => {
    console.log('New MAVLink client connected');
    
    if (!writeStream || !currentLogFile) initLogging();

    ws.on('message', (encrypted: string) => {
        try {
            if (!writeStream) throw new Error('Log file not initialized');
            
            const decryptedData = decryptData(encrypted)

            writeStream.write(decryptedData);
            
            processULogData(decryptedData)

            ws.send(JSON.stringify({ 
                status: 'ok',
                message: 'Data received'
            }));

        } catch (err) {
            console.error('Error:', err);
            ws.send(JSON.stringify({
                status: 'error',
                message: 'Failed to process data'
            }));
        }
    });

    ws.on('close', () => {
        console.log('MAVLink client disconnected');
    });

    ws.on('error', (err) => {
        console.error('MAVLink WebSocket error:', err);
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
    if (writeStream) writeStream.close();
    httpServer.close();
    process.exit(0);
});

