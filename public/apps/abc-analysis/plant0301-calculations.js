(function (global) {
    const overrides = global.plantCalculationOverrides || {};

    // ปรับสูตรสำหรับ Plant 0301 ได้ที่ไฟล์นี้โดยไม่ต้องแก้ app.js
    overrides["0301"] = {
        calcABCValue: ({ allData, defaultCalcABCValue }) => defaultCalcABCValue(),
        calculateKeepQty: (row, { defaultCalculateKeepQty }) => defaultCalculateKeepQty(row),
        recalculateStockFields: ({ data, params }) => {
            const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
            data.forEach(r => {
                const rawLT = Number((r.LeadTimeDays !== undefined && r.LeadTimeDays !== null) ? r.LeadTimeDays : (params && params.leadTime !== undefined ? params.leadTime : 5));

                let leadTime = rawLT;
                let safetyDays, coverDays;

                // กฎพิเศษตามช่วง Lead Time (3-6, 7-13, 14-30)
                if (rawLT >= 3 && rawLT <= 6) {
                    safetyDays = 4;
                    coverDays = 35;
                } else if (rawLT >= 7 && rawLT <= 13) {
                    safetyDays = 5;
                    coverDays = 40;
                } else if (rawLT >= 14 && rawLT <= 30) {
                    safetyDays = 5;
                    coverDays = 45;
                } else {
                    // สูตรเดิมสำหรับช่วงอื่น (LT < 3 หรือ LT > 30)
                    leadTime = clamp(rawLT, 7, 365);
                    safetyDays = clamp(Math.ceil(leadTime * 0.3), 2, 30);

                    if (r.Moving === "Fast" || r.Moving === "Medium") {
                        coverDays = clamp(leadTime + safetyDays + 15, 30, 140);
                    } else if (r.Moving === "Slow") {
                        coverDays = clamp((leadTime * 0.6) + safetyDays, 20, 90);
                    } else {
                        coverDays = clamp((leadTime * 0.4) + safetyDays, 10, 60);
                    }
                }

                const qty4m = Number(r.Qty4Month || 0);
                const qty3m = Number(r.Qty3Month || 0);
                const qty6m = Number(r.Qty6Month || 0);
                const qty2m = Number(r.Qty2Month || 0);
                const qty30d = Number(r.ThirtyDay || 0);
                const unrestricted = Number(r.Unrestricted || 0);
                const mul = Number(r.MultiplyUnit || 1);
                const prOutstanding = Number(r.PrOutstanding || 0);
                const poOutstanding = Number(r.PoOutstanding || 0);

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
                    if (r.Moving === "Fast") { w4m = 0.30; w3m = 0.25; w2m = 0.20; w30 = 0.25; }
                    else if (r.Moving === "Medium") { w4m = 0.35; w3m = 0.25; w2m = 0.20; w30 = 0.20; }
                    else if (r.Moving === "Slow") { w4m = 0.50; w3m = 0.20; w2m = 0.20; w30 = 0.10; }
                    else { w4m = 0.60; w3m = 0.20; w2m = 0.15; w30 = 0.05; }
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
                if (baseAvgDaily > 0 && avg30dDaily === 0) {
                    meanDaily *= 0.7;
                }
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

                const adjustedCoverDays = coverDays;
                r.AvgDailyUse = meanDaily;
                r.Mean = meanMonthly;
                r.SafetyDayUsed = safetyDays;
                r.CoverDayUsed = coverDays;

                const safetyStock = meanDaily * safetyDaysFinal;
                const rop = (meanDaily * leadTime) + safetyStock;
                r.SafetyStock = safetyStock;
                r.ROP = rop;

                if (r.Moving === "Slow" || r.Moving === "Slowly") {
                    if (meanDaily === 0) {
                        r.RecommendedOrder = 0;
                        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                        return;
                    }
                    if (qty30d === 0) {
                        r.RecommendedOrder = 0;
                        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                        return;
                    }
                    if (r.Moving === "Slowly" && qty30d >= qty4m) {
                        r.RecommendedOrder = 0;
                        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                        return;
                    }
                    if (has3m && qty3m === 0 && qty30d === 0) {
                        r.RecommendedOrder = 0;
                        r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                        return;
                    }
                }

                const netStock = unrestricted + poOutstanding + prOutstanding;

                if (netStock < rop) {
                    let need = (meanDaily * adjustedCoverDays) - netStock;
                    need = Math.max(0, need);
                    const pack = Number(mul) > 0 ? Number(mul) : 1;
                    // ปัดลงให้เป็นจำนวนเต็มแพ็ค (ไม่มีเศษ) อย่างน้อย 1 แพ็คถ้ามีความต้องการ
                    let packs = Math.floor(need / pack);
                    if (need > 0 && packs === 0) packs = 1;
                    need = packs * pack;
                    r.RecommendedOrder = need;
                } else {
                    r.RecommendedOrder = 0;
                }
                r.DOS = meanDaily === 0 ? (unrestricted > 0 ? 9999 : 0) : unrestricted / meanDaily;
                if (typeof updateReturnFields === "function") {
                    updateReturnFields(r);
                }
            });
        }
    };

    overrides["0326"] = {
        recalculateStockFields: ({ data, params, helpers }) => {
            try {
                const defaultRecalculate = (helpers && helpers.defaultRecalculateStockFields) ? helpers.defaultRecalculateStockFields : null;
                if (typeof defaultRecalculate === "function") {
                    defaultRecalculate(data, params);
                }
                const override0301 = (overrides["0301"] && overrides["0301"].recalculateStockFields) ? overrides["0301"].recalculateStockFields : null;
                if (typeof override0301 === "function") {
                    const installRows = data.filter(r => (r.Status || "").toString().trim() === "ติดตั้ง");
                    if (installRows.length > 0) {
                        // Backup ค่า PO เดิมไว้ก่อน (เพราะ 0326 เก็บเป็นหน่วย PO แต่ 0301 คำนวณด้วยหน่วย Base)
                        const poBackup = installRows.map(r => ({ row: r, value: r.PoOutstanding }));
                        installRows.forEach(r => {
                            // ใช้ยอด PO ที่แปลงหน่วยแล้ว (PoOutstandingDisplay) เพื่อให้สูตร 0301 คำนวณถูกต้อง
                            r.PoOutstanding = (r.PoOutstandingDisplay !== undefined && r.PoOutstandingDisplay !== null ? r.PoOutstandingDisplay : r.PoOutstanding) || 0;
                        });
                        // เรียกใช้สูตร 0301 (NetStock = Unrestricted + PO + PR)
                        override0301({ data: installRows, params });
                        poBackup.forEach(item => {
                            item.row.PoOutstanding = item.value;
                        });
                        // Plant 0326 Status ติดตั้ง: ปรับ SafetyDay/CoverDay ตาม L/T
                        installRows.forEach(r => {
                            const rawLT = Number(r.LeadTimeDays || 0);
                            let updated = false;

                            if (rawLT === 0) {
                                r.SafetyDayUsed = 17;
                                r.CoverDayUsed = 45;
                                updated = true;
                            } else if (rawLT >= 3 && rawLT <= 6) {
                                r.SafetyDayUsed = 14;
                                r.CoverDayUsed = 45;
                                updated = true;
                            } else if (rawLT >= 7 && rawLT <= 13) {
                                r.SafetyDayUsed = 10;
                                r.CoverDayUsed = 45;
                                updated = true;
                            } else if (rawLT >= 14 && rawLT <= 30) {
                                r.SafetyDayUsed = 10;
                                r.CoverDayUsed = 45;
                                updated = true;
                            }

                            if (updated) {
                                const meanDaily = Number(r.AvgDailyUse || 0);
                                r.SafetyStock = meanDaily * r.SafetyDayUsed;
                                // สำหรับ ROP: ถ้าเป็นรายการที่มี L/T ให้ใช้ L/T จริง ถ้าไม่มีให้ใช้ค่ากลางจาก params
                                const effectiveLT = rawLT > 0 ? rawLT : Number((params && params.leadTime !== undefined) ? params.leadTime : 5);
                                r.ROP = (meanDaily * effectiveLT) + r.SafetyStock;

                                // คำนวณยอดสั่งซื้อที่แนะนำ (RecommendedOrder) ใหม่ตาม ROP ที่เปลี่ยนไป
                                const unrestricted = Number(r.Unrestricted || 0);
                                const prOutstanding = Number(r.PrOutstanding || 0);
                                const poOutstanding = Number((r.PoOutstandingDisplay !== undefined && r.PoOutstandingDisplay !== null ? r.PoOutstandingDisplay : r.PoOutstanding) || 0);
                                const netStock = unrestricted + poOutstanding + prOutstanding;
                                const mul = Number(r.MultiplyUnit || 1) || 1;

                                if (netStock < r.ROP) {
                                    let need = (meanDaily * r.CoverDayUsed) - netStock;
                                    need = Math.max(0, need);
                                    let packs = Math.floor(need / mul);
                                    if (need > 0 && packs === 0) packs = 1;
                                    r.RecommendedOrder = packs * mul;
                                } else {
                                    r.RecommendedOrder = 0;
                                }
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Error in 0326 recalculateStockFields:", err);
            }
            data.forEach(r => {
                const status = (r.Status || "").toString().trim();
                if (!(status === "ติดตั้งเรียกเข้า" || status === "เรียกเข้า")) return;
                const meanDaily = Number(r.AvgDailyUse || 0);
                const unrestricted = Number(r.Unrestricted || 0);
                const pack = Number(r.MultiplyUnit || 1) || 1;
                const dos = Number(r.DOS || 0);
                if (!isFinite(meanDaily) || meanDaily <= 0) {
                    r.RecommendedOrder = 0;
                    return;
                }
                if (dos < 7) {
                    r.CoverDayUsed = 15;
                    let need = (meanDaily * 15) - unrestricted;
                    need = Math.max(0, need);
                    let packs = Math.floor(need / pack);
                    if (need > 0 && packs === 0) packs = 1;
                    r.RecommendedOrder = packs * pack;
                } else {
                    r.RecommendedOrder = 0;
                }
            });
            data.forEach(r => {
                const status = (r.Status || "").toString().trim();
                if (!(status === "" || status === "-")) return;
                if (Math.round(r.RecommendedOrder || 0) > 0) {
                    r.Status = "Order";
                }
            });
        }
    };

    global.plantCalculationOverrides = overrides;
})(typeof window !== "undefined" ? window : globalThis);
