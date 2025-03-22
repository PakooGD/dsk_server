import { OperationFailed } from '../utils/errors/errors';

const fs = require('fs');
const path = require('path');

export const drones = new Map<string, any>();

const tokensFilePath = path.join(__dirname, '../../temp/tokens.json');

const readTokensFile = () => {
    try {
        const data = fs.readFileSync(tokensFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const writeTokensFile = (data:any) => {
    fs.writeFileSync(tokensFilePath, JSON.stringify(data, null, 2), 'utf-8');
};

const jwt = require('jsonwebtoken');
require('dotenv').config()

export const authorization = (drone_id: string): any => {
    try {

        const accessToken = jwt.sign({ drone_id }, process.env.SECRET_KEY, { expiresIn: '10s' });
        const refreshToken = jwt.sign({ drone_id }, process.env.REFRESH_SECRET_KEY, { expiresIn: '30s' });

        const decoded = jwt.decode(refreshToken);
        const expiresAt = new Date(decoded.exp * 1000);

        const tokens = readTokensFile();

        const existingTokenIndex = tokens.findIndex((token:any) => token.drone_id === drone_id);
        
        if (existingTokenIndex !== -1) {
            tokens[existingTokenIndex].refreshToken = refreshToken;
            tokens[existingTokenIndex].expiresAt = expiresAt;
        } else {
            tokens.push({
                drone_id,
                refreshToken,
                expiresAt,
            });
        }

        writeTokensFile(tokens);

        if (!drones.has(drone_id)) {        
            drones.set(drone_id, {});
        }
        
        return { accessToken, refreshToken };
    } catch (err) {
        throw new OperationFailed('Failed to save file');  
    }
};

export const refresh = (refreshToken: any): any => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
        const drone_id = decoded.drone_id;

        const tokens = readTokensFile();
        const tokenRecord = tokens.find((token:any) => token.drone_id === drone_id);

        if (!tokenRecord || tokenRecord.refreshToken !== refreshToken) {
            throw new OperationFailed('Invalid refresh token');
        }

        // Проверяем, не истек ли срок действия refresh token
        if (new Date(tokenRecord.expiresAt) < new Date()) {
            throw new OperationFailed('Refresh token expired');
        }

        const accessToken = jwt.sign({ drone_id }, process.env.SECRET_KEY, { expiresIn: '10s' });
        return accessToken;
    } catch (err) {
        throw new OperationFailed('Failed to save file');  
    }
};

export const logout = (drone_id: string): void => {
    try {
        const tokens = readTokensFile();

        const updatedTokens = tokens.filter((token:any) => token.drone_id !== drone_id);

        writeTokensFile(updatedTokens);
    } catch (err) {
        throw new OperationFailed('Failed to logout');
    }
};