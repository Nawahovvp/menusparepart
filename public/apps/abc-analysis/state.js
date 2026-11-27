// Global state & constants extracted from the original app.js
let sortKey = "CumPercent", sortDir = "asc";
let allData = [], filteredData = [];
let mode = "all", abcFilter = "", movingFilter = "";
let currentPage = 1;
const rowsPerPage = 20;
let users = [];
let loggedUser = null;
let inventoryUrl;
let selectedPlant = "";
let movementHtml = "";

// Base64 helper decoding function for UTF-8 URLs
function _d(s) {
    return decodeURIComponent(atob(s).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

// Data sources, make sure the URLs are correct
const userSheetID = _d('MWVxVm9Mc1p4R2d1RWJSQ0M1cmRJNGlNVnRRN0NLNFQzdVhSZHg4ekUzdXc=');
const userSheetName = _d('RW1wbG95ZWVXZWI=');
const userUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFlcVZvTHNaeEdndUViUkNDNXJkSTRpTVZ0UTdDSzRUM3VYUmR4OHpFM3V3L0VtcGxveWVlV2Vi');
const usageUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzF4YmhaV2xsbWRRTTdRMmdaN25lNkxyX3dNclJ2TlFvYmJwUERIVV9YazRjL01vdmVBbGxQbGFudFg=');
const mainsapUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFDa2ZPSWUybkRZQkxzNWFQR2tQeVpoT2VxSmt5UzdVUTZ0dU16eHktbWZrL21haW5zYXA=');
const po0301Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFTUFB5OHVydTFhQ1paLXQ4ZkxQWVB4X1VwLUNhbWRhSW9BYlJON2ZZRF9vL1BPIOC4quC4seC5iOC4h+C4guC4reC4hw==');
const note0301Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFTUFB5OHVydTFhQ1paLXQ4ZkxQWVB4X1VwLUNhbWRhSW9BYlJON2ZZRF9vL+C4q+C4oeC4suC4ouC5gOC4q+C4leC4uA==');
const pr0301Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFTUFB5OHVydTFhQ1paLXQ4ZkxQWVB4X1VwLUNhbWRhSW9BYlJON2ZZRF9vL1BSIOC4quC4seC5iOC4h+C4guC4reC4hw==');
const po0326Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzEtc2pYclZzZE1PaVVZTG9tdHo0RjVPWC1vTnA5VFpnVzBJemJ2cUpUSFNvL1NoZWV0MQ==');
const pr0326Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFRM3JJN0Vwb3dnR3ZoNXB4OXA3NmNIM2pmYVc5QjFoc1c3WlpOWFhEdWs4L1NoZWV0MQ==');
const express0326Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzF4eXk3MGNxMnZBeEd2NGdQSUdpTF94QTVjekRYcVMyaTZZWXFXNHlFVmJFL1JlcXVlc3Q=');
const comeon0301Url = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzEwM2RWRUk2VlNPbjFCVl9xUmNrN0JnVDc3Q3hmTDZBZm82YV9DWldUU1d3L1NoZWV0MQ==');
const avgValUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFud1hETjZGam1YT0hYemx4VnY2eTBLdjRwZVU5a2pXM3EyMFBBV3NwNl80L1NoZWV0MQ==');
const statusUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzF5UDFzcTEyZlNYajAwaHRKZXdVSXVna1FDYXhBMHNtTzJqZTd3dEVJU2R3L09yZGVycw==');
const locationUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzF4LUIxeGVrcE1tNHA3ZmtLdWN2TGphZXd0cDY2dUdJcDhaSXhKSlpBeE1rL1NoZWV0MQ==');
const shelfUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFLaHdNSVZMLUUzWERpeGJ4TFQzby1RZzU3LWh2eV9EVzB5LXY1b05NV0RrL1NoZWxm');
const statusGasUrl = _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J3SThaTkNyUjVhb0ZYN1ZKeEIxM1FmTFNFWGN4V2tOemJUVzc2UVl2RWxoVUhKMV9wY1hwcVZhRFRJRzB2ZHhIa2gvZXhlYw==');
const statusReadUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzE4X1I4YTRxZHBZLWJ5M2pFbXhoZjlRYXNJdUI4N3VKTF9PS2xWcFZRWjVVL1N0YXR1c0RhdGE=');
const PO_SUPPLIER_ENDPOINT = _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J5Uk9YRkw5V2xqdnk2NmZLRnVlOXJXZGdmWEtibDloRWhjR0tFUFNTTTR2UGxNNWZWWmRZaVBLR3VRcnVLckNzNlAvZXhlYw==');
const poSupplierDataUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzF3cUsxcXEzWXhtQWliYTNoY1ZZdHhkNjBUTFg2bTNrTTJfVGU3cFNHZUdRL1BvU3VwcGxpZXI=');

let locationMap = new Map();
let shelfOwnerMap = new Map();

const employeeUrl = _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFlcVZvTHNaeEdndUViUkNDNXJkSTRpTVZ0UTdDSzRUM3VYUmR4OHpFM3V3L0VtcGxveWVl');
let employees = [];

const inventoryUrls = {
    '0301': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzF4LUIxeGVrcE1tNHA3ZmtLdWN2TGphZXd0cDY2dUdJcDhaSXhKSlpBeE1rL1NoZWV0MQ=='),
    '0304': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFtaVFnT2J2UGRJb2NqZjJNd24tR1p4UnZEWnkwUjVnSWwxemh4TVd2TS1FL1NoZWV0MQ=='),
    '0305': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFEc3pSZ2ZHRFhlLW4tQlVxRzNaTGotXzROMG1IdTdtdnc4RW5mVU9odnZJL1NoZWV0MQ=='),
    '0307': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFDOXZmd3RkSU8tWGpIckRrbXA1Y1VhaGptY0ozdms4cFR6aEZDZ0hCZzFRL1NoZWV0MQ=='),
    '0309': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFudFJ0bFJJbmR4Z0VaM3Vkbmg3Tmo4TFNRaWFVZEFlQWc1ajhxZF96OHNBL1NoZWV0MQ=='),
    '0311': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFPS0RkcUxZX1RPampmTEo1OHhGaXEtV0hJRGJNcnhNY0RobzZGTzVScThvL1NoZWV0MQ=='),
    '0312': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFpbFliVnNDcUExY1NvVW5ad3dVTENtUGtkYWtvYklDa3lxNUpwQkp5eUFVL1NoZWV0MQ=='),
    '0313': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzEyRlNia1lTQjF6aTZ4bzJXR0FzTTBqRnlwM0lrSXl3TEZWRjBabjJheHBFL1NoZWV0MQ=='),
    '0319': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFwWUpzcDNaVlN3UTFoX0F5cXAzQnJNVHNtLVp0TFJFVTAzUXc1V1V0Z0F3L1NoZWV0MQ=='),
    '0320': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFWNXVoSDF3ZWt6YTRGTE4yVnF0VkJmZ0lBMXNiVFlfbXFxNG9oblRtV19NL1NoZWV0MQ=='),
    '0326': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFndFpMUjVUbTU3NG81eFJiZHJSbTl5RnpSdWtHeF9VQXpVbm9haDM2Y3hRL1NoZWV0MQ=='),
    '0330': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFXWU9pa3VvV0UzMFdYc1dnbFRYZnhvajFnbWp4bEZNSmdwTjNlWHA0M0JrL1NoZWV0MQ=='),
    '0366': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzFOdFJzYXhQa2VOYjRzQWNUbS1UbjRvTi1vNUY2el81NlMxbmhUZzdrdkJjL1NoZWV0MQ=='),
    '0369': _d('aHR0cHM6Ly9vcGVuc2hlZXQuZWxrLnNoLzEzTllLaEVXa1dMTG5BMkRaWkVQLXpaRXoycjMzLXJvVURQTVNXb0ZSM1FrL1NoZWV0MQ=='),
};

const lastUpdateApiBase = _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVj');
const lastUpdateApiByPlant = {
    '0301': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTF4LUIxeGVrcE1tNHA3ZmtLdWN2TGphZXd0cDY2dUdJcDhaSXhKSlpBeE1r'),
    '0304': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFtaVFnT2J2UGRJb2NqZjJNd24tR1p4UnZEWnkwUjVnSWwxemh4TVd2TS1F'),
    '0305': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFEc3pSZ2ZHRFhlLW4tQlVxRzNaTGotXzROMG1IdTdtdnc4RW5mVU9odnZJ'),
    '0307': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFDOXZmd3RkSU8tWGpIckRrbXA1Y1VhaGptY0ozdms4cFR6aEZDZ0hCZzFR'),
    '0309': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFudFJ0bFJJbmR4Z0VaM3Vkbmg3Tmo4TFNRaWFVZEFlQWc1ajhxZF96OHNB'),
    '0311': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFPS0RkcUxZX1RPampmTEo1OHhGaXEtV0hJRGJNcnhNY0RobzZGTzVScThv'),
    '0312': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFpbFliVnNDcUExY1NvVW5ad3dVTENtUGtkYWtvYklDa3lxNUpwQkp5eUFV'),
    '0313': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTEyRlNia1lTQjF6aTZ4bzJXR0FzTTBqRnlwM0lrSXl3TEZWRjBabjJheHBF'),
    '0319': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFwWUpzcDNaVlN3UTFoX0F5cXAzQnJNVHNtLVp0TFJFVTAzUXc1V1V0Z0F3'),
    '0320': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFWNXVoSDF3ZWt6YTRGTE4yVnF0VkJmZ0lBMXNiVFlfbXFxNG9oblRtV19N'),
    '0326': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFndFpMUjVUbTU3NG81eFJiZHJSbTl5RnpSdWtHeF9VQXpVbm9haDM2Y3hR'),
    '0330': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFXWU9pa3VvV0UzMFdYc1dnbFRYZnhvajFnbWp4bEZNSmdwTjNlWHA0M0Jr'),
    '0366': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTFOdFJzYXhQa2VOYjRzQWNUbS1UbjRvTi1vNUY2el81NlMxbmhUZzdrdkJj'),
    '0369': _d('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4d1BvamxrekEtUUJrblJwTjZHSWl1d3hKbzVjeUJzVkdnWFF3bmVHZW5mc3ZTejlZdXp1b05mMlpzcnR4b0t5cEUzUS9leGVjP2lkPTEzTllLaEVXa1dMTG5BMkRaWkVQLXpaRXoycjMzLXJvVURQTVNXb0ZSM1Fr'),
};

const sheetIds = {};
Object.keys(inventoryUrls).forEach(plant => {
    const url = inventoryUrls[plant];
    const parts = url.split('/');
    sheetIds[plant] = parts[3];
});

const plantNames = {
    '0301': 'นวนคร',
    '0303': 'SA-สงขลา',
    '0304': 'พระราม 3',
    '0305': 'ราชบุรี',
    '0307': 'สุราษฎร์',
    '0309': 'นครราชสีมา',
    '0310': 'SA-อุดร 1',
    '0311': 'ศรีราชา',
    '0312': 'พิษณุโลก',
    '0313': 'ภูเก็ต',
    '0315': 'SA-อยุธยา',
    '0319': 'ขอนแก่น',
    '0318': 'คลังวัตถุดิบ',
    '0320': 'ลำปาง',
    '0322': 'SA-อุดร 2',
    '0323': 'SA-ลำลูกกา',
    '0324': 'SA-ปัตตานี',
    '0326': 'วิภาวดี 62',
    '0330': 'ประเวศ',
    '0362': 'SA-หนองแขม',
    '0363': 'SA-ปากเกร็ด',
    '0364': 'SA-บางบัวทอง',
    '0365': 'SA-สมุทรปราการ',
    '0366': 'เชียงใหม่',
    '0367': 'SA-ฉะเชิงเทรา',
    '0368': 'SA-ร้อยเอ็ด',
    '0369': 'ระยอง'
};

const OUT_OF_STOCK_MODE = "out_of_stock";
const OUT_OF_STOCK_WAIT_MODE = "out_of_stock_wait";

let movementInfoReady = false;

// Allow plant override registration early
if (typeof window !== "undefined") {
    window.plantCalculationOverrides = window.plantCalculationOverrides || {};
}


