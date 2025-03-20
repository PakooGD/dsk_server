const path = require('path');
const fs = require('fs');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        const uploadDir = path.join(__dirname, '../../temp/ulog');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req: any, file: any, cb: any) => {
        cb(null, file.originalname);
    },
});

export const upload = multer({ storage });

export const saveFile = (file: any): Promise<void> => {
    return new Promise((resolve, reject) => {
        const targetPath = path.join(__dirname, '../../temp/ulog', file.originalname);
        fs.rename(file.path, targetPath, (err:any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};