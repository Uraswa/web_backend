import ProductModel from "../Model/ProductModel.js";
import ShopModel from "../Model/ShopModel.js";

const getUserId = (req) => {
  const rawUserId = req?.user?.user_id;
  const userId = Number.parseInt(rawUserId, 10);
  return Number.isFinite(userId) ? userId : null;
};

export const requireShopOwnerFromParams = (paramName = "shopId") => {
  return async (req, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }

      const shopId = Number.parseInt(req.params?.[paramName], 10);
      if (!Number.isFinite(shopId)) {
        return res.status(400).json({ success: false, error: "invalid_shop_id" });
      }

      const shop = await ShopModel.findById(shopId);
      if (!shop) {
        return res.status(404).json({ success: false, error: "shop_not_found" });
      }

      if (Number.parseInt(shop.owner_id, 10) !== userId) {
        return res.status(403).json({ success: false, error: "not_shop_owner" });
      }

      req.shop = shop;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "internal_error" });
    }
  };
};

export const requireShopOwnerFromBody = (fieldNames = ["shopId", "shop_id"]) => {
  return async (req, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }

      const rawShopId =
        fieldNames.map((name) => req?.body?.[name]).find((v) => v !== undefined) ?? null;
      const shopId = Number.parseInt(rawShopId, 10);
      if (!Number.isFinite(shopId)) {
        return res.status(400).json({ success: false, error: "invalid_shop_id" });
      }

      const shop = await ShopModel.findById(shopId);
      if (!shop) {
        return res.status(404).json({ success: false, error: "shop_not_found" });
      }

      if (Number.parseInt(shop.owner_id, 10) !== userId) {
        return res.status(403).json({ success: false, error: "not_shop_owner" });
      }

      req.shop = shop;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "internal_error" });
    }
  };
};

export const requireProductOwnerFromParams = (paramName = "id") => {
  return async (req, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: "unauthorized" });
      }

      const productId = Number.parseInt(req.params?.[paramName], 10);
      if (!Number.isFinite(productId)) {
        return res.status(400).json({ success: false, error: "invalid_product_id" });
      }

      const ownerId = await ProductModel.getOwnerIdByProductId(productId);
      if (!ownerId) {
        return res.status(404).json({ success: false, error: "product_not_found" });
      }

      if (Number.parseInt(ownerId, 10) !== userId) {
        return res.status(403).json({ success: false, error: "not_shop_owner" });
      }

      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "internal_error" });
    }
  };
};

