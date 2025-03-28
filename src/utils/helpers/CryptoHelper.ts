import crypto from 'crypto';

const jwt = require('jsonwebtoken');

export function decodeBase64(data:any) {
    return JSON.parse(Buffer.from(data, 'base64').toString());
}

export const decodeProtobuf = (data:any) => {
    if (Buffer.isBuffer(data)) {
        const hexString = data.toString('hex'); 
        const jsonString = Buffer.from(hexString, 'hex').toString('utf-8'); 
        return JSON.parse(jsonString); 
    }
}

export function signMessage(key: any, data: any) {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function decryptData(encryptedData: string): any {
    const data = JSON.parse(encryptedData);

    if (!data) throw new Error('Invalid message');

    const signature = signMessage(process.env.SECRET_KEY, data.ciphertext);
    if (signature !== data.signature) {
        throw new Error('Invalid message signature');
    }

    const iv = Buffer.from(data.iv, 'base64');
    const ciphertext = Buffer.from(data.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv(
        'aes-256-cbc', 
        Buffer.from(process.env.SECRET_MESSAGE_KEY!), 
        iv
    );

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
}

export function verifyAuthTokens(req:any) {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token || token == 'None') {
            throw new Error('Auth tokens missing');
        }
        return jwt.verify(token, process.env.SECRET_KEY);
    } catch (error) {
        
        throw new Error('Access token expired. Refreshing...');
    }
}