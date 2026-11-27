// Calculation utilities
function defaultCalculateKeepQty(r) {
    const avg = r.AvgDailyUse || 0;
    if (r.Moving === "Non Moving" || r.Moving === "Slowly") return 1;
    if (r.Moving === "Slow" && r.ABCValue === "C") return Math.max(1, Math.round(avg * 60));
    if (r.Moving === "Slow" && r.ABCValue === "B") return Math.max(1, Math.round(avg * 60));
    if (r.Moving === "Medium" && r.ABCValue === "C") return Math.max(2, Math.round(avg * 80));
    if (r.Moving === "Slow" && r.ABCValue === "A") return Math.max(3, Math.round(avg * 60));
    if (r.Moving === "Medium" && r.ABCValue === "B") return Math.max(4, Math.round(avg * 70));
    if (r.Moving === "Fast" && r.ABCValue === "C") return Math.max(5, Math.round(avg * 120));
    if (r.Moving === "Medium" && r.ABCValue === "A") return Math.max(6, Math.round(avg * 60));
    if (r.Moving === "Fast" && r.ABCValue === "B") return Math.max(8, Math.round(avg * 90));
    if (r.Moving === "Fast" && r.ABCValue === "A") return Math.max(10, Math.round(avg * 60));
    return Math.max(1, Math.round(avg * 40));
}

function calculateKeepQty(r) {
    const plantCode = (r && r.Plant) ? r.Plant : selectedPlant;
    const override = getPlantCalculationOverride(plantCode);
    if (override && typeof override.calculateKeepQty === "function") {
        return override.calculateKeepQty(r, { defaultCalculateKeepQty });
    }
    return defaultCalculateKeepQty(r);
}

function updateReturnFields(r) {
    const unrestricted = Number(r.Unrestricted || 0);
    let keepQty = Number(calculateKeepQty(r) || 0);

    // ปรับ KeepQty ให้เต็ม Package (ถ้ามี) เพื่อไม่ให้คืนเศษแพ็ค
    const pack = Number(r.MultiplyUnit || 1);
    if (pack > 1 && keepQty > 0) {
        keepQty = Math.ceil(keepQty / pack) * pack;
    }

    const unitPrice = unrestricted > 0 ? (Number(r.Value || 0) / unrestricted) : 0;
    const returnQty = Math.max(0, unrestricted - keepQty);
    r.ReturnQty = returnQty;
    r.ReturnValue = returnQty * unitPrice;
}

function defaultCalcABCValue() {
    const sorted = [...allData].sort((a, b) => (Number(b.Value || 0) - Number(a.Value || 0)));
    const total = sorted.reduce((s, r) => s + Number(r.Value || 0), 0);
    let cum = 0;
    const dataMap = new Map();
    allData.forEach(r => {
        dataMap.set(`${r.Plant}-${r.Material}`, r);
    });
    sorted.forEach(r => {
        cum += Number(r.Value || 0);
        const pct = total ? (cum / total) * 100 : 0;
        const orig = dataMap.get(`${r.Plant}-${r.Material}`);
        if (orig) {
            orig.CumPercent = pct;
            orig.ABCValue = pct <= 70 ? "A" : pct <= 90 ? "B" : "C";
        }
    });
}

function calcABCValue() {
    const override = getPlantCalculationOverride(selectedPlant);
    if (override && typeof override.calcABCValue === "function") {
        return override.calcABCValue({ allData, defaultCalcABCValue });
    }
    return defaultCalcABCValue();
}

