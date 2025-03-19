import express from 'express';
import { upload } from '../services/fileService';
import { saveLog, authorize, handleTopics,refreshToken } from '../controllers';

const router = express.Router();

router.post('/auth', authorize);
router.post('/refresh', refreshToken);
router.post('/upload/ulog', upload.single('file'),  saveLog);
router.post('/topics/update', handleTopics)

export default router;