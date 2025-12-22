import notAuthMiddleware from "../../Core/Middleware/notAuthMiddleware.js";
import UserController from "./Controller/UserController.js";
import authMiddleware from "../../Core/Middleware/authMiddleware.js";

export default (router) => {
    router.post('/api/createUser', notAuthMiddleware, UserController.createUser.bind(UserController));
    router.post('/api/login', notAuthMiddleware, UserController.loginUser.bind(UserController));
    router.post('/api/refreshToken', UserController.refreshToken.bind(UserController));
    router.post('/api/logout', authMiddleware, UserController.logout.bind(UserController));
    router.post('/api/forgotPassword', notAuthMiddleware, UserController.forgotPassword.bind(UserController));
    router.post('/api/changePassword', notAuthMiddleware, UserController.changePassword.bind(UserController));
    router.get('/api/activateAccount', notAuthMiddleware, UserController.activateAccount.bind(UserController));
    router.get('/api/doesUserExist', authMiddleware, UserController.doesUserExist.bind(UserController));
    router.post('/api/createProfile', authMiddleware, UserController.createProfile.bind(UserController));
}