import React from 'react';
import { DEPT_GROUPS, getDeptGroups, formatStockAnswerLabel } from '../utils/helpers';
import { getCusLogo } from '../utils/cusLogos';

const GROUP_TAG_COLORS = {
    Stock: { bg: 'rgba(59, 130, 246, 0.24)', border: 'rgba(96, 165, 250, 0.6)', color: '#bfdbfe', activeBg: 'rgba(37, 99, 235, 0.72)' },
    วิศวกรรม: { bg: 'rgba(168, 85, 247, 0.24)', border: 'rgba(192, 132, 252, 0.6)', color: '#e9d5ff', activeBg: 'rgba(147, 51, 234, 0.72)' },
    Repair: { bg: 'rgba(249, 115, 22, 0.24)', border: 'rgba(251, 146, 60, 0.6)', color: '#fed7aa', activeBg: 'rgba(234, 88, 12, 0.72)' },
    จัดซื้อ: { bg: 'rgba(16, 185, 129, 0.24)', border: 'rgba(52, 211, 153, 0.6)', color: '#a7f3d0', activeBg: 'rgba(5, 150, 105, 0.72)' },
    ลูกค้า: { bg: 'rgba(236, 72, 153, 0.24)', border: 'rgba(244, 114, 182, 0.6)', color: '#fbcfe8', activeBg: 'rgba(219, 39, 119, 0.72)' },
    Sale: { bg: 'rgba(139, 92, 246, 0.24)', border: 'rgba(167, 139, 250, 0.6)', color: '#ddd6fe', activeBg: 'rgba(124, 58, 237, 0.72)' },
    จัดส่ง: { bg: 'rgba(56, 189, 248, 0.24)', border: 'rgba(125, 211, 252, 0.6)', color: '#bae6fd', activeBg: 'rgba(2, 132, 199, 0.72)' },
    อื่นๆ: { bg: 'rgba(148, 163, 184, 0.22)', border: 'rgba(203, 213, 225, 0.5)', color: '#e2e8f0', activeBg: 'rgba(71, 85, 105, 0.78)' }
};

