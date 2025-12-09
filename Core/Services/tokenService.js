import jwt from "jsonwebtoken";

class TokenService {
    generateTokens(payload, accessTokenExpires = '1h', refreshTokenExpires = '24') {
        const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {expiresIn: accessTokenExpires})
        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {expiresIn: refreshTokenExpires})
        return {
            accessToken,
            refreshToken
        }
    }

    validateAccessToken(token) {
        try {
            const userData = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            return userData;
        } catch (e) {
            return null;
        }
    }

    validateRefreshToken(token) {
        try {
            const userData = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
            return userData;
        } catch (e) {
            return null;
        }
    }
}

export default new TokenService();