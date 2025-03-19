import { ErrorHandler, BadRequest, NotFound } from '../utils/errors/errors';
import { Request, Response, NextFunction } from 'express';

export const handleErrors = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ErrorHandler) {
        return res.status(err.getCode()).json({
            status: 'error',
            message: err.message,
        });
    }

    return res.status(500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
};