function defaultRecalculateStockFields(data, params) {
    data.forEach(r => {
        const leadTime = Number((params && params.leadTime !== undefined) ? params.leadTime : 5);
        const safetyDays = Number((params && params.safety !== undefined) ? params.safety : 3);
        const coverDays = Number((params && params.cover !== undefined) ? params.cover : 40);
        const qty4m = Number(r.Qty4Month || 0);
        const qty3m = Number(r.Qty3Month || 0);
        const qty6m = Number(r.Qty6Month || 0);
        const qty2m = Number(r.Qty2Month || 0);
        const qty30d = Number(r.ThirtyDay || 0);
        const unrestricted = Number(r.Unrestricted || 0);
        const mul = Number(r.MultiplyUnit || 1);

        const avg4mDaily = qty4m / 120;
        const avg3mDaily = qty3m / 90;
        const avg2mDaily = qty2m / 60;
        const avg30dDaily = qty30d / 30;
        const has3m = qty3m > 0;
        const baseAvgMonthly = has3m ? (qty3m / 3) : (qty4m / 4);
        const baseAvgDaily = baseAvgMonthly / 30;

        if (baseAvgMonthly === 0) r.Moving = "Non Moving";
        else if (baseAvgMonthly < 0.7) r.Moving = "Slowly";
        else if (baseAvgMonthly < 12) r.Moving = "Slow";
        else if (baseAvgMonthly < 30) r.Moving = "Medium";
        else r.Moving = "Fast";

        r.AvgMonthly = baseAvgMonthly;

        let w4m = 0.70, w3m = 0, w2m = 0.20, w30 = 0.10;
        if (has3m) {
            if (r.Moving === "Fast") { w4m = 0.30; w3m = 0.30; w2m = 0.20; w30 = 0.20; }
            else if (r.Moving === "Medium") { w4m = 0.40; w3m = 0.25; w2m = 0.20; w30 = 0.15; }
            else if (r.Moving === "Slow") { w4m = 0.55; w3m = 0.20; w2m = 0.15; w30 = 0.10; }
            else { w4m = 0.65; w3m = 0.15; w2m = 0.10; w30 = 0.10; }
        } else {
            if (r.Moving === "Fast") { w4m = 0.40; w2m = 0.30; w30 = 0.30; }
            if (r.Moving === "Medium") { w4m = 0.50; w2m = 0.30; w30 = 0.20; }
            if (r.Moving === "Slow") { w4m = 0.65; w2m = 0.25; w30 = 0.10; }
            if (r.Moving === "Slowly" || r.Moving === "Non Moving") { w4m = 0.75; w2m = 0.20; w30 = 0.05; }
        }

        if (r.ABCValue === "A") { w4m -= 0.05; w30 += 0.05; }
        if (r.ABCValue === "C") { w4m += 0.05; w30 -= 0.05; }

        w4m = Math.max(0.05, Math.min(0.95, w4m));
        w30 = Math.max(0.05, Math.min(0.95, w30));
        w2m = Math.max(0.05, Math.min(0.90, w2m));
        w3m = Math.max(0, w3m);
        const wSum = w4m + w3m + w2m + w30;
        w4m /= wSum; w3m /= wSum; w2m /= wSum; w30 /= wSum;

        const limitMultiplier = 3;
        const guardBase = baseAvgDaily || avg4mDaily;
        let guarded2mDaily = avg2mDaily;
        let guarded3mDaily = avg3mDaily;
        let guarded30dDaily = avg30dDaily;
        if (guardBase > 0 && avg30dDaily > guardBase * limitMultiplier) {
            guarded30dDaily = guardBase * limitMultiplier;
        }
        if (guardBase > 0 && avg2mDaily > guardBase * 2.5) {
            guarded2mDaily = guardBase * 2.5;
        }
        if (has3m && guardBase > 0 && avg3mDaily > guardBase * 2) {
            guarded3mDaily = guardBase * 2;
        }

        const seasonalTrigger = 1.8;
        const seasonalBoostMax = 0.20;
        if (guardBase > 0) {
            const ratio = avg30dDaily / guardBase;
            if (ratio >= seasonalTrigger) {
                const boost = Math.min(seasonalBoostMax, (ratio - seasonalTrigger) * 0.10);
                w30 = Math.min(0.95, w30 + boost);
                w4m = 1 - w30;
            }
        }

        let meanDaily = (avg4mDaily * w4m) + (guarded3mDaily * w3m) + (guarded2mDaily * w2m) + (guarded30dDaily * w30);
        // ถ้า 30 วันล่าสุดหยุดเบิก แต่มีฐานเก่า → ลด mean เพื่อกัน Over
        if (baseAvgDaily > 0 && avg30dDaily === 0) {
            meanDaily *= 0.7;
        }
        // ถ้าไม่มีฐานเก่าเลย แต่ 30 วันล่าสุดพุ่ง → ใช้ยอดสดดัน mean ขึ้นเพื่อกันของขาด
        if (baseAvgDaily === 0 && avg30dDaily > 0) {
            meanDaily = Math.max(meanDaily, guarded30dDaily * 0.8);
        }
        if (!isFinite(meanDaily) || meanDaily < 0) meanDaily = 0;
        const meanMonthly = meanDaily * 30;
        const seasonalSafetyDays = 0;

        let safetyDaysFinal = safetyDays;
        if (r.Moving === "Fast" || r.Moving === "Medium") {
            safetyDaysFinal += seasonalSafetyDays;
        }
        const status = (r.Status || "").toString().trim();
        const allowSafetyBoost = selectedPlant !== "0326" || status === "นวนคร";
        if (allowSafetyBoost) {
            if (r.Moving === "Medium") safetyDaysFinal += 1;
            else if (r.Moving === "Slow") safetyDaysFinal += 2;
            else if (r.Moving === "Slowly") safetyDaysFinal += 4;
        }

        let adjustedCoverDays = coverDays;
        if (selectedPlant === "0326") {
            // เงื่อนไขพิเศษ: ถ้า PartType (ประเภทอะไหล่) = คอมเพรสเซอร์ ไม่ต้องเพิ่ม CoverDays
            const partType = (r.PartType || "").toString().trim();
            const isCompressor = partType === "คอมเพรสเซอร์";

            if (!isCompressor) {
                // ปรับให้เท่ากับ Plant ทั่วไป (เฉพาะที่ไม่ใช่คอมเพรสเซอร์)
                if (r.Moving === "Medium") adjustedCoverDays += 10;      // ตั้ง 45 -> เป็น 55
                else if (r.Moving === "Slow") adjustedCoverDays += 15;   // ตั้ง 45 -> เป็น 60
                else if (r.Moving === "Slowly") adjustedCoverDays += 20; // ตั้ง 45 -> เป็น 65
            }
            // ถ้าเป็นคอมเพรสเซอร์ ใช้ค่า coverDays เดิม (ไม่เพิ่ม)
        } else {
            // สูตรเดิมสำหรับ Plant อื่น
            if (r.Moving === "Medium") adjustedCoverDays += 10;
            else if (r.Moving === "Slow") adjustedCoverDays += 15;
            else if (r.Moving === "Slowly") adjustedCoverDays += 20;
        }

        r.AvgDailyUse = meanDaily;
        r.Mean = meanMonthly;

        const safetyStock = meanDaily * safetyDaysFinal;
        const rop = (meanDaily * leadTime) + safetyStock;
        r.SafetyStock = safetyStock;
        r.ROP = rop;

        if (has3m && qty3m === 1 && qty30d === 1) {
            r.RecommendedOrder = 0;
            r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
            updateReturnFields(r);
            return;
        }

        if (r.Moving === "Slow" || r.Moving === "Slowly") {
            if (meanDaily === 0) {
                r.RecommendedOrder = 0;
                r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                updateReturnFields(r);
                return;
            }
            if (qty30d === 0) {
                r.RecommendedOrder = 0;
                r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                updateReturnFields(r);
                return;
            }
            if (r.Moving === "Slowly" && qty30d >= qty4m) {
                r.RecommendedOrder = 0;
                r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                updateReturnFields(r);
                return;
            }
        }

        if (unrestricted < rop) {
            let need = (meanDaily * adjustedCoverDays) - unrestricted;
            need = Math.max(0, need);
            const pack = Number(mul) > 0 ? Number(mul) : 1;
            // ปัดให้เป็นจำนวนเต็มแพ็ค (ไม่มีเศษ) และอย่างน้อย 1 แพ็คถ้าต้องสั่ง
            let packs = Math.floor(need / pack);
            if (need > 0 && packs === 0) packs = 1;
            need = packs * pack;
            r.RecommendedOrder = need;
        } else {
            r.RecommendedOrder = 0;
        }
        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
        updateReturnFields(r);
    });
}

function recalculateStockFields(data, params) {
    const override = getPlantCalculationOverride(selectedPlant);
    if (override && typeof override.recalculateStockFields === "function") {
        return override.recalculateStockFields({
            data,
            params,
            plantCode: selectedPlant,
            helpers: {
                defaultRecalculateStockFields,
                calculateKeepQty,
                defaultCalculateKeepQty
            }
        });
    }
    return defaultRecalculateStockFields(data, params);
}
