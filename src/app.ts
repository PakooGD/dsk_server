// src/app.ts
import express from 'express';
import droneRoutes  from './routes/droneRoutes'
import { drones } from './services/authorization'
import { signMessage } from './utils/helpers/signMessage'
import { eventEmitter } from './events/eventEmmiter'
import { EventTypes, TopicSchema } from './types' 
import { handleErrors } from './middleware/handleErrors';
import cors from 'cors';
import { decodeBase64 } from './utils/helpers/decodeBase64';
import { createDecipheriv } from 'crypto';
import WebSocket from 'ws'; 
import { FoxgloveServer } from '@foxglove/ws-protocol';
import { WebSocketServer } from 'ws';


function decryptData(encryptedData: string, secretKey: string): string {
    const data = JSON.parse(encryptedData);
    const iv = Buffer.from(data.iv, 'base64');
    const ciphertext = Buffer.from(data.ciphertext, 'base64');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf-8');
}

const app = express();

app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'], // Разрешить заголовки
      })
  );

const jwt = require('jsonwebtoken');
require('dotenv').config()

const BridgePort: any = process.env.DRONE || 8082;
const httpPort: any = process.env.SERVER_PORT || 5000;

app.use(express.json());
app.use('/api', droneRoutes);
app.use(handleErrors);



const reactServer = new WebSocketServer({ port: 8083 });

export const clients = new Map<string, WebSocket | null>();

reactServer.on('connection', (reactSocket) => {
    console.log('New client connected');

    reactSocket.on('message', (message: string) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'register' && data.id) {
                clients.set(data.id, reactSocket);
                console.log(`Client registered for drone ${data.id}`);
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    reactSocket.on('close', () => {
        console.log('Client disconnected');
        for(const id in clients){
            clients.delete(id);
            console.log(`Client unregistered for drone ${id}`);
        }
    });
});


export const server = new FoxgloveServer({ name: "px4-foxglove-bridge" });

const foxgloveServer = new WebSocketServer({
    port: 8081,
    handleProtocols: (protocols: any) => server?.handleProtocols(protocols)!,
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


const wss = new WebSocketServer({ port: BridgePort }); 

wss.on('connection', (ws, req) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token || token == 'None') {
        ws.close(1008, 'Unauthorized');
        return;
    }
    let decoded: any;

    try{
        decoded = jwt.verify(token, process.env.SECRET_KEY);
        drones.set(decoded.drone_id,  ws);

        ws.send(JSON.stringify({ type: 'request_schemas' }));

        ws.on('message', (message: string) => {    
            try {    
                const { data: dataBase64, signature } = JSON.parse(message);

                if (!dataBase64 || !signature) {
                    throw new Error('Invalid message format: data or signature is missing');
                }

                const expectedSignature = signMessage(process.env.SECRET_KEY, dataBase64);
                if (signature !== expectedSignature) {
                    throw new Error('Invalid signature');
                }

                const decryptedData = decryptData(dataBase64, process.env.SECRET_MESSAGE_KEY!);
                const data = JSON.parse(decryptedData);

                // const data = decodeBase64(dataBase64);

                if (data.type === 'schemas') {
                    eventEmitter.emit(EventTypes.SCHEMAS_RECEIVED, decoded.drone_id, data.content );
                }

                if (data.type === 'data') {
                    eventEmitter.emit(EventTypes.SEND_DATA, decoded.drone_id, JSON.stringify(data.content) );
                }

                // Отправка подтверждения (ACK)
                ws.send(JSON.stringify({ type: 'ack' }));
            } catch (err) {
                console.error('Error processing message:', err);
                ws.send(JSON.stringify({ type: 'error', message: err }));
            }
        });
    
        ws.on('close', () => {
            drones.delete(decoded.drone_id);
            eventEmitter.emit(EventTypes.LOGOUT, decoded.drone_id );
            console.log(`Drone ${decoded.drone_id} disconnected.`);
        });
    } catch {
        console.log('Access token expired. Refreshing...')
        ws.send(JSON.stringify({ type: 'refresh_token' }));
    }
});

app.listen(httpPort, () => {
    console.log(`Server is running on http://localhost:${httpPort}`);
});


