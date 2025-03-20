import express from 'express';
import { upload } from '../services/fileService';
import { saveLog, authorize, handleTopics,refreshToken,fetchDrones,redirectLogs } from '../controllers';

const router = express.Router();

router.post('/auth', authorize);
router.post('/refresh', refreshToken);
router.post('/upload/ulog', upload.single('file'),  saveLog);
router.post('/topics/update', handleTopics)
router.get('/drones', fetchDrones)
router.post('/log/redirect', redirectLogs)


export default router;