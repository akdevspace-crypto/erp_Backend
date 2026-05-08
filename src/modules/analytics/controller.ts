// @ts-ignore
import { success } from "../../shared/utils/response.js";
import { getDashboardKPIs } from "./service.js";
// @ts-ignore
import { AIDecisionService } from "../ai/service.js";

export const handleGetKPIs = async (req: any, res: any, next: any) => {
    try {
        const result = await getDashboardKPIs(req.user.tenantId, req.user.unitId);
        return success(res, result);
    } catch (error) {
        next(error);
    }
};

export const handleAnalyticsForecast = async (req: any, res: any, next: any) => {
    try {
        const result = await AIDecisionService.buildForecast({
            tenantId: req.user.tenantId,
            unitId: req.user.unitId,
            userId: req.user.id
        }, req.body || req.query || {});

        return success(res, result);
    } catch (error) {
        next(error);
    }
};
