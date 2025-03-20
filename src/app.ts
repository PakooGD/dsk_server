// src/app.ts
import express from 'express';
import droneRoutes  from './routes/droneRoutes'
import { drones } from './services/authorization'
import { WebSocketServer } from 'ws';
import { signMessage } from './utils/helpers/signMessage'
import { eventEmitter } from './events/eventEmmiter'
import { EventTypes, TopicSchema } from './types' 
import { handleErrors } from './middleware/handleErrors';
import cors from 'cors';
import { decodeBase64 } from './utils/helpers/decodeBase64';

const app = express();

// Или разрешить запросы только с определённого домена (например, localhost:3001)
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
const FoxglovePort: any = process.env.FOXGLOVE || 8081;

app.use(express.json());
app.use('/api', droneRoutes);
app.use(handleErrors);

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
            const { data: dataBase64, signature } = JSON.parse(message);

            if (!dataBase64 || !signature) {
                console.log('Invalid message format: data or signature is missing');
                return;
            }

            const expectedSignature = signMessage(process.env.SECRET_KEY, dataBase64);
            if (signature !== expectedSignature) {
                console.log('Invalid signature');
                return;
            }

            const data = decodeBase64(dataBase64);

            if (data.type === 'schemas') {
                eventEmitter.emit(EventTypes.SCHEMAS_RECEIVED, decoded.drone_id, data.content );
            }

            if (data.type === 'data') {
                eventEmitter.emit(EventTypes.SEND_DATA, decoded.drone_id, JSON.stringify(data.content) );
            }
        });
    
        ws.on('close', () => {
            drones.delete(decoded.drone_id);
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



// const server = new FoxgloveServer({ name: "px4-foxglove-bridge" });

// const ws = new WebSocketServer({
//     port: 8081,
//     handleProtocols: (protocols) => server.handleProtocols(protocols),
// });


// ws.on("connection", (conn, req) => {
//     server.on("subscribe", (chanId) => {

//     });

//     server.on("unsubscribe", (chanId) => {

//     });

//     server.on("error", (err) => {
//         console.error("server error: %o", err);
//     });

//     server.handleConnection(conn, name);
// });