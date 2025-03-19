// src/app.ts
import express from 'express';
import droneRoutes  from './routes/droneRoutes'
import { drones } from './services/authorization'
import { WebSocketServer } from 'ws';
import { hmac } from './utils/helpers/hmac'
import { eventEmitter } from './events/eventEmmiter'
import { EventTypes } from './types' 

const jwt = require('jsonwebtoken');

const handleErrors = require('./middleware/handleErrors');

const BridgePort: any = process.env.DRONE || 8082;
const httpPort: any = process.env.PORT || 3000;
const FoxglovePort: any = process.env.FOXGLOVE || 8081;

const app = express();

app.use(express.json());
app.use('/api', droneRoutes);
app.use(handleErrors);

const wss = new WebSocketServer({ port: BridgePort }); 

wss.on('connection', (ws, req) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        ws.close(1008, 'Unauthorized');
        return;
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    drones.set(decoded.drone_id,  ws);
    ws.send(JSON.stringify({ type: 'request_schemas' }));
    console.log(`Drone ${decoded.drone_id} connected`);

    
    ws.on('message', (message: string) => {        
        const { data, signature } = JSON.parse(message);

        // Проверка подписи
        const expectedSignature = hmac(process.env.SECRET_KEY, data);
        if (signature !== expectedSignature) {
            console.log('Invalid signature');
            return;
        }

        if (data.type === 'schemas') {
            console.log(`Received schemas from ${decoded.drone_id}:`, data.schemas);
            eventEmitter.emit(EventTypes.SCHEMAS_RECEIVED, { drone_id: decoded.drone_id, schemas: data.schemas });
        }
        // eventEmitter.emit(EventTypes.SEND_DATA, message)
    });

    ws.on('close', () => {
        drones.delete(decoded.drone_id);
        console.log(`Drone ${decoded.drone_id} disconnected.`);
    });
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