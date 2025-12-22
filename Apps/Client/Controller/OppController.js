import OppModel from "../Model/OppModel.js";

class OppController {
    async listOpps(req, res) {
        try {
            const opps = await OppModel.findAllEnabled();
            const publicOpps = opps.map((opp) => ({
                opp_id: opp.opp_id,
                address: opp.address,
                latitude: opp.latitude,
                longitude: opp.longitude,
                work_time: opp.work_time
            }));

            return res.status(200).json({
                success: true,
                data: publicOpps
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка при получении ПВЗ'
            });
        }
    }
}

export default new OppController();
