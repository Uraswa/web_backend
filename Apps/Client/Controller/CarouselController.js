import CarouselModel from "../Model/CarouselModel.js";

class CarouselController {

    // Получение слайдов
    async getSlides(req, res) {
        try {
            const limitParam = parseInt(req.query.limit, 10);
            const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 3;

            const slides = await CarouselModel.getSlides(limit);

            return res.status(200).json({
                success: true,
                data: slides
            });
        } catch (error) {
            // In dev environments migrations may not be applied yet.
            // Treat missing table as "no slides" instead of hard error.
            if (error?.code === '42P01') {
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при получении слайдов"
            });
        }
    }
}

export default new CarouselController();
