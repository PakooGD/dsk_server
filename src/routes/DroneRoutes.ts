import express from 'express';
import { EventEmitter } from 'events';
import { EventTypes } from '../types/ITypes' 
import { DroneHandler } from '../services/DroneHandler';
import { AuthHandler } from '../services/AuthHandler';
import { AuthController, DroneController } from '../controllers';

export const eventEmitter = new EventEmitter();

eventEmitter.on(EventTypes.RECEIVED_DATA, DroneHandler.HandleData);
eventEmitter.on(EventTypes.LOGOUT, AuthHandler.HandleLogout);
eventEmitter.on(EventTypes.SET_OFFLINE_STATUS, AuthHandler.SetAllDronesOffline);
eventEmitter.on(EventTypes.SIGNIN, AuthHandler.SetOnlineStatus);
eventEmitter.on(EventTypes.UPDATE_DATA, AuthHandler.UpdateData);

const router = express.Router();

router.post('/auth', AuthController.AuthDrone);
router.post('/refresh', AuthController.RefreshToken);
router.post('/topics/update', DroneController.HandleTopics)
router.post('/topics/redirect', DroneController.RedirectLogs)
router.get('/drones', AuthController.FetchDrones)

export default router;