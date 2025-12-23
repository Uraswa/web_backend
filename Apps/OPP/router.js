import OPPController from "./OPPController.js";

export default (router) => {
  router.get("/api/opp", OPPController.listEnabled);
};
