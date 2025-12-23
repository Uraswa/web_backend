import OPPModel from "./OPPModel.js";

class OPPController {
  async listEnabled(req, res) {
    try {
      const oppList = await OPPModel.findAllEnabled();
      return res.status(200).json({ success: true, data: oppList });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "Ошибка получения ПВЗ" });
    }
  }
}

export default new OPPController();

