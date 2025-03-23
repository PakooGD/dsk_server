import express from 'express';

import { authorize, handleTopics,refreshToken,fetchDrones,redirectLogs,loadLogs } from '../controllers';

const router = express.Router();

router.post('/auth', authorize);
router.post('/refresh', refreshToken);
router.post('/topics/update', handleTopics)
router.get('/drones', fetchDrones)
router.post('/topics/redirect', redirectLogs)
router.get('/log/load', loadLogs)

export default router;