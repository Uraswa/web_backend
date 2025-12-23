import NewsletterModel from "../Model/NewsletterModel.js";

class NewsletterController {
    async subscribe(req, res) {
        try {
            const { email } = req.body || {};
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'email_required'
                });
            }

            const normalizedEmail = String(email).trim().toLowerCase();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(normalizedEmail)) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_email'
                });
            }

            const subscription = await NewsletterModel.upsertSubscription(normalizedEmail);

            return res.status(200).json({
                success: true,
                data: {
                    subscription_id: subscription.subscription_id,
                    email: subscription.email,
                    is_active: subscription.is_active
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка при подписке'
            });
        }
    }

    async unsubscribe(req, res) {
        try {
            const { email } = req.body || {};
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'email_required'
                });
            }

            const normalizedEmail = String(email).trim().toLowerCase();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(normalizedEmail)) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_email'
                });
            }

            const subscription = await NewsletterModel.unsubscribe(normalizedEmail);
            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    error: 'not_found'
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    subscription_id: subscription.subscription_id,
                    email: subscription.email,
                    is_active: subscription.is_active
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка при отписке'
            });
        }
    }
}

export default new NewsletterController();