export default function ControlPanel({
    searchTerm,
    onSearchChange,
    onSearch,
    teamPlantFilter,
    pendingUnitFilter,
    stockAnswerFilter,
    statusCallFilter,
    companyFilter,
    dashboardFilter,
    gmFilter,
    onTeamPlantChange,
    onPendingUnitChange,
    onStockAnswerChange,
    onCompanyChange,
    onClearAllFilters,
    onOpenFilters,
    totalCount = 0,
    totalQuantity = 0,
    activeFilterCount = 0,
    pendingUnitOptions = {},
    pendingUnitAllDone = {},
    userPendingUnit = ''
}) {
    const [showOtherPendingGroups, setShowOtherPendingGroups] = React.useState(false);

    const activeChips = [];
    if (companyFilter) activeChips.push({ key: 'cus', label: `ลูกค้า: ${getCusLogo(companyFilter)?.shortName || companyFilter}`, onClear: () => onCompanyChange?.('') });
    if (teamPlantFilter) activeChips.push({ key: 'tp', label: `ศูนย์พื้นที่: ${teamPlantFilter}`, onClear: () => onTeamPlantChange('') });
    if (stockAnswerFilter) activeChips.push({ key: 'sa', label: `คลังตอบ: ${formatStockAnswerLabel(stockAnswerFilter)}`, onClear: () => onStockAnswerChange('') });
    if (statusCallFilter) activeChips.push({ key: 'sc', label: `StatusCall: ${statusCallFilter}`, onClear: onClearAllFilters });
    if (dashboardFilter) {
        const isCallType = dashboardFilter.startsWith?.('calltype_');
        activeChips.push({
            key: 'df',
            label: isCallType ? `Call Type: ${dashboardFilter.replace('calltype_', '')}` : `กลุ่มสถานะ: ${dashboardFilter}`,
            onClear: onClearAllFilters
        });
    }
    if (gmFilter) activeChips.push({ key: 'gm', label: `GM: ${gmFilter.replace('gm_', '')}`, onClear: onClearAllFilters });

    const sortedPendingUnits = React.useMemo(() => {
        const entries = Object.entries(pendingUnitOptions || {}).sort((a, b) => b[1] - a[1]);
        if (!userPendingUnit) return entries;
        const userIdx = entries.findIndex(([key]) => key === userPendingUnit);
        if (userIdx <= 0) return entries;
        const [userEntry] = entries.splice(userIdx, 1);
        return [userEntry, ...entries];
    }, [pendingUnitOptions, userPendingUnit]);

    const totalPendingUnitItems = React.useMemo(
        () => sortedPendingUnits.reduce((sum, [, count]) => sum + count, 0),
        [sortedPendingUnits]
    );

    const selectedPendingUnits = React.useMemo(
        () => (Array.isArray(pendingUnitFilter) ? pendingUnitFilter : (pendingUnitFilter ? [pendingUnitFilter] : [])),
        [pendingUnitFilter]
    );

    const togglePendingUnit = (unitKey, isStock = false) => {
        if (selectedPendingUnits.includes(unitKey)) {
            onPendingUnitChange(selectedPendingUnits.filter((item) => item !== unitKey));
            return;
        }
        if (isStock) {
            const stockKeys = new Set((stockGroup?.items || []).map(([k]) => k));
            const nonStockSelected = selectedPendingUnits.filter((item) => !stockKeys.has(item));
            onPendingUnitChange([...nonStockSelected, unitKey]);
            return;
        }
        onPendingUnitChange([...selectedPendingUnits, unitKey]);
    };

    const groupedPendingUnits = React.useMemo(() => {
        const buckets = new Map();
        const groupOrder = [...DEPT_GROUPS.map(g => g.key), 'อื่นๆ'];
        groupOrder.forEach(k => buckets.set(k, []));

        sortedPendingUnits.forEach(([key, count]) => {
            const matched = getDeptGroups(key)[0] || 'อื่นๆ';
            if (!buckets.has(matched)) buckets.set(matched, []);
            buckets.get(matched).push([key, count]);
        });

        return [...buckets.entries()]
            .filter(([, items]) => items.length > 0)
            .map(([groupKey, items]) => ({
                key: groupKey,
                label: groupKey,
                items,
                total: items.reduce((sum, [, count]) => sum + count, 0)
            }));
    }, [sortedPendingUnits]);

    const stockGroup = React.useMemo(
        () => groupedPendingUnits.find((g) => g.key === 'Stock') || null,
        [groupedPendingUnits]
    );

    const otherPendingGroups = React.useMemo(
        () => groupedPendingUnits.filter((g) => g.key !== 'Stock'),
        [groupedPendingUnits]
    );

    const otherGroupsTotal = React.useMemo(
        () => otherPendingGroups.reduce((sum, g) => sum + g.total, 0),
        [otherPendingGroups]
    );

    const togglePendingGroup = (group) => {
        const groupKeys = group.items.map(([k]) => k);
        if (groupKeys.length === 0) return;
        const allSelected = groupKeys.every((k) => selectedPendingUnits.includes(k));
        if (allSelected) {
            onPendingUnitChange(selectedPendingUnits.filter((item) => !groupKeys.includes(item)));
        } else {
            const merged = Array.from(new Set([...selectedPendingUnits, ...groupKeys]));
            onPendingUnitChange(merged);
        }
    };

    const renderPendingGroupBox = (group, isStock = false) => {
        const tagStyle = GROUP_TAG_COLORS[group.key] || GROUP_TAG_COLORS['อื่นๆ'];
        const groupKeys = group.items.map(([k]) => k);
        const isAllGroupSelected = groupKeys.length > 0 && groupKeys.every((k) => selectedPendingUnits.includes(k));
        const isSomeGroupSelected = !isAllGroupSelected && groupKeys.some((k) => selectedPendingUnits.includes(k));
        return (
            <div
                key={group.key}
                className={`quick-unit-group-box ${isStock ? 'is-stock-box' : ''}`}
            >
                <button
                    type="button"
                    className={`quick-unit-group-tag clickable-group-tag ${isAllGroupSelected ? 'active' : ''} ${isSomeGroupSelected ? 'partial' : ''}`}
                    style={{
                        backgroundColor: isAllGroupSelected ? tagStyle.activeBg : tagStyle.bg,
                        borderColor: isAllGroupSelected ? '#ffffff' : tagStyle.border,
                        color: isAllGroupSelected ? '#ffffff' : tagStyle.color,
                        cursor: 'pointer'
                    }}
                    onClick={() => togglePendingGroup(group)}
                    title={isAllGroupSelected
                        ? `ยกเลิกกรองกลุ่ม ${group.label} ทั้งหมด`
                        : `คลิกเพื่อแสดงค้างหน่วยงานทั้งหมดในกลุ่ม ${group.label} (${group.total} รายการ)`}
                >
                    <span>{group.label}</span>
                    <span className="quick-unit-group-total">{group.total}</span>
                </button>
                <div className="quick-unit-chips">
                    {group.items.map(([key, count]) => {
                        const isActive = selectedPendingUnits.includes(key);
                        const isClear = pendingUnitAllDone?.[key] === true;
                        const isUserUnit = Boolean(userPendingUnit && userPendingUnit === key);
                        const displayLabel = String(key).replace(/^Stock\s*/i, '').trim() || key;
                        return (
                            <button
                                key={key}
                                type="button"
                                className={`quick-unit-chip ${isActive ? 'active' : ''} ${isClear ? 'clear' : ''} ${isUserUnit ? 'is-user-unit' : ''}`}
                                onClick={() => togglePendingUnit(key, isStock)}
                                title={isUserUnit ? `หน่วยงานของคุณ (${key})` : `กรองค้างหน่วยงาน: ${key}`}
                            >
                                {isUserUnit && <i className="fas fa-user quick-unit-user-icon" aria-hidden="true"></i>}
                                <span>{displayLabel}</span>
                                <span className="quick-unit-count">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div id="searchContainer" className="modern-search-bar">
            <div className="search-row-primary">
                <div className="search-input-wrap">
                    <i className="fas fa-search search-input-icon"></i>
                    <input
                        type="text"
                        id="searchInput"
                        placeholder="ค้นหา Ticket Number, Team, Material, TeamPlant, Store Name, Equipment, Call Type, ค้างหน่วยงาน..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            className="search-clear-icon"
                            onClick={() => onSearchChange('')}
                            title="ล้างคำค้นหา"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>

                <button id="searchButton" className="action-button" onClick={onSearch}>
                    <i className="fas fa-search"></i> ค้นหา
                </button>

                <button
                    type="button"
                    className={`action-button ghost filter-trigger-btn ${activeFilterCount > 0 ? 'has-active' : ''}`}
                    onClick={onOpenFilters}
                    title="เปิดแถบตัวกรองด้านขวา"
                >
                    <i className="fas fa-sliders-h"></i>
                    <span>ตัวกรอง</span>
                    {activeFilterCount > 0 && <span className="filter-trigger-badge">{activeFilterCount}</span>}
                </button>

                <span className="result-count-pill">
                    พบ <strong>{totalCount.toLocaleString()}</strong> รายการ
                </span>
                <span className="result-count-pill qty-pill">
                    รวมจำนวน <strong>{totalQuantity.toLocaleString()}</strong> ชิ้น
                </span>
            </div>

            {sortedPendingUnits.length > 0 && (
                <div className="quick-unit-bar" role="group" aria-label="ตัวกรองด่วน ค้างหน่วยงาน">
                    <div className="quick-unit-header-col">
                        {stockGroup && otherPendingGroups.length > 0 && (
                            <button
                                type="button"
                                className={`quick-unit-expand-btn ${showOtherPendingGroups ? 'expanded' : ''}`}
                                onClick={() => setShowOtherPendingGroups((prev) => !prev)}
                                title={showOtherPendingGroups
                                    ? 'ซ่อนค้างหน่วยงานกลุ่มอื่น'
                                    : `แสดงค้างหน่วยงานกลุ่มอื่นทั้งหมด (${otherPendingGroups.length} กลุ่ม • ${otherGroupsTotal})`}
                                aria-expanded={showOtherPendingGroups}
                                aria-label="แสดงหรือซ่อนค้างหน่วยงานกลุ่มอื่น"
                            >
                                <i className={`fas fa-chevron-${showOtherPendingGroups ? 'up' : 'down'}`} aria-hidden="true"></i>
                            </button>
                        )}
                        <span className="quick-unit-label">
                            <i className="fas fa-layer-group"></i>
                            <span>ค้างหน่วยงาน</span>
                        </span>
                        <button
                            type="button"
                            className={`quick-unit-chip ${selectedPendingUnits.length === 0 ? 'active' : ''}`}
                            onClick={() => onPendingUnitChange([])}
                        >
                            <span>ทั้งหมด</span>
                            <span className="quick-unit-count">{totalPendingUnitItems}</span>
                        </button>
                    </div>
                    <div className="quick-unit-groups-stack">
                        {stockGroup && renderPendingGroupBox(stockGroup, true)}
                        {(showOtherPendingGroups || !stockGroup) &&
                            otherPendingGroups.map((group) => renderPendingGroupBox(group, false))}
                    </div>
                </div>
            )}

            {activeChips.length > 0 && (
                <div className="active-filters-strip">
                    <span className="active-filters-label">ตัวกรองที่เลือก:</span>
                    {activeChips.map(chip => (
                        <span key={chip.key} className="active-filter-chip">
                            <span>{chip.label}</span>
                            <button type="button" onClick={chip.onClear} title="ลบตัวกรองนี้">
                                <i className="fas fa-times"></i>
                            </button>
                        </span>
                    ))}
                    <button type="button" className="active-filters-clear-all" onClick={onClearAllFilters}>
                        ล้างทั้งหมด
                    </button>
                </div>
            )}
        </div>
    );
}